package com.assettracker.service;

import com.assettracker.model.QuoteResult;

import java.util.List;
import java.util.Optional;

public interface QuoteProvider {
    Optional<QuoteResult> lookup(String symbol, String market);

    List<QuoteResult> search(String query, String market, List<String> types);
}
