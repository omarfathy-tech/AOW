package com.orderhub.app.controllers;

import com.orderhub.app.models.MenuCategory;
import com.orderhub.app.models.MenuItem;
import com.orderhub.app.models.Restaurant;
import com.orderhub.app.repositories.MenuCategoryRepository;
import com.orderhub.app.repositories.MenuItemRepository;
import com.orderhub.app.repositories.RestaurantRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin/menu")
@CrossOrigin(origins = "*")
public class MenuAdminController {

    @Autowired
    private RestaurantRepository restaurantRepository;

    @Autowired
    private MenuCategoryRepository menuCategoryRepository;

    @Autowired
    private MenuItemRepository menuItemRepository;

    @PostMapping("/categories")
    public ResponseEntity<MenuCategory> addCategory(@RequestBody Map<String, Object> payload) {
        Long restaurantId = Long.valueOf(payload.get("restaurantId").toString());
        String name = (String) payload.get("name");

        Optional<Restaurant> restaurantOpt = restaurantRepository.findById(restaurantId);
        if (restaurantOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        MenuCategory category = new MenuCategory();
        category.setName(name);
        category.setRestaurant(restaurantOpt.get());
        MenuCategory saved = menuCategoryRepository.save(category);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/items")
    public ResponseEntity<MenuItem> addItem(@RequestBody Map<String, Object> payload) {
        Long categoryId = Long.valueOf(payload.get("categoryId").toString());
        String name = (String) payload.get("name");
        @SuppressWarnings("unchecked")
        Map<String, Double> prices = (Map<String, Double>) payload.get("prices");

        Optional<MenuCategory> categoryOpt = menuCategoryRepository.findById(categoryId);
        if (categoryOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        MenuItem item = new MenuItem();
        item.setName(name);
        item.setPrices(prices);
        item.setCategory(categoryOpt.get());
        MenuItem saved = menuItemRepository.save(item);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        if (!menuCategoryRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        menuCategoryRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        if (!menuItemRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        menuItemRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<MenuCategory> updateCategory(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Optional<MenuCategory> categoryOpt = menuCategoryRepository.findById(id);
        if (categoryOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        MenuCategory category = categoryOpt.get();
        if (payload.containsKey("name")) {
            category.setName((String) payload.get("name"));
        }
        MenuCategory saved = menuCategoryRepository.save(category);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/items/{id}")
    public ResponseEntity<MenuItem> updateItem(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Optional<MenuItem> itemOpt = menuItemRepository.findById(id);
        if (itemOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        MenuItem item = itemOpt.get();
        if (payload.containsKey("name")) {
            item.setName((String) payload.get("name"));
        }
        if (payload.containsKey("prices")) {
            @SuppressWarnings("unchecked")
            Map<String, Double> prices = (Map<String, Double>) payload.get("prices");
            item.setPrices(prices);
        }
        MenuItem saved = menuItemRepository.save(item);
        return ResponseEntity.ok(saved);
    }
}
