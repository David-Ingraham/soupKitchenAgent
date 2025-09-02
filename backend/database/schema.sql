-- Volunteers table
CREATE TABLE volunteers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT CHECK(role IN ('driver', 'packer')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Grocery stores table
CREATE TABLE grocery_stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    contact_person TEXT,
    status TEXT CHECK(status IN ('potential', 'contacted', 'partner', 'declined')) DEFAULT 'potential',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Food kitchens table
CREATE TABLE food_kitchens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    contact_person TEXT,
    capacity_people INTEGER,
    borough TEXT CHECK(borough IN ('bronx', 'manhattan')) NOT NULL,
    status TEXT CHECK(status IN ('potential', 'contacted', 'partner', 'inactive')) DEFAULT 'potential',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Deliveries table
CREATE TABLE deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_date DATE NOT NULL,
    grocery_store_id INTEGER,
    status TEXT CHECK(status IN ('planned', 'confirmed', 'in_progress', 'completed', 'cancelled')) DEFAULT 'planned',
    estimated_food_amount TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grocery_store_id) REFERENCES grocery_stores(id)
);

-- Packing locations table
CREATE TABLE packing_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    capacity_cars INTEGER,
    has_loading_dock BOOLEAN DEFAULT FALSE,
    contact_info TEXT,
    availability_notes TEXT,
    status TEXT CHECK(status IN ('available', 'reserved', 'unavailable')) DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Update deliveries table to include packing location
ALTER TABLE deliveries ADD COLUMN packing_location_id INTEGER REFERENCES packing_locations(id);

-- Volunteer assignments table
CREATE TABLE volunteer_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volunteer_id INTEGER NOT NULL,
    delivery_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('signed_up', 'confirmed', 'completed', 'cancelled')) DEFAULT 'signed_up',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volunteer_id, delivery_id),
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id),
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
);

-- Delivery routes table (links deliveries to food kitchens)
CREATE TABLE delivery_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL,
    food_kitchen_id INTEGER NOT NULL,
    volunteer_id INTEGER,
    estimated_delivery_time TIME,
    status TEXT CHECK(status IN ('planned', 'assigned', 'in_transit', 'delivered')) DEFAULT 'planned',
    notes TEXT,
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    FOREIGN KEY (food_kitchen_id) REFERENCES food_kitchens(id),
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id)
);

-- Delivery schedule table for calendar management
CREATE TABLE delivery_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_id INTEGER NOT NULL,
    pickup_time TIME DEFAULT '09:00',
    setup_time TIME DEFAULT '08:30',
    estimated_completion TIME DEFAULT '12:00',
    status TEXT CHECK(status IN ('scheduled', 'confirmed', 'in_progress', 'completed')) DEFAULT 'scheduled',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
);

-- Email outreach tracking
CREATE TABLE email_outreach (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_type TEXT CHECK(recipient_type IN ('grocery_store', 'food_kitchen')) NOT NULL,
    recipient_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    message_body TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    response_received BOOLEAN DEFAULT FALSE,
    response_date DATETIME,
    response_content TEXT,
    follow_up_needed BOOLEAN DEFAULT FALSE
);
