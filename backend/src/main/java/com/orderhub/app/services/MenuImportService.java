package com.orderhub.app.services;

import com.orderhub.app.dto.ScrapedMenuDTO;
import com.orderhub.app.models.Restaurant;
import com.orderhub.app.repositories.RestaurantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * High-level service that combines scraping + persistence.
 *
 * Usage examples:
 *
 *   // Import a completely new restaurant from a menu URL
 *   Restaurant saved = menuImportService.importNewRestaurant("https://www.elmenus.com/.../ابو-مازن-woa5");
 *
 *   // Refresh the menu of an existing restaurant
 *   menuImportService.refreshMenu(restaurantId);
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MenuImportService {

    private final MenuScraperService scraperService;
    private final RestaurantRepository restaurantRepository;

    // ---------------------------------------------------------------
    // Import a brand-new restaurant from its menu URL
    // ---------------------------------------------------------------

    @Transactional
    public Restaurant importNewRestaurant(String menuUrl) {
        log.info("Importing new restaurant from: {}", menuUrl);

        // Scrape data
        ScrapedMenuDTO scraped = scraperService.scrapeMenu(menuUrl);

        // Build a new Restaurant entity from scraped data
        Restaurant restaurant = new Restaurant();
        restaurant.setMenuUrl(menuUrl);
        restaurant.setOrderMode("MENU");
        restaurant.setAvailable(true);

        // Apply scraped data
        scraperService.applyScrapedMenuToRestaurant(restaurant);

        Restaurant saved = restaurantRepository.save(restaurant);
        log.info("Saved new restaurant id={} name='{}'", saved.getId(), saved.getName());
        return saved;
    }

    // ---------------------------------------------------------------
    // Refresh the menu of an existing restaurant
    // ---------------------------------------------------------------

    @Transactional
    public Restaurant refreshMenu(Long restaurantId) {
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
            .orElseThrow(() -> new IllegalArgumentException("Restaurant not found: " + restaurantId));

        if (restaurant.getMenuUrl() == null || restaurant.getMenuUrl().isBlank()) {
            throw new IllegalStateException(
                "Restaurant " + restaurantId + " has no menuUrl set — cannot refresh."
            );
        }

        log.info("Refreshing menu for restaurant id={} from: {}", restaurantId, restaurant.getMenuUrl());

        // Clear old categories (orphanRemoval=true will delete them)
        if (restaurant.getCategories() != null) {
            restaurant.getCategories().clear();
        }

        // Re-scrape and apply
        scraperService.applyScrapedMenuToRestaurant(restaurant);

        Restaurant saved = restaurantRepository.save(restaurant);
        log.info("Menu refreshed: {} categories", saved.getCategories().size());
        return saved;
    }

    // ---------------------------------------------------------------
    // Preview only (no DB write)
    // ---------------------------------------------------------------

    public ScrapedMenuDTO previewMenu(String menuUrl) {
        return scraperService.scrapeMenu(menuUrl);
    }

    @Transactional
    public Map<String, Object> discoverAndImportArea(String area, int limit) {
        List<String> urls = scraperService.discoverElmenusRestaurantUrls(area, limit);
        List<Map<String, Object>> imported = new ArrayList<>();
        List<Map<String, String>> failed = new ArrayList<>();

        for (String url : urls) {
            try {
                Restaurant saved = importNewRestaurant(url);
                imported.add(Map.of(
                    "id", saved.getId(),
                    "name", saved.getName(),
                    "url", url,
                    "categories", saved.getCategories() != null ? saved.getCategories().size() : 0
                ));
            } catch (Exception e) {
                failed.add(Map.of(
                    "url", url,
                    "error", e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()
                ));
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("area", area);
        summary.put("requestedLimit", limit);
        summary.put("discovered", urls.size());
        summary.put("importedCount", imported.size());
        summary.put("failedCount", failed.size());
        summary.put("imported", imported);
        summary.put("failed", failed);
        return summary;
    }
}
