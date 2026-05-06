package com.orderhub.app.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Intermediate DTO holding scraped restaurant + menu data before it is
 * persisted as JPA entities.
 *
 * Flow:
 *   External URL  →  MenuScraperService  →  ScrapedMenuDTO  →  Restaurant / MenuCategory / MenuItem
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScrapedMenuDTO {

    /** URL that was actually called to get this data */
    private String sourceUrl;

    // --- Restaurant-level fields ---
    private String restaurantName;
    private String logoUrl;
    private String cuisineType;     // e.g. "SHAWARMA", "PIZZA", "OTHER"
    private String description;
    private Double deliveryFee;

    // --- Menu structure ---
    private List<CategoryDTO> categories;

    // ---------------------------------------------------------------
    // Nested: Category
    // ---------------------------------------------------------------
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryDTO {
        private String name;
        private List<ItemDTO> items;
    }

    // ---------------------------------------------------------------
    // Nested: Item
    // ---------------------------------------------------------------
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ItemDTO {
        private String name;
        private String description;
        private String imageUrl;

        /**
         * Key   = size/variant name (e.g. "عادي", "كبير", "Standard")
         * Value = price in local currency
         *
         * Single-price items have one entry with key "Standard".
         */
        private Map<String, Double> prices;
    }
}
