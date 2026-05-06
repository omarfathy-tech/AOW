package com.orderhub.app.repositories;

import com.orderhub.app.models.OrderSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

@Repository
public interface OrderSessionRepository extends JpaRepository<OrderSession, String> {

    List<OrderSession> findByStatus(String status);
    
    List<OrderSession> findByStatusIn(List<String> statuses);
    
    Page<OrderSession> findByStatus(String status, Pageable pageable);

    List<OrderSession> findAllByOrderByCreatedAtDesc();
}
