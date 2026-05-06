package com.orderhub.app.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Low-level HTTP client for elmenus' internal API.
 *
 * Responsibilities:
 *  - Manages a session token (elmenus may require a guest auth token)
 *  - Adds all required headers
 *  - Handles 401 → re-auth → retry
 *
 * HOW TO FIND THE REAL API ENDPOINTS:
 * ─────────────────────────────────────
 * 1. Open Chrome DevTools → Network tab → filter by "Fetch/XHR"
 * 2. Navigate to any elmenus restaurant page
 * 3. Look for requests to api.elmenus.com or similar
 * 4. Copy the request URL, headers, and any Authorization token
 * 5. Update ELMENUS_API_BASE and the auth logic below accordingly
 *
 * If elmenus requires an API key:
 *  - Add `elmenus.api.key=YOUR_KEY` to application.properties
 *  - Inject it via @Value (see field below)
 */
@Slf4j
@Component
public class ElmenusApiClient {

    // Set in application.properties if elmenus provides an API key
    @Value("${elmenus.api.key:}")
    private String apiKey;

    // If elmenus uses a guest token system, store it here
    private final AtomicReference<String> sessionToken = new AtomicReference<>(null);

    private static final String ELMENUS_API_BASE  = "https://api.elmenus.com/api/v1";
    private static final List<String> ELMENUS_API_BASE_CANDIDATES = List.of(
        "https://api.elmenus.com/api/v1",
        "https://www.elmenus.com/api/v1",
        "https://elmenus.com/api/v1"
    );

    private final HttpClient httpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NORMAL)
        .connectTimeout(Duration.ofSeconds(15))
        .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Fetches restaurant info from elmenus.
     * Endpoint pattern: GET /api/v1/restaurants/{slug}
     */
    public JsonNode getRestaurantInfo(String slug) throws Exception {
        return getWithFallbackBases("/restaurants/" + slug);
    }

    /**
     * Fetches the full menu for a restaurant.
     * Endpoint pattern: GET /api/v1/restaurants/{slug}/menu
     */
    public JsonNode getRestaurantMenu(String slug) throws Exception {
        return getWithFallbackBases("/restaurants/" + slug + "/menu");
    }

    public String getRestaurantPageHtml(String menuUrl) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(menuUrl))
            .timeout(Duration.ofSeconds(25))
            .GET()
            .header("User-Agent",      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
            .header("Accept",          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .header("Accept-Language", "ar,en;q=0.9")
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new RuntimeException("HTTP " + response.statusCode() + " for page: " + menuUrl);
        }
        return response.body();
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private JsonNode getWithFallbackBases(String path) throws Exception {
        Exception last = null;
        for (String base : ELMENUS_API_BASE_CANDIDATES) {
            String url = base + path;
            try {
                return getWithRetry(url);
            } catch (Exception e) {
                last = e;
                log.warn("Elmenus request failed on base {}: {}", base, describeException(e));
            }
        }
        if (last != null) throw last;
        throw new RuntimeException("Unable to fetch from elmenus API");
    }

    private String describeException(Exception e) {
        if (e == null) return "Unknown exception";
        String msg = e.getMessage();
        if (msg != null && !msg.isBlank()) return msg;
        Throwable cause = e.getCause();
        if (cause != null && cause.getMessage() != null && !cause.getMessage().isBlank()) {
            return e.getClass().getSimpleName() + ": " + cause.getMessage();
        }
        return e.getClass().getSimpleName();
    }

    private JsonNode getWithRetry(String url) throws Exception {
        try {
            return doGet(url);
        } catch (UnauthorizedException | ForbiddenException e) {
            log.info("Got {}, refreshing session token and retrying...", e.getClass().getSimpleName());
            refreshSessionToken();
            return doGet(url);  // retry once
        }
    }

    private JsonNode doGet(String url) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(20))
            .GET()
            .header("User-Agent",      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
            .header("Accept",          "application/json")
            .header("Accept-Language", "ar,en;q=0.9")
            .header("Referer",         "https://www.elmenus.com/")
            .header("Origin",          "https://www.elmenus.com");

        // Add auth token if available
        String token = sessionToken.get();
        if (token != null && !token.isBlank()) {
            builder.header("Authorization", "Bearer " + token);
        }

        // Add API key if configured
        if (apiKey != null && !apiKey.isBlank()) {
            builder.header("X-Api-Key", apiKey);
        }

        HttpResponse<String> response = httpClient.send(
            builder.build(), HttpResponse.BodyHandlers.ofString()
        );

        log.debug("GET {} → HTTP {}", url, response.statusCode());

        if (response.statusCode() == 401) {
            throw new UnauthorizedException("401 from " + url);
        }
        if (response.statusCode() == 403) {
            throw new ForbiddenException("403 from " + url);
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String bodySnippet = response.body() == null ? "" : response.body();
            if (bodySnippet.length() > 240) {
                bodySnippet = bodySnippet.substring(0, 240) + "...";
            }
            throw new RuntimeException("HTTP " + response.statusCode() + " for: " + url + " body=" + bodySnippet);
        }

        return objectMapper.readTree(response.body());
    }

    /**
     * Gets a guest session token from elmenus (if their API requires it).
     * Adjust this method based on actual auth flow observed in DevTools.
     */
    private void refreshSessionToken() throws Exception {
        String authUrl = ELMENUS_API_BASE + "/auth/guest";
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(authUrl))
            .POST(HttpRequest.BodyPublishers.ofString("{}"))
            .header("Content-Type", "application/json")
            .header("User-Agent", "Mozilla/5.0")
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 200) {
            JsonNode body = objectMapper.readTree(response.body());
            String token = body.path("data").path("token").asText(null);
            if (token != null) {
                sessionToken.set(token);
                log.info("Obtained new elmenus session token");
            }
        } else {
            log.warn("Could not get elmenus session token, will proceed without auth");
        }
    }

    private static class UnauthorizedException extends RuntimeException {
        UnauthorizedException(String msg) { super(msg); }
    }

    private static class ForbiddenException extends RuntimeException {
        ForbiddenException(String msg) { super(msg); }
    }
}
