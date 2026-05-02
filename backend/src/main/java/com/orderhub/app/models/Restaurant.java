package com.orderhub.app.models;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Document(collection = "restaurants")
public class Restaurant {
    @Id
    private String id;
    private String name;
    private String logoUrl;
    private double deliveryFee;
    private Long ownerUserId;
    private List<MenuCategory> categories;
}
