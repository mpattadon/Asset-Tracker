package com.assettracker.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.dao.DuplicateKeyException;

import java.sql.Date;
import java.time.LocalDate;
import java.util.Optional;

@Service
public class FxRateService {

    private final JdbcTemplate jdbcTemplate;
    private final ReferenceDataService referenceDataService;
    private final FxRateProvider fxRateProvider;

    public FxRateService(JdbcTemplate jdbcTemplate,
                         ReferenceDataService referenceDataService,
                         FxRateProvider fxRateProvider) {
        this.jdbcTemplate = jdbcTemplate;
        this.referenceDataService = referenceDataService;
        this.fxRateProvider = fxRateProvider;
    }

    public double latestRate(String baseCurrencyCode, String quoteCurrencyCode) {
        if (baseCurrencyCode == null || quoteCurrencyCode == null
                || baseCurrencyCode.equalsIgnoreCase(quoteCurrencyCode)) {
            return 1;
        }

        Optional<Double> storedToday = jdbcTemplate.query("""
                        SELECT rate
                        FROM fx_rates
                        WHERE base_currency_id = ?
                          AND quote_currency_id = ?
                          AND rate_date = ?
                        ORDER BY created_at DESC
                        LIMIT 1
                        """,
                (rs, rowNum) -> rs.getDouble("rate"),
                id(referenceDataService.currencyId(baseCurrencyCode)),
                id(referenceDataService.currencyId(quoteCurrencyCode)),
                Date.valueOf(LocalDate.now())
        ).stream().findFirst();
        if (storedToday.isPresent()) {
            return storedToday.get();
        }

        FxRateProvider.FxRateQuote rateQuote = fxRateProvider.latestRate(baseCurrencyCode, quoteCurrencyCode)
                .orElseThrow(() -> new IllegalStateException("Unable to resolve FX rate for "
                        + baseCurrencyCode + " -> " + quoteCurrencyCode));
        upsertFxRate(baseCurrencyCode, quoteCurrencyCode, rateQuote.rate(), rateQuote.sourceName(), LocalDate.now());
        return rateQuote.rate();
    }

    private void upsertFxRate(String baseCurrencyCode,
                              String quoteCurrencyCode,
                              double rate,
                              String sourceName,
                              LocalDate rateDate) {
        var baseCurrencyId = referenceDataService.currencyId(baseCurrencyCode);
        var quoteCurrencyId = referenceDataService.currencyId(quoteCurrencyCode);
        int updated = jdbcTemplate.update("""
                UPDATE fx_rates
                SET rate = ?
                WHERE base_currency_id = ?
                  AND quote_currency_id = ?
                  AND rate_date = ?
                  AND source_name = ?
                """,
                rate,
                id(baseCurrencyId),
                id(quoteCurrencyId),
                Date.valueOf(rateDate),
                sourceName
        );
        if (updated == 0) {
            try {
                jdbcTemplate.update("""
                        INSERT INTO fx_rates
                            (id, base_currency_id, quote_currency_id, rate_date, rate, source_name, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        """,
                        java.util.UUID.randomUUID().toString(),
                        id(baseCurrencyId),
                        id(quoteCurrencyId),
                        Date.valueOf(rateDate),
                        rate,
                        sourceName
                );
            } catch (DuplicateKeyException ignored) {
                jdbcTemplate.update("""
                        UPDATE fx_rates
                        SET rate = ?
                        WHERE base_currency_id = ?
                          AND quote_currency_id = ?
                          AND rate_date = ?
                          AND source_name = ?
                        """,
                        rate,
                        id(baseCurrencyId),
                        id(quoteCurrencyId),
                        Date.valueOf(rateDate),
                        sourceName
                );
            }
        }
    }

    private String id(java.util.UUID value) {
        return value == null ? null : value.toString();
    }
}
