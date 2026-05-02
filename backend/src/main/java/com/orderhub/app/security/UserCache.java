package com.orderhub.app.security;

import com.orderhub.app.models.User;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * In-memory cache for authenticated users.
 *
 * WHY THIS EXISTS:
 * The JWT filter was hitting MySQL with SELECT * FROM users WHERE username=?
 * on EVERY request — including the polling endpoint that fires every 5 seconds
 * per connected client. With 5-10 users polling every 5s, that's 6-12 DB
 * queries/second just for auth. This cache stores the loaded User for 5
 * minutes, cutting DB load by ~99% for active sessions.
 *
 * SAFETY: Entries expire after 5 minutes, so password changes and role
 * updates propagate within that window. The cache is cleared on logout.
 * For an office lunch app with <50 users this is more than sufficient.
 */
@Component
public class UserCache {

    private static final long TTL_MINUTES = 5;

    private record CacheEntry(User user, long expiresAt) {
        boolean isExpired() {
            return System.currentTimeMillis() > expiresAt;
        }
    }

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    // Background thread to evict expired entries every 10 minutes
    private final ScheduledExecutorService evictionScheduler =
        Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "user-cache-eviction");
            t.setDaemon(true);
            return t;
        });

    public UserCache() {
        evictionScheduler.scheduleAtFixedRate(
            this::evictExpired, 10, 10, TimeUnit.MINUTES
        );
    }

    public void put(String username, User user) {
        long expiresAt = System.currentTimeMillis() + TTL_MINUTES * 60 * 1000;
        cache.put(username, new CacheEntry(user, expiresAt));
    }

    public User get(String username) {
        CacheEntry entry = cache.get(username);
        if (entry == null) return null;
        if (entry.isExpired()) {
            cache.remove(username);
            return null;
        }
        return entry.user();
    }

    public void evict(String username) {
        cache.remove(username);
    }

    public void evictExpired() {
        cache.entrySet().removeIf(e -> e.getValue().isExpired());
    }
}
