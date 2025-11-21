package com.assettracker.model;

public record LotteryEntry(String draw, int tickets, String committed, String estPayout) {
}
