package com.orderhub.app.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "order_items", indexes = {
    @Index(name = "idx_order_items_order", columnList = "order_id")
})
public class OrderLineItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", insertable = false, updatable = false)
    private Long orderId;

    @Column(name = "item_id")
    private String itemId; // MongoDB menu item reference

    @Column(name = "item_name", nullable = false)
    private String itemName;

    private String size;

    @Column(columnDefinition = "TEXT")
    private String extras; // JSON string of selected extras

    @Column(nullable = false)
    @Builder.Default
    private int quantity = 1;

    @Column(name = "unit_price", nullable = false)
    private double unitPrice;
}
