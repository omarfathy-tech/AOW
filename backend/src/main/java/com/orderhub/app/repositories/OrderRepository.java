package com.orderhub.app.repositories;

import com.orderhub.app.models.Order;
import com.orderhub.app.models.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserId(Long userId);
    Page<Order> findByUserId(Long userId, Pageable pageable);
    List<Order> findByRestaurantId(Long restaurantId);
    Page<Order> findByRestaurantId(Long restaurantId, Pageable pageable);
    List<Order> findBySessionId(String sessionId);
    List<Order> findByStatus(OrderStatus status);
    List<Order> findByUserIdAndStatus(Long userId, OrderStatus status);
    List<Order> findByRestaurantIdAndStatus(Long restaurantId, OrderStatus status);
}
