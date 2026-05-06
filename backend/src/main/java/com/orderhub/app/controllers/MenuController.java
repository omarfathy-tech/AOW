package com.orderhub.app.controllers;

import com.orderhub.app.models.Restaurant;
import com.orderhub.app.models.MenuCategory;
import com.orderhub.app.repositories.RestaurantRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/menu")
@CrossOrigin(origins = "*")
public class MenuController {

    @Autowired
    private RestaurantRepository restaurantRepository;

    @GetMapping("/{restaurantId}")
    public Map<String, Object> getMenu(@PathVariable Long restaurantId) {
        Optional<Restaurant> restaurantOpt = restaurantRepository.findById(restaurantId);
        
        Map<String, Object> response = new HashMap<>();
        if (restaurantOpt.isEmpty()) {
            response.put("categories", new HashMap<>());
            return response;
        }

        Restaurant restaurant = restaurantOpt.get();
        Map<String, List<Map<String, Object>>> categories = new LinkedHashMap<>();
        
        if (restaurant.getCategories() != null) {
            for (MenuCategory category : restaurant.getCategories()) {
                List<Map<String, Object>> items = new ArrayList<>();
                for (var item : category.getItems()) {
                    Map<String, Object> itemMap = new HashMap<>();
                    itemMap.put("n", item.getName());
                    itemMap.put("p", item.getPrices());
                    items.add(itemMap);
                }
                categories.put(category.getName(), items);
            }
        }

        response.put("categories", categories);
        return response;
    }
}
