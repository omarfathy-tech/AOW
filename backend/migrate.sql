-- ============================================================
-- OrderHub Architecture Overhaul — DB Migration
-- Compatible with MySQL 8.0+
-- Run once after restarting the backend
-- ============================================================

-- 1. Remove dead columns from orders
ALTER TABLE orders DROP COLUMN items_json;
ALTER TABLE orders DROP COLUMN modified_at;
ALTER TABLE orders DROP COLUMN modification_deadline;
ALTER TABLE orders DROP COLUMN cancellation_deadline;
ALTER TABLE orders DROP COLUMN can_be_modified;
ALTER TABLE orders DROP COLUMN can_be_cancelled;
ALTER TABLE orders DROP COLUMN is_split_order;
ALTER TABLE orders DROP COLUMN parent_order_id;
ALTER TABLE orders DROP COLUMN split_amount;
ALTER TABLE orders DROP COLUMN split_group_id;
ALTER TABLE orders DROP COLUMN items_reserved;
ALTER TABLE orders DROP COLUMN reservation_id;
ALTER TABLE orders DROP COLUMN priority;

-- 2. Add new columns to orders (skip if columns already exist from Hibernate ddl-auto)
ALTER TABLE orders ADD COLUMN session_id VARCHAR(36);
ALTER TABLE orders ADD COLUMN notes TEXT;

-- 3. Remove dead columns from users
ALTER TABLE users DROP COLUMN favorites_json;
ALTER TABLE users DROP COLUMN last_active;

-- 4. Add absorbed preference columns to users
ALTER TABLE users ADD COLUMN language_pref VARCHAR(10) DEFAULT 'ar';
ALTER TABLE users ADD COLUMN notifications_enabled TINYINT(1) DEFAULT 1;
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);

-- 5. Create order_items table (normalized)
CREATE TABLE IF NOT EXISTS order_items (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id    BIGINT NOT NULL,
  item_id     VARCHAR(36),
  item_name   VARCHAR(255) NOT NULL,
  size        VARCHAR(50),
  extras      TEXT,
  quantity    INT NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 6. Add missing indexes
CREATE INDEX idx_orders_user        ON orders(user_id);
CREATE INDEX idx_orders_session     ON orders(session_id);
CREATE INDEX idx_orders_status      ON orders(status);
CREATE INDEX idx_order_items_order  ON order_items(order_id);

-- 7. Drop old user_preferences table
-- ⚠️  Uncomment only after confirming users table has language_pref/notifications_enabled populated
-- DROP TABLE IF EXISTS user_preferences;

-- 8. Menu and Sessions (Migrated from MongoDB)
CREATE TABLE IF NOT EXISTS restaurants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    logo_url VARCHAR(255),
    cuisine_type VARCHAR(100),
    description TEXT,
    delivery_fee DOUBLE,
    owner_user_id BIGINT,
    available TINYINT(1) DEFAULT 1,
    order_mode VARCHAR(20) DEFAULT 'MENU'
);

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS available TINYINT(1) DEFAULT 1;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS order_mode VARCHAR(20) DEFAULT 'MENU';

CREATE TABLE IF NOT EXISTS menu_categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id BIGINT,
    name VARCHAR(255),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT,
    name VARCHAR(255),
    FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_item_prices (
    menu_item_id BIGINT NOT NULL,
    price DOUBLE,
    size_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (menu_item_id, size_name),
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_sessions (
    id VARCHAR(36) PRIMARY KEY,
    restaurant_id BIGINT,
    session_name VARCHAR(255),
    opened_by VARCHAR(255),
    delivery_fee DOUBLE,
    total DOUBLE,
    discount_percent DOUBLE DEFAULT 0,
    flat_discount_per_user DOUBLE DEFAULT 0,
    created_at DATETIME,
    closed_at DATETIME,
    sent_at DATETIME,
    deadline DATETIME,
    status VARCHAR(50) DEFAULT 'OPEN'
);

ALTER TABLE order_sessions ADD COLUMN IF NOT EXISTS discount_percent DOUBLE DEFAULT 0;
ALTER TABLE order_sessions ADD COLUMN IF NOT EXISTS flat_discount_per_user DOUBLE DEFAULT 0;

CREATE TABLE IF NOT EXISTS person_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(36),
    name VARCHAR(255),
    items JSON,
    subtotal DOUBLE,
    status VARCHAR(50) DEFAULT 'PENDING',
    notes TEXT,
    is_paid BOOLEAN DEFAULT FALSE,
    payment_method VARCHAR(50),
    amount_received DOUBLE,
    text_order TEXT,
    FOREIGN KEY (session_id) REFERENCES order_sessions(id) ON DELETE CASCADE
);
