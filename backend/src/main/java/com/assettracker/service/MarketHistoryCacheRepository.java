package com.assettracker.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class MarketHistoryCacheRepository {

    private final JdbcTemplate jdbcTemplate;

    public MarketHistoryCacheRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<CacheState> loadState(String normalizedSymbol, String marketCode, String intervalCode) {
        List<CacheState> states = jdbcTemplate.query(
                """
                SELECT normalized_symbol, market_code, interval_code, coverage_period, last_bar_time,
                       last_bar_epoch_seconds, last_refreshed_at
                FROM market_history_cache_state
                WHERE normalized_symbol = ? AND market_code = ? AND interval_code = ?
                """,
                (resultSet, rowNum) -> new CacheState(
                        resultSet.getString("normalized_symbol"),
                        resultSet.getString("market_code"),
                        resultSet.getString("interval_code"),
                        resultSet.getString("coverage_period"),
                        resultSet.getString("last_bar_time"),
                        nullableLong(resultSet, "last_bar_epoch_seconds"),
                        resultSet.getString("last_refreshed_at")
                ),
                normalizedSymbol,
                marketCode,
                intervalCode
        );
        return states.stream().findFirst();
    }

    public List<MarketDataProvider.HistoricalBar> loadBars(String normalizedSymbol, String marketCode, String intervalCode) {
        return jdbcTemplate.query(
                """
                SELECT bar_time, open_price, high_price, low_price, close_price
                FROM market_history_cache
                WHERE normalized_symbol = ? AND market_code = ? AND interval_code = ?
                ORDER BY bar_epoch_seconds ASC
                """,
                (resultSet, rowNum) -> new MarketDataProvider.HistoricalBar(
                        resultSet.getString("bar_time"),
                        resultSet.getDouble("open_price"),
                        resultSet.getDouble("high_price"),
                        resultSet.getDouble("low_price"),
                        resultSet.getDouble("close_price")
                ),
                normalizedSymbol,
                marketCode,
                intervalCode
        );
    }

    public void replaceAllBars(String normalizedSymbol,
                               String marketCode,
                               String intervalCode,
                               List<CachedBar> bars) {
        jdbcTemplate.update(
                "DELETE FROM market_history_cache WHERE normalized_symbol = ? AND market_code = ? AND interval_code = ?",
                normalizedSymbol,
                marketCode,
                intervalCode
        );
        insertBars(normalizedSymbol, marketCode, intervalCode, bars);
    }

    public void replaceRange(String normalizedSymbol,
                             String marketCode,
                             String intervalCode,
                             List<CachedBar> bars) {
        if (bars.isEmpty()) {
            return;
        }
        long minEpoch = bars.stream().mapToLong(CachedBar::barEpochSeconds).min().orElseThrow();
        long maxEpoch = bars.stream().mapToLong(CachedBar::barEpochSeconds).max().orElseThrow();
        jdbcTemplate.update(
                """
                DELETE FROM market_history_cache
                WHERE normalized_symbol = ? AND market_code = ? AND interval_code = ?
                  AND bar_epoch_seconds >= ? AND bar_epoch_seconds <= ?
                """,
                normalizedSymbol,
                marketCode,
                intervalCode,
                minEpoch,
                maxEpoch
        );
        insertBars(normalizedSymbol, marketCode, intervalCode, bars);
    }

    public void saveState(String normalizedSymbol,
                          String marketCode,
                          String intervalCode,
                          String coveragePeriod,
                          String lastBarTime,
                          Long lastBarEpochSeconds) {
        jdbcTemplate.update(
                "DELETE FROM market_history_cache_state WHERE normalized_symbol = ? AND market_code = ? AND interval_code = ?",
                normalizedSymbol,
                marketCode,
                intervalCode
        );
        jdbcTemplate.update(
                """
                INSERT INTO market_history_cache_state (
                    normalized_symbol,
                    market_code,
                    interval_code,
                    coverage_period,
                    last_bar_time,
                    last_bar_epoch_seconds,
                    last_refreshed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                normalizedSymbol,
                marketCode,
                intervalCode,
                coveragePeriod,
                lastBarTime,
                lastBarEpochSeconds,
                Instant.now().toString()
        );
    }

    private void insertBars(String normalizedSymbol,
                            String marketCode,
                            String intervalCode,
                            List<CachedBar> bars) {
        jdbcTemplate.batchUpdate(
                """
                INSERT INTO market_history_cache (
                    normalized_symbol,
                    market_code,
                    interval_code,
                    bar_time,
                    bar_epoch_seconds,
                    open_price,
                    high_price,
                    low_price,
                    close_price,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                bars,
                bars.size(),
                (preparedStatement, bar) -> {
                    preparedStatement.setString(1, normalizedSymbol);
                    preparedStatement.setString(2, marketCode);
                    preparedStatement.setString(3, intervalCode);
                    preparedStatement.setString(4, bar.barTime());
                    preparedStatement.setLong(5, bar.barEpochSeconds());
                    preparedStatement.setDouble(6, bar.open());
                    preparedStatement.setDouble(7, bar.high());
                    preparedStatement.setDouble(8, bar.low());
                    preparedStatement.setDouble(9, bar.close());
                    preparedStatement.setString(10, Instant.now().toString());
                }
        );
    }

    private Long nullableLong(ResultSet resultSet, String column) throws SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }

    public record CachedBar(String barTime, long barEpochSeconds, double open, double high, double low, double close) {
    }

    public record CacheState(String normalizedSymbol,
                             String marketCode,
                             String intervalCode,
                             String coveragePeriod,
                             String lastBarTime,
                             Long lastBarEpochSeconds,
                             String lastRefreshedAt) {
    }
}
