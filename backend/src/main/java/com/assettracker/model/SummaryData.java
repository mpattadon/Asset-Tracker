package com.assettracker.model;

import java.util.List;

public record SummaryData(List<SummaryCard> cards, List<AllocationItem> allocation) {
    public record SummaryCard(String label, String value, String delta) {
    }

    public record AllocationItem(String area, int percent, String color) {
    }
}
