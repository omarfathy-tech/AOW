package com.orderhub.app.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String fullName;

    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    private String color;

    @Column(name = "language_pref", length = 10)
    @Builder.Default
    private String languagePref = "ar";

    @Column(name = "notifications_enabled")
    @Builder.Default
    private Boolean notificationsEnabled = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "favorites_json", columnDefinition = "TEXT")
    private String favoritesJson;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
