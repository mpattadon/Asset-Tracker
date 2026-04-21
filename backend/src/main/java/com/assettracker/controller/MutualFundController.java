package com.assettracker.controller;

import com.assettracker.model.CreateMutualFundAccountRequest;
import com.assettracker.model.MutualFundAccountView;
import com.assettracker.model.MutualFundDashboardResponse;
import com.assettracker.model.MutualFundMonthlyLogRequest;
import com.assettracker.model.MutualFundPurchaseRequest;
import com.assettracker.model.MutualFundSaleRequest;
import com.assettracker.service.MutualFundService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/mutual-funds")
public class MutualFundController {

    private final MutualFundService mutualFundService;

    public MutualFundController(MutualFundService mutualFundService) {
        this.mutualFundService = mutualFundService;
    }

    @GetMapping("/dashboard")
    public MutualFundDashboardResponse dashboard(HttpServletRequest request,
                                                 @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                 @RequestHeader(value = "X-Preferred-Currency", required = false) String preferredCurrency,
                                                 @RequestParam(name = "bankName", required = false) String bankName,
                                                 @RequestParam(name = "accountId", required = false) String accountId) {
        return mutualFundService.dashboard(request, userId, bankName, accountId, preferredCurrency);
    }

    @GetMapping("/accounts")
    public List<MutualFundAccountView> accounts(HttpServletRequest request,
                                                @RequestHeader(value = "X-User-Id", required = false) String userId) {
        return mutualFundService.accounts(request, userId);
    }

    @PostMapping("/accounts")
    public MutualFundAccountView createAccount(HttpServletRequest request,
                                               @RequestHeader(value = "X-User-Id", required = false) String userId,
                                               @Valid @RequestBody CreateMutualFundAccountRequest payload) {
        return mutualFundService.createAccount(request, userId, payload);
    }

    @PutMapping("/accounts/{accountId}")
    public MutualFundAccountView updateAccount(HttpServletRequest request,
                                               @RequestHeader(value = "X-User-Id", required = false) String userId,
                                               @PathVariable String accountId,
                                               @Valid @RequestBody CreateMutualFundAccountRequest payload) {
        return mutualFundService.updateAccount(request, userId, accountId, payload);
    }

    @DeleteMapping("/accounts/{accountId}")
    public ResponseEntity<Void> deleteAccount(HttpServletRequest request,
                                              @RequestHeader(value = "X-User-Id", required = false) String userId,
                                              @PathVariable String accountId) {
        mutualFundService.deleteAccount(request, userId, accountId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/purchases")
    public ResponseEntity<Void> addPurchase(HttpServletRequest request,
                                            @RequestHeader(value = "X-User-Id", required = false) String userId,
                                            @Valid @RequestBody MutualFundPurchaseRequest payload) {
        mutualFundService.addPurchase(request, userId, payload);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/purchases/{purchaseId}")
    public ResponseEntity<Void> updatePurchase(HttpServletRequest request,
                                               @RequestHeader(value = "X-User-Id", required = false) String userId,
                                               @PathVariable String purchaseId,
                                               @Valid @RequestBody MutualFundPurchaseRequest payload) {
        mutualFundService.updatePurchase(request, userId, purchaseId, payload);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/purchases/{purchaseId}")
    public ResponseEntity<Void> deletePurchase(HttpServletRequest request,
                                               @RequestHeader(value = "X-User-Id", required = false) String userId,
                                               @PathVariable String purchaseId) {
        mutualFundService.deletePurchase(request, userId, purchaseId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/monthly-logs")
    public ResponseEntity<Void> logMonthlyData(HttpServletRequest request,
                                               @RequestHeader(value = "X-User-Id", required = false) String userId,
                                               @Valid @RequestBody MutualFundMonthlyLogRequest payload) {
        mutualFundService.logMonthlyData(request, userId, payload);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sales")
    public ResponseEntity<Void> addSale(HttpServletRequest request,
                                        @RequestHeader(value = "X-User-Id", required = false) String userId,
                                        @Valid @RequestBody MutualFundSaleRequest payload) {
        mutualFundService.addSale(request, userId, payload);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/sales/{saleId}")
    public ResponseEntity<Void> updateSale(HttpServletRequest request,
                                           @RequestHeader(value = "X-User-Id", required = false) String userId,
                                           @PathVariable String saleId,
                                           @Valid @RequestBody MutualFundSaleRequest payload) {
        mutualFundService.updateSale(request, userId, saleId, payload);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/sales/{saleId}")
    public ResponseEntity<Void> deleteSale(HttpServletRequest request,
                                           @RequestHeader(value = "X-User-Id", required = false) String userId,
                                           @PathVariable String saleId) {
        mutualFundService.deleteSale(request, userId, saleId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/monthly-logs/{logId}")
    public ResponseEntity<Void> updateMonthlyData(HttpServletRequest request,
                                                  @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                  @PathVariable String logId,
                                                  @Valid @RequestBody MutualFundMonthlyLogRequest payload) {
        mutualFundService.updateMonthlyLog(request, userId, logId, payload);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/monthly-logs/{logId}")
    public ResponseEntity<Void> deleteMonthlyData(HttpServletRequest request,
                                                  @RequestHeader(value = "X-User-Id", required = false) String userId,
                                                  @PathVariable String logId) {
        mutualFundService.deleteMonthlyLog(request, userId, logId);
        return ResponseEntity.noContent().build();
    }
}
