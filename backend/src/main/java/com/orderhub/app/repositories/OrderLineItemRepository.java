package com.orderhub.app.repositories;

import com.orderhub.app.models.OrderLineItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderLineItemRepository extends JpaRepository<OrderLineItem, Long> {
    List<OrderLineItem> findByOrderId(Long orderId);
}
