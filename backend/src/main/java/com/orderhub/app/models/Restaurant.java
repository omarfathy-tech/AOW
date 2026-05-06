package com.orderhub.app.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "restaurants")
public class Restaurant {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String name;
    private String logoUrl;
    private String cuisineType;
    private String description;
    private double deliveryFee;
    private Long ownerUserId;
    private Boolean available = true;

    @Column(name = "order_mode", length = 20)
    private String orderMode = "MENU"; // MENU or TEXT

    @OneToMany(mappedBy = "restaurant", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MenuCategory> categories;
}
