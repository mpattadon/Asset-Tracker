package com.assettracker.service;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class PortfolioMetadataRepository {

    private static final RowMapper<UserRecord> USER_ROW_MAPPER = new UserRecordMapper();
    private static final RowMapper<UserKeyRecord> USER_KEY_ROW_MAPPER = new UserKeyRecordMapper();
    private static final RowMapper<LocalUserRecord> LOCAL_USER_ROW_MAPPER = new LocalUserRowMapper();

    private final JdbcTemplate jdbcTemplate;

    public PortfolioMetadataRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<UserRecord> findUserByExternalId(String externalUserId) {
        List<UserRecord> results = jdbcTemplate.query(
                "SELECT id, external_user_id, email, display_name, auth_provider FROM users WHERE external_user_id = ?",
                USER_ROW_MAPPER,
                externalUserId
        );
        return results.stream().findFirst();
    }

    public Optional<UserRecord> findUserById(UUID userId) {
        List<UserRecord> results = jdbcTemplate.query(
                "SELECT id, external_user_id, email, display_name, auth_provider FROM users WHERE id = ?",
                USER_ROW_MAPPER,
                id(userId)
        );
        return results.stream().findFirst();
    }

    public UserRecord upsertUser(String externalUserId, String email, String displayName, String authProvider) {
        int updated = jdbcTemplate.update("""
                UPDATE users
                SET email = COALESCE(?, email),
                    display_name = COALESCE(?, display_name),
                    auth_provider = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE external_user_id = ?
                """, email, displayName, authProvider, externalUserId);
        if (updated == 0) {
            try {
                jdbcTemplate.update("""
                        INSERT INTO users (id, external_user_id, email, display_name, auth_provider, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """, randomId(), externalUserId, email, displayName, authProvider);
            } catch (DuplicateKeyException ignored) {
                jdbcTemplate.update("""
                        UPDATE users
                        SET email = COALESCE(?, email),
                            display_name = COALESCE(?, display_name),
                            auth_provider = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE external_user_id = ?
                        """, email, displayName, authProvider, externalUserId);
            }
        }
        return findUserByExternalId(externalUserId)
                .orElseThrow(() -> new IllegalStateException("User upsert failed"));
    }

    public long countLocalUsers() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM local_users", Long.class);
        return count == null ? 0 : count;
    }

    public Optional<LocalUserRecord> findLocalUserByUsername(String username) {
        List<LocalUserRecord> results = jdbcTemplate.query("""
                        SELECT u.id AS user_id, u.external_user_id, u.email, u.display_name,
                               lu.username, lu.password_hash
                        FROM local_users lu
                        JOIN users u ON u.id = lu.user_id
                        WHERE lu.username = ?
                        """,
                LOCAL_USER_ROW_MAPPER,
                username);
        return results.stream().findFirst();
    }

    public LocalUserRecord createLocalUser(String username,
                                           String email,
                                           String displayName,
                                           String passwordHash) {
        String externalUserId = "local:" + username;
        UserRecord user = upsertUser(externalUserId, email, displayName, "local");
        int updated = jdbcTemplate.update("""
                UPDATE local_users
                SET password_hash = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """, passwordHash, id(user.id()));
        if (updated == 0) {
            try {
                jdbcTemplate.update("""
                        INSERT INTO local_users (user_id, username, password_hash, created_at, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """,
                        id(user.id()),
                        username,
                        passwordHash
                );
            } catch (DuplicateKeyException exception) {
                throw exception;
            }
        }
        return findLocalUserByUsername(username)
                .orElseThrow(() -> new IllegalStateException("Local user creation failed"));
    }

    public Optional<UserKeyRecord> findUserKey(UUID userId) {
        List<UserKeyRecord> results = jdbcTemplate.query("""
                        SELECT id, user_id, key_version, wrapped_key, wrapping_algorithm
                        FROM user_keys
                        WHERE user_id = ?
                        """,
                USER_KEY_ROW_MAPPER,
                id(userId));
        return results.stream().findFirst();
    }

    public UserKeyRecord saveUserKey(UUID userId, int keyVersion, String wrappedKey, String wrappingAlgorithm) {
        int updated = jdbcTemplate.update("""
                UPDATE user_keys
                SET key_version = ?,
                    wrapped_key = ?,
                    wrapping_algorithm = ?,
                    rotated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """, keyVersion, wrappedKey, wrappingAlgorithm, id(userId));
        if (updated == 0) {
            try {
                jdbcTemplate.update("""
                        INSERT INTO user_keys (id, user_id, key_version, wrapped_key, wrapping_algorithm, created_at)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        """, randomId(), id(userId), keyVersion, wrappedKey, wrappingAlgorithm);
            } catch (DuplicateKeyException ignored) {
                jdbcTemplate.update("""
                        UPDATE user_keys
                        SET key_version = ?,
                            wrapped_key = ?,
                            wrapping_algorithm = ?,
                            rotated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ?
                        """, keyVersion, wrappedKey, wrappingAlgorithm, id(userId));
            }
        }
        return findUserKey(userId)
                .orElseThrow(() -> new IllegalStateException("User key upsert failed"));
    }

    private String randomId() {
        return UUID.randomUUID().toString();
    }

    private String id(UUID value) {
        return value == null ? null : value.toString();
    }

    public record UserRecord(UUID id, String externalUserId, String email, String displayName, String authProvider) {
    }

    public record LocalUserRecord(UUID userId,
                                  String externalUserId,
                                  String username,
                                  String email,
                                  String displayName,
                                  String passwordHash) {
    }

    public record UserKeyRecord(UUID id, UUID userId, int keyVersion, String wrappedKey, String wrappingAlgorithm) {
    }

    private static class UserRecordMapper implements RowMapper<UserRecord> {
        @Override
        public UserRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new UserRecord(
                    parseUuid(rs.getString("id")),
                    rs.getString("external_user_id"),
                    rs.getString("email"),
                    rs.getString("display_name"),
                    rs.getString("auth_provider")
            );
        }
    }

    private static class LocalUserRowMapper implements RowMapper<LocalUserRecord> {
        @Override
        public LocalUserRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new LocalUserRecord(
                    parseUuid(rs.getString("user_id")),
                    rs.getString("external_user_id"),
                    rs.getString("username"),
                    rs.getString("email"),
                    rs.getString("display_name"),
                    rs.getString("password_hash")
            );
        }
    }

    private static class UserKeyRecordMapper implements RowMapper<UserKeyRecord> {
        @Override
        public UserKeyRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
            return new UserKeyRecord(
                    parseUuid(rs.getString("id")),
                    parseUuid(rs.getString("user_id")),
                    rs.getInt("key_version"),
                    rs.getString("wrapped_key"),
                    rs.getString("wrapping_algorithm")
            );
        }
    }

    private static UUID parseUuid(String raw) {
        return raw == null || raw.isBlank() ? null : UUID.fromString(raw);
    }
}
