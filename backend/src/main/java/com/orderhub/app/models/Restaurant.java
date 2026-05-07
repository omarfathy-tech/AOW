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
    private String cuisineType; // PITZA, BURGER, CHICKEN, PIZZA, OTHER
    private String description;
    private double deliveryFee;
    private String phone; // Restaurant phone number for calling
    private Long ownerUserId;
    private Boolean available = true;

    @Column(name = "order_mode", length = 20)
    private String orderMode = "MENU"; // MENU, TEXT, PIZZA

    @Column(name = "menu_url", length = 500)
    private String menuUrl; // External menu link e.g. menuegypt.com/...

    @OneToMany(mappedBy = "restaurant", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MenuCategory> categories;
}
