package com.orderhub.app.models;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PersonOrder {
    private String name;
    private List<Map<String, Object>> items; // flexible item map instead of typed OrderItem
    private double subtotal;
    private String status = "PENDING"; // PENDING, CONFIRMED
    private String notes;
    
    // Payment tracking fields
    private boolean isPaid = false;
    private String paymentMethod; // VODAFONE, INSTAPAY, CASH, null
    private Double amountReceived; // for calculating change on CASH
}
