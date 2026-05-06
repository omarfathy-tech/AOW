package com.orderhub.app.controllers;

import com.orderhub.app.dto.ScrapedMenuDTO;
import com.orderhub.app.models.Restaurant;
import com.orderhub.app.services.MenuImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST API for menu scraping operations.
 *
 * Endpoints:
 *
 *   POST /api/menu-import/preview
 *        Body: { "url": "https://www.elmenus.com/..." }
 *        → Returns scraped data WITHOUT saving to DB. Use for testing / review.
 *
 *   POST /api/menu-import/import
 *        Body: { "url": "https://www.elmenus.com/..." }
 *        → Scrapes and saves a NEW restaurant + its full menu to DB.
 *
 *   POST /api/menu-import/refresh/{restaurantId}
 *        → Re-scrapes and updates the menu of an EXISTING restaurant.
 */
@RestController
@RequestMapping("/api/menu-import")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class MenuImportController {

    private final MenuImportService menuImportService;

    /**
     * Preview scraped data — no DB write.
     *
     * POST /api/menu-import/preview
     * {
     *   "url": "https://www.elmenus.com/ar/القاهرة/ابو-مازن-woa5"
     * }
     */
    @PostMapping("/preview")
    public ResponseEntity<ScrapedMenuDTO> preview(@RequestBody Map<String, String> body) {
        String url = requireUrl(body);
        ScrapedMenuDTO result = menuImportService.previewMenu(url);
        return ResponseEntity.ok(result);
    }

    /**
     * Import a new restaurant from its menu URL.
     *
     * POST /api/menu-import/import
     * {
     *   "url": "https://www.elmenus.com/ar/القاهرة/ابو-مازن-woa5"
     * }
     */
    @PostMapping("/import")
    public ResponseEntity<Restaurant> importRestaurant(@RequestBody Map<String, String> body) {
        String url = requireUrl(body);
        Restaurant restaurant = menuImportService.importNewRestaurant(url);
        return ResponseEntity.ok(restaurant);
    }

    /**
     * Refresh the menu of an existing restaurant.
     *
     * POST /api/menu-import/refresh/42
     */
    @PostMapping("/refresh/{restaurantId}")
    public ResponseEntity<Restaurant> refreshMenu(@PathVariable Long restaurantId) {
        Restaurant restaurant = menuImportService.refreshMenu(restaurantId);
        return ResponseEntity.ok(restaurant);
    }

    @PostMapping("/discover")
    public ResponseEntity<Map<String, Object>> discoverAndImport(@RequestBody Map<String, Object> body) {
        String area = body.get("area") != null ? String.valueOf(body.get("area")).trim() : "";
        if (area.isBlank()) {
            throw new IllegalArgumentException("Request body must contain non-empty 'area'");
        }
        int limit = 20;
        Object rawLimit = body.get("limit");
        if (rawLimit instanceof Number n) {
            limit = n.intValue();
        } else if (rawLimit instanceof String s && !s.isBlank()) {
            limit = Integer.parseInt(s.trim());
        }
        Map<String, Object> result = menuImportService.discoverAndImportArea(area, limit);
        return ResponseEntity.ok(result);
    }

    // -----------------------------------------------------------------------
    private String requireUrl(Map<String, String> body) {
        String url = body.get("url");
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("Request body must contain a non-empty 'url' field");
        }
        return url;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(UnsupportedOperationException.class)
    public ResponseEntity<Map<String, String>> handleUnsupported(UnsupportedOperationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntime(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(
            Map.of("error", "Menu provider rejected the request. Try again later or use another link. Details: " + ex.getMessage())
        );
    }
}
