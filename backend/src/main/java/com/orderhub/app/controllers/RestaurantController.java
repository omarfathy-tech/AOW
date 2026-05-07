package com.orderhub.app.controllers;

import com.orderhub.app.models.MenuCategory;
import com.orderhub.app.models.MenuItem;
import com.orderhub.app.models.Restaurant;
import com.orderhub.app.repositories.RestaurantRepository;
import com.orderhub.app.services.MenuImportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import lombok.extern.slf4j.Slf4j;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/restaurants")
@CrossOrigin(origins = "*")
@Slf4j
public class RestaurantController {

    @Autowired
    private RestaurantRepository restaurantRepository;

    @Autowired
    private MenuImportService menuImportService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @GetMapping
    public List<Restaurant> getAllRestaurants() {
        return restaurantRepository.findAll();
    }

    @GetMapping("/{id}")
    public Restaurant getRestaurantById(@PathVariable Long id) {
        return restaurantRepository.findById(id).orElse(null);
    }

    @GetMapping("/owner/{ownerId}")
    public List<Restaurant> getRestaurantsByOwner(@PathVariable Long ownerId) {
        return restaurantRepository.findByOwnerUserId(ownerId);
    }

    @PostMapping
    public Restaurant createRestaurant(@RequestBody Restaurant restaurant) {
        // Auto-import menu/categories when menu URL exists and restaurant is menu-based
        boolean shouldAutoImport = restaurant.getMenuUrl() != null
            && !restaurant.getMenuUrl().isBlank()
            && (restaurant.getOrderMode() == null || !"TEXT".equalsIgnoreCase(restaurant.getOrderMode()));

        Restaurant saved;
        boolean autoImported = false;
        if (shouldAutoImport) {
            try {
                // Import first while creating restaurant, then apply admin-entered overrides.
                saved = menuImportService.importNewRestaurant(restaurant.getMenuUrl());
                applyManualOverrides(saved, restaurant);
                saved = restaurantRepository.save(saved);
                autoImported = true;
            } catch (Exception e) {
                // Keep restaurant creation successful even if external provider is temporarily unavailable.
                // Admin can retry import from the management panel.
                log.warn("Auto-import on create failed for url {}: {}", restaurant.getMenuUrl(), e.getMessage());
                saved = restaurantRepository.save(restaurant);
            }
        } else {
            saved = restaurantRepository.save(restaurant);
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "RESTAURANT_ADDED");
        payload.put("restaurantId", saved.getId());
        payload.put("restaurantName", saved.getName());
        payload.put("message", "New restaurant added: " + saved.getName());
        payload.put("autoImportRequested", shouldAutoImport);
        payload.put("autoImported", autoImported);
        messagingTemplate.convertAndSend("/topic/notifications", payload);

        return saved;
    }

    private void applyManualOverrides(Restaurant target, Restaurant source) {
        // Preserve scraped menu/categories, but allow admin form to override core metadata.
        if (source.getName() != null && !source.getName().isBlank()) target.setName(source.getName());
        if (source.getLogoUrl() != null && !source.getLogoUrl().isBlank()) target.setLogoUrl(source.getLogoUrl());
        if (source.getCuisineType() != null && !source.getCuisineType().isBlank()) target.setCuisineType(source.getCuisineType());
        if (source.getDescription() != null) target.setDescription(source.getDescription());
        target.setDeliveryFee(source.getDeliveryFee());
        if (source.getOwnerUserId() != null) target.setOwnerUserId(source.getOwnerUserId());
        if (source.getAvailable() != null) target.setAvailable(source.getAvailable());
        if (source.getOrderMode() != null && !source.getOrderMode().isBlank()) target.setOrderMode(source.getOrderMode());
    }

    @PutMapping("/{id}")
    public Restaurant updateRestaurant(@PathVariable Long id, @RequestBody Restaurant restaurant) {
        Restaurant existing = restaurantRepository.findById(id).orElseThrow();
        
        // Update metadata
        existing.setName(restaurant.getName());
        existing.setLogoUrl(restaurant.getLogoUrl());
        existing.setCuisineType(restaurant.getCuisineType());
        existing.setDescription(restaurant.getDescription());
        existing.setDeliveryFee(restaurant.getDeliveryFee());
        existing.setPhone(restaurant.getPhone());
        existing.setOwnerUserId(restaurant.getOwnerUserId());
        existing.setAvailable(restaurant.getAvailable());
        existing.setOrderMode(restaurant.getOrderMode());
        existing.setMenuUrl(restaurant.getMenuUrl());

        // Only update categories if provided
        if (restaurant.getCategories() != null) {
            existing.getCategories().clear();
            for (MenuCategory category : restaurant.getCategories()) {
                category.setRestaurant(existing);
                if (category.getItems() != null) {
                    for (MenuItem item : category.getItems()) {
                        item.setCategory(category);
                    }
                }
                existing.getCategories().add(category);
            }
        }
        
        return restaurantRepository.save(existing);
    }

    @DeleteMapping("/{id}")
    public void deleteRestaurant(@PathVariable Long id) {
        restaurantRepository.deleteById(id);
    }
}
