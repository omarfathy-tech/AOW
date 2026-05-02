package com.orderhub.app.repositories;

import com.orderhub.app.models.Restaurant;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RestaurantRepository extends MongoRepository<Restaurant, String> {
    List<Restaurant> findByOwnerUserId(Long ownerUserId);
}
