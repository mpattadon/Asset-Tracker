package com.assettracker.controller;

import com.assettracker.service.CurrentUserService;
import com.assettracker.service.LocalAuthService;
import com.assettracker.service.PortfolioMetadataRepository;
import com.assettracker.service.PortfolioSyncService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final CurrentUserService currentUserService;
    private final PortfolioSyncService portfolioSyncService;
    private final LocalAuthService localAuthService;

    public AuthController(CurrentUserService currentUserService,
                          PortfolioSyncService portfolioSyncService,
                          LocalAuthService localAuthService) {
        this.currentUserService = currentUserService;
        this.portfolioSyncService = portfolioSyncService;
        this.localAuthService = localAuthService;
    }

    @GetMapping("/bootstrap")
    public AuthStateResponse bootstrap(HttpServletRequest request,
                                       @RequestHeader(value = "X-User-Id", required = false) String userIdHeader) {
        return buildState(currentUserService.resolveOptionalUser(request, userIdHeader));
    }

    @PostMapping("/register/local")
    public AuthStateResponse registerLocal(HttpServletRequest request,
                                           HttpServletResponse response,
                                           @RequestBody LocalRegisterRequest registerRequest) {
        PortfolioMetadataRepository.UserRecord user = localAuthService.register(
                request,
                response,
                registerRequest.username(),
                registerRequest.password(),
                registerRequest.email(),
                Boolean.TRUE.equals(registerRequest.rememberMe())
        );
        portfolioSyncService.ensureSynchronized(user);
        return buildState(Optional.of(user));
    }

    @PostMapping("/login/local")
    public AuthStateResponse loginLocal(HttpServletRequest request,
                                        HttpServletResponse response,
                                        @RequestBody LocalLoginRequest loginRequest) {
        PortfolioMetadataRepository.UserRecord user = localAuthService.login(
                request,
                response,
                loginRequest.username(),
                loginRequest.password(),
                Boolean.TRUE.equals(loginRequest.rememberMe())
        );
        portfolioSyncService.ensureSynchronized(user);
        return buildState(Optional.of(user));
    }

    @PostMapping("/logout")
    public AuthStateResponse logout(HttpServletRequest request, HttpServletResponse response) {
        currentUserService.clearSession(request, response);
        return buildState(Optional.empty());
    }

    @PostMapping("/password-reset/local/check")
    public UsernameLookupResponse checkUsername(@RequestBody UsernameLookupRequest lookupRequest) {
        return new UsernameLookupResponse(localAuthService.localUserExists(lookupRequest.username()));
    }

    @PostMapping("/password-reset/local")
    public PasswordResetResponse resetLocalPassword(@RequestBody LocalPasswordResetRequest resetRequest) {
        localAuthService.resetPassword(resetRequest.username(), resetRequest.password());
        return new PasswordResetResponse(true);
    }

    private AuthStateResponse buildState(Optional<PortfolioMetadataRepository.UserRecord> user) {
        PortfolioSyncService.SyncStatus syncStatus = user.map(portfolioSyncService::syncStatus).orElse(null);
        return new AuthStateResponse(
                localAuthService.setupRequired(),
                user.isPresent(),
                user.map(PortfolioMetadataRepository.UserRecord::authProvider).orElse(null),
                user.map(PortfolioMetadataRepository.UserRecord::externalUserId).orElse(null),
                user.map(PortfolioMetadataRepository.UserRecord::email).orElse(null),
                user.map(PortfolioMetadataRepository.UserRecord::displayName).orElse(null),
                syncStatus
        );
    }

    public record AuthStateResponse(boolean setupRequired,
                                    boolean authenticated,
                                    String authProvider,
                                    String externalUserId,
                                    String email,
                                    String displayName,
                                    PortfolioSyncService.SyncStatus syncStatus) {
    }

    public record LocalRegisterRequest(
            @NotBlank String username,
            @Size(min = 8) String password,
            @Email String email,
            Boolean rememberMe) {
    }

    public record LocalLoginRequest(@NotBlank String username, @NotBlank String password, Boolean rememberMe) {
    }

    public record UsernameLookupRequest(@NotBlank String username) {
    }

    public record UsernameLookupResponse(boolean found) {
    }

    public record LocalPasswordResetRequest(@NotBlank String username, @Size(min = 8) String password) {
    }

    public record PasswordResetResponse(boolean success) {
    }
}
