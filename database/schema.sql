-- MVP Schema for Volunteer Food Distribution System

-- Basic volunteer info
CREATE TABLE volunteers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Kitchen/delivery destinations
CREATE TABLE kitchens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    type TEXT DEFAULT 'soup kitchen', -- soup kitchen, community center, food pantry, etc.
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversation state tracking
CREATE TABLE conversation_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    process_type TEXT NOT NULL, -- 'kitchen_registration', 'volunteer_registration', etc.
    current_step TEXT NOT NULL, -- 'waiting_for_name', 'waiting_for_address', etc.
    collected_data TEXT, -- JSON string of collected info
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One delivery per day with volunteer assignments
CREATE TABLE deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_date DATE UNIQUE NOT NULL,
    destination_kitchen_id INTEGER,
    driver1_id INTEGER,
    driver2_id INTEGER,
    packer1_id INTEGER,
    packer2_id INTEGER,
    packer3_id INTEGER,
    status TEXT DEFAULT 'open', -- open, full, completed
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (destination_kitchen_id) REFERENCES kitchens(id),
    FOREIGN KEY (driver1_id) REFERENCES volunteers(id),
    FOREIGN KEY (driver2_id) REFERENCES volunteers(id),
    FOREIGN KEY (packer1_id) REFERENCES volunteers(id),
    FOREIGN KEY (packer2_id) REFERENCES volunteers(id),
    FOREIGN KEY (packer3_id) REFERENCES volunteers(id)
); 