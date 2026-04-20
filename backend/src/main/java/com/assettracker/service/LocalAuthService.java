package com.assettracker.service;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Locale;

@Service
public class LocalAuthService {

    private final PortfolioMetadataRepository portfolioMetadataRepository;
    private final CurrentUserService currentUserService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);

    public LocalAuthService(PortfolioMetadataRepository portfolioMetadataRepository,
                            CurrentUserService currentUserService) {
        this.portfolioMetadataRepository = portfolioMetadataRepository;
        this.currentUserService = currentUserService;
    }

    public boolean setupRequired() {
        return portfolioMetadataRepository.countLocalUsers() == 0;
    }

    public PortfolioMetadataRepository.UserRecord register(HttpServletRequest request,
                                                           HttpServletResponse response,
                                                           String username,
                                                           String password,
                                                           String email,
                                                           boolean rememberMe) {
        String normalizedUsername = normalizeUsername(username);
        validateCredentials(password);
        try {
            PortfolioMetadataRepository.LocalUserRecord localUser = portfolioMetadataRepository.createLocalUser(
                    normalizedUsername,
                    normalizeNullable(email),
                    normalizedUsername,
                    passwordEncoder.encode(password)
            );
            PortfolioMetadataRepository.UserRecord user = portfolioMetadataRepository.findUserById(localUser.userId())
                    .orElseThrow(() -> new IllegalStateException("Created user not found"));
            currentUserService.setSessionUser(request, response, user, rememberMe);
            return user;
        } catch (DuplicateKeyException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists", exception);
        }
    }

    public PortfolioMetadataRepository.UserRecord login(HttpServletRequest request,
                                                        HttpServletResponse response,
                                                        String username,
                                                        String password,
                                                        boolean rememberMe) {
        String normalizedUsername = normalizeUsername(username);
        PortfolioMetadataRepository.LocalUserRecord localUser = portfolioMetadataRepository.findLocalUserByUsername(normalizedUsername)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));
        if (!passwordEncoder.matches(password, localUser.passwordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }
        PortfolioMetadataRepository.UserRecord user = portfolioMetadataRepository.findUserById(localUser.userId())
                .orElseThrow(() -> new IllegalStateException("User not found"));
        currentUserService.setSessionUser(request, response, user, rememberMe);
        return user;
    }

    public boolean localUserExists(String username) {
        return portfolioMetadataRepository.localUserExists(normalizeUsername(username));
    }

    public void resetPassword(String username, String newPassword) {
        String normalizedUsername = normalizeUsername(username);
        validateCredentials(newPassword);
        if (!portfolioMetadataRepository.localUserExists(normalizedUsername)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Username not found");
        }
        portfolioMetadataRepository.updateLocalUserPassword(
                normalizedUsername,
                passwordEncoder.encode(newPassword)
        );
    }

    private void validateCredentials(String password) {
        if (password == null || password.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Password must be at least 8 characters");
        }
    }

    private String normalizeUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username is required");
        }
        return username.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
