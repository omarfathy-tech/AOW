package com.orderhub.app.security;

import com.orderhub.app.models.User;
import com.orderhub.app.repositories.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * JWT filter with user caching.
 *
 * BEFORE: Every request → SELECT * FROM users WHERE username=?
 * AFTER:  Every request → cache lookup (in-memory, ~1μs)
 *         Cache miss (every 5 min per user) → SELECT * FROM users WHERE username=?
 *
 * With 6 users polling every 5s the original generated ~72 DB queries/minute.
 * With caching it generates ~1-2 DB queries/minute (one per user per TTL window).
 */
@Component
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserCache userCache;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String token = authHeader.substring(7);

        String username;
        try {
            username = jwtUtil.extractUsername(token);
        } catch (Exception e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            filterChain.doFilter(request, response);
            return;
        }

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {

            // Try cache first — avoids DB hit on every polling request
            User user = userCache.get(username);

            if (user == null) {
                // Cache miss: load from DB and cache the result
                user = userRepository.findByUsername(username).orElse(null);
                if (user != null) {
                    userCache.put(username, user);
                    log.debug("User '{}' loaded from DB and cached.", username);
                }
            }

            if (user != null && jwtUtil.validateToken(token, user.getUsername())) {
                // Build Spring Security authentication from the cached/loaded user
                UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                        user.getUsername(), // principal should be string for getName()
                        null,
                        Collections.singletonList(new SimpleGrantedAuthority(user.getRole().name()))
                    );
                authToken.setDetails(
                    new WebAuthenticationDetailsSource().buildDetails(request)
                );
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}
