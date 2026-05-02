package com.orderhub.app.models;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class MenuItem {
    private String name; // name
    private Map<String, Double> prices; // prices by size
}
