package com.assettracker.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class RuntimeStateRepository {

    private final JdbcTemplate jdbcTemplate;

    public RuntimeStateRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean hasProjectedData(UUID userId) {
        Long accounts = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM accounts WHERE user_id = ?",
                Long.class,
                userId.toString()
        );
        return accounts != null && accounts > 0;
    }

    public Optional<ImportRecord> findLatestImport(UUID userId, String sourceType, String sourceIdentifier) {
        List<ImportRecord> results = jdbcTemplate.query("""
                        SELECT id, source_type, source_identifier, status, imported_at, notes
                        FROM imports
                        WHERE user_id = ?
                          AND source_type = ?
                          AND source_identifier = ?
                        ORDER BY imported_at DESC, id DESC
                        LIMIT 1
                        """,
                (rs, rowNum) -> new ImportRecord(
                        UUID.fromString(rs.getString("id")),
                        rs.getString("source_type"),
                        rs.getString("source_identifier"),
                        rs.getString("status"),
                        rs.getTimestamp("imported_at") == null ? null : rs.getTimestamp("imported_at").toInstant(),
                        rs.getString("notes")
                ),
                userId.toString(),
                sourceType,
                sourceIdentifier
        );
        return results.stream().findFirst();
    }

    public void recordImport(UUID userId,
                             String sourceType,
                             String sourceIdentifier,
                             String status,
                             Instant importedAt,
                             String notes) {
        Optional<ImportRecord> existing = findLatestImport(userId, sourceType, sourceIdentifier);
        if (existing.isPresent()) {
            jdbcTemplate.update("""
                    UPDATE imports
                    SET status = ?,
                        imported_at = ?,
                        notes = ?
                    WHERE id = ?
                    """,
                    status,
                    timestamp(importedAt),
                    notes,
                    existing.get().id().toString()
            );
            return;
        }

        jdbcTemplate.update("""
                INSERT INTO imports (id, user_id, source_type, source_identifier, status, imported_at, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID().toString(),
                userId.toString(),
                sourceType,
                sourceIdentifier,
                status,
                timestamp(importedAt),
                notes
        );
    }

    public Optional<String> findAppSetting(String key) {
        List<String> results = jdbcTemplate.query(
                "SELECT setting_value FROM app_settings WHERE setting_key = ?",
                (rs, rowNum) -> rs.getString("setting_value"),
                key
        );
        return results.stream().findFirst();
    }

    public void saveAppSetting(String key, String value) {
        int updated = jdbcTemplate.update("""
                UPDATE app_settings
                SET setting_value = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE setting_key = ?
                """, value, key);
        if (updated == 0) {
            jdbcTemplate.update("""
                    INSERT INTO app_settings (setting_key, setting_value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                    """,
                    key,
                    value
            );
        }
    }

    private Timestamp timestamp(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    public record ImportRecord(UUID id,
                               String sourceType,
                               String sourceIdentifier,
                               String status,
                               Instant importedAt,
                               String notes) {
    }
}
