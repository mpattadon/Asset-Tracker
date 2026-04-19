package com.assettracker.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.dao.DuplicateKeyException;

import java.util.UUID;

@Service
public class ReferenceDataService {

    private final JdbcTemplate jdbcTemplate;

    public ReferenceDataService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public UUID currencyId(String code) {
        return parseUuid(jdbcTemplate.queryForObject("SELECT id FROM currencies WHERE code = ?", String.class, code));
    }

    public UUID marketId(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return parseUuid(jdbcTemplate.queryForObject("SELECT id FROM markets WHERE code = ?", String.class, code));
    }

    public UUID exchangeId(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return parseUuid(jdbcTemplate.queryForObject("SELECT id FROM exchanges WHERE code = ?", String.class, code));
    }

    public UUID assetCategoryId(String code) {
        return parseUuid(jdbcTemplate.queryForObject("SELECT id FROM asset_categories WHERE code = ?", String.class, code));
    }

    public UUID transactionTypeId(String code) {
        return parseUuid(jdbcTemplate.queryForObject("SELECT id FROM transaction_types WHERE code = ?", String.class, code));
    }

    public UUID upsertInstitution(String name, String institutionType, String marketCode, String baseCurrencyCode) {
        UUID marketId = marketId(marketCode);
        UUID currencyId = baseCurrencyCode == null || baseCurrencyCode.isBlank() ? null : currencyId(baseCurrencyCode);
        int updated = jdbcTemplate.update("""
                UPDATE institutions
                SET market_id = COALESCE(?, market_id),
                    base_currency_id = COALESCE(?, base_currency_id),
                    updated_at = CURRENT_TIMESTAMP
                WHERE name = ? AND institution_type = ?
                """,
                id(marketId),
                id(currencyId),
                name,
                institutionType
        );
        if (updated == 0) {
            try {
                jdbcTemplate.update("""
                        INSERT INTO institutions (id, name, institution_type, market_id, base_currency_id, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """,
                        UUID.randomUUID().toString(),
                        name,
                        institutionType,
                        id(marketId),
                        id(currencyId)
                );
            } catch (DuplicateKeyException ignored) {
                jdbcTemplate.update("""
                        UPDATE institutions
                        SET market_id = COALESCE(?, market_id),
                            base_currency_id = COALESCE(?, base_currency_id),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE name = ? AND institution_type = ?
                        """,
                        id(marketId),
                        id(currencyId),
                        name,
                        institutionType
                );
            }
        }
        return parseUuid(jdbcTemplate.queryForObject("""
                SELECT id FROM institutions WHERE name = ? AND institution_type = ?
                """, String.class, name, institutionType));
    }

    private UUID parseUuid(String raw) {
        return raw == null || raw.isBlank() ? null : UUID.fromString(raw);
    }

    private String id(UUID value) {
        return value == null ? null : value.toString();
    }
}
