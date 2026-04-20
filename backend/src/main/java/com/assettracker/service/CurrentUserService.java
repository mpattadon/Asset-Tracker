package com.assettracker.service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseCookie;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.assettracker.config.AssetTrackerProperties;

import java.util.Optional;

@Service
public class CurrentUserService {

    public static final String SESSION_EXTERNAL_USER_ID = "asset-tracker.external-user-id";
    public static final String REMEMBER_ME_COOKIE = "asset-tracker.remember-user";
    private static final int REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

    private final PortfolioMetadataRepository portfolioMetadataRepository;
    private final AssetTrackerProperties properties;

    public CurrentUserService(PortfolioMetadataRepository portfolioMetadataRepository,
                              AssetTrackerProperties properties) {
        this.portfolioMetadataRepository = portfolioMetadataRepository;
        this.properties = properties;
    }

    public Optional<PortfolioMetadataRepository.UserRecord> resolveOptionalUser(HttpServletRequest request,
                                                                                String headerUserId) {
        HttpSession session = request == null ? null : request.getSession(false);
        String sessionUserId = session == null ? null : (String) session.getAttribute(SESSION_EXTERNAL_USER_ID);
        if (sessionUserId != null && !sessionUserId.isBlank()) {
            return portfolioMetadataRepository.findUserByExternalId(sessionUserId);
        }
        String rememberedUserId = extractRememberedUserId(request);
        if (rememberedUserId != null && !rememberedUserId.isBlank()) {
            Optional<PortfolioMetadataRepository.UserRecord> rememberedUser =
                    portfolioMetadataRepository.findUserByExternalId(rememberedUserId);
            if (rememberedUser.isPresent() && request != null) {
                request.getSession(true).setAttribute(SESSION_EXTERNAL_USER_ID, rememberedUserId);
            }
            if (rememberedUser.isPresent()) {
                return rememberedUser;
            }
        }
        if (properties.auth().allowDevHeaderUser() && headerUserId != null && !headerUserId.isBlank()) {
            return Optional.of(portfolioMetadataRepository.upsertUser(
                    headerUserId,
                    null,
                    headerUserId,
                    headerUserId.startsWith("google:") ? "google" : "local"
            ));
        }
        return Optional.empty();
    }

    public PortfolioMetadataRepository.UserRecord resolveUser(HttpServletRequest request, String headerUserId) {
        return resolveOptionalUser(request, headerUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required"));
    }

    public void setSessionUser(HttpServletRequest request, PortfolioMetadataRepository.UserRecord user) {
        setSessionUser(request, null, user, false);
    }

    public void setSessionUser(HttpServletRequest request,
                               HttpServletResponse response,
                               PortfolioMetadataRepository.UserRecord user,
                               boolean rememberMe) {
        request.getSession(true).setAttribute(SESSION_EXTERNAL_USER_ID, user.externalUserId());
        if (response != null) {
            if (rememberMe) {
                writeRememberCookie(response, user.externalUserId(), REMEMBER_ME_MAX_AGE_SECONDS);
            } else {
                clearRememberCookie(response);
            }
        }
    }

    public void clearSession(HttpServletRequest request, HttpServletResponse response) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        if (response != null) {
            clearRememberCookie(response);
        }
    }

    public void clearSession(HttpServletRequest request) {
        clearSession(request, null);
    }

    private String extractRememberedUserId(HttpServletRequest request) {
        if (request == null || request.getCookies() == null) {
            return null;
        }
        for (var cookie : request.getCookies()) {
            if (REMEMBER_ME_COOKIE.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private void writeRememberCookie(HttpServletResponse response, String externalUserId, int maxAge) {
        ResponseCookie cookie = ResponseCookie.from(REMEMBER_ME_COOKIE, externalUserId == null ? "" : externalUserId)
                .httpOnly(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAge)
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }

    private void clearRememberCookie(HttpServletResponse response) {
        writeRememberCookie(response, "", 0);
    }
}
