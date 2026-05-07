package com.orderhub.app.models;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "person_orders")
public class PersonOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(columnDefinition = "JSON")
    @Convert(converter = JsonConverter.class)
    private List<Map<String, Object>> items; // JSON storage in MySQL

    private double subtotal;
    private String status = "PENDING"; // PENDING, CONFIRMED
    private String notes;
    private String textOrder; // For TEXT mode restaurants (free-form order text)
    
    // Discount fields (per-user)
    private Double discountPercent = 0.0;
    private Double flatDiscountPerUser = 0.0;

    // Payment tracking fields
    private boolean isPaid = false;
    private String paymentMethod; // VODAFONE, INSTAPAY, CASH, null
    private Double amountReceived; // for calculating change on CASH

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", columnDefinition = "VARCHAR(36)")
    @JsonIgnore
    private OrderSession session;
}
