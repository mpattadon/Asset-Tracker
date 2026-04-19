package com.assettracker.service;

import com.assettracker.model.QuoteResult;

import java.util.List;
import java.util.Optional;

public interface QuoteProvider {
    Optional<QuoteResult> lookup(PortfolioMetadataRepository.UserRecord user, String symbol, String market);

    List<QuoteResult> search(PortfolioMetadataRepository.UserRecord user, String query, String market, List<String> types);
}
