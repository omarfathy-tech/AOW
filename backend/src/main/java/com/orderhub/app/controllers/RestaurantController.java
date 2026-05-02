package com.orderhub.app.controllers;

import com.orderhub.app.models.Restaurant;
import com.orderhub.app.repositories.RestaurantRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/restaurants")
@CrossOrigin(origins = "*")
public class RestaurantController {

    @Autowired
    private RestaurantRepository restaurantRepository;

    @GetMapping
    public List<Restaurant> getAllRestaurants() {
        return restaurantRepository.findAll();
    }

    @GetMapping("/{id}")
    public Restaurant getRestaurantById(@PathVariable String id) {
        return restaurantRepository.findById(id).orElse(null);
    }

    @GetMapping("/owner/{ownerId}")
    public List<Restaurant> getRestaurantsByOwner(@PathVariable Long ownerId) {
        return restaurantRepository.findByOwnerUserId(ownerId);
    }

    @PostMapping
    public Restaurant createRestaurant(@RequestBody Restaurant restaurant) {
        return restaurantRepository.save(restaurant);
    }

    @PutMapping("/{id}")
    public Restaurant updateRestaurant(@PathVariable String id, @RequestBody Restaurant restaurant) {
        restaurant.setId(id);
        return restaurantRepository.save(restaurant);
    }

    @DeleteMapping("/{id}")
    public void deleteRestaurant(@PathVariable String id) {
        restaurantRepository.deleteById(id);
    }
}
