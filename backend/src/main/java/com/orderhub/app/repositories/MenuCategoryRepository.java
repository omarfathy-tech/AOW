package com.orderhub.app.repositories;

import com.orderhub.app.models.MenuCategory;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MenuCategoryRepository extends MongoRepository<MenuCategory, String> {
    MenuCategory findByName(String name);
}
