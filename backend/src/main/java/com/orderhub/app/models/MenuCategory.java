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
@Document(collection = "menu_categories")
public class MenuCategory {
    @Id
    private String id;
    private String name;
    private List<MenuItem> items;
}
