package com.orderhub.app.models;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * CHANGES FROM ORIGINAL:
 *
 * 1. REMOVED @Version — this was the root cause of the DuplicateKeyException.
 *    Spring Data MongoDB's save() uses the @Version field to decide insert vs
 *    update. When version=null (new object) it always does INSERT. When the
 *    frontend retried a failed order submission, the session was re-fetched
 *    (version=0), then save() saw version=0 as "new" and tried to INSERT,
 *    hitting the duplicate _id constraint.
 *
 *    We no longer need @Version because SessionController now uses MongoTemplate
 *    atomic $pull/$push/$set operations instead of save(). There is no
 *    "read-modify-write" cycle to protect anymore.
 *
 * 2. Added @Indexed on status — the polling endpoint queries by status every
 *    5 seconds per client. Without an index this is a full collection scan.
 *    Add this index in MongoDB too:
 *      db.order_sessions.createIndex({ status: 1 })
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@Document(collection = "order_sessions")
public class OrderSession {

    @Id
    private String id;

    private String restaurantId;
    private String sessionName;
    private String openedBy;

    private List<PersonOrder> personOrders = new ArrayList<>();

    private double deliveryFee;
    private double total;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime closedAt;
    private LocalDateTime sentAt;
    private LocalDateTime deadline;

    @Indexed  // index this — it's queried on every poll
    private String status = "OPEN"; // OPEN, CLOSED, SENT

    // @Version REMOVED — was causing DuplicateKeyException on concurrent saves.
    // Concurrency is now handled by atomic MongoTemplate operations in SessionController.
}
