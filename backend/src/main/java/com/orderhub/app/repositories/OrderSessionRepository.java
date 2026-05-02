package com.orderhub.app.repositories;

import com.orderhub.app.models.OrderSession;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Fix: Added findByStatus(String status) so the active/status endpoint
 * can query SENT sessions without loading ALL sessions with findAll()
 * and filtering in Java — which was causing a full collection scan.
 */
@Repository
public interface OrderSessionRepository extends MongoRepository<OrderSession, String> {

    List<OrderSession> findByStatus(String status);
    
    Page<OrderSession> findByStatus(String status, Pageable pageable);

    // Useful for the admin history endpoint — newest first
    List<OrderSession> findAllByOrderByCreatedAtDesc();
}
