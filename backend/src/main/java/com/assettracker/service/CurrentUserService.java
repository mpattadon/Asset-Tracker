package com.assettracker.service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.assettracker.config.AssetTrackerProperties;

import java.util.Optional;

@Service
public class CurrentUserService {

    public static final String SESSION_EXTERNAL_USER_ID = "asset-tracker.external-user-id";

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
        request.getSession(true).setAttribute(SESSION_EXTERNAL_USER_ID, user.externalUserId());
    }

    public void clearSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }
}
