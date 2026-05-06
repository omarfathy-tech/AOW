package com.orderhub.app.repositories;

import com.orderhub.app.models.MenuCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MenuCategoryRepository extends JpaRepository<MenuCategory, Long> {
    MenuCategory findByName(String name);
}
