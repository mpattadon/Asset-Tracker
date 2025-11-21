package com.assettracker.model;

import java.util.List;

public record ExpensesData(List<ExpenseItem> monthly, List<ExpenseItem> yearly, String runway) {
    public record ExpenseItem(String name, String amount, String renewal) {
    }
}
