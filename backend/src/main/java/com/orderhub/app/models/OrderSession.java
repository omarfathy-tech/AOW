package com.orderhub.app.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "order_sessions", indexes = {
    @Index(name = "idx_session_status", columnList = "status")
})
public class OrderSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "restaurant_id")
    private Long restaurantId;

    private String sessionName;
    private String openedBy;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PersonOrder> personOrders = new ArrayList<>();

    private double deliveryFee;
    private double total;

    private Double discountPercent = 0.0; // e.g. 10.0 for 10%
    private Double flatDiscountPerUser = 0.0; // e.g. 25.0 for 25 LE off per user

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime closedAt;
    private LocalDateTime sentAt;
    private LocalDateTime deadline;

    private String status = "OPEN"; // OPEN, CLOSED, SENT
}
