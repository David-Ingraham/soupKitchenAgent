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

-- Events (bi-weekly Saturday food distribution)
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_date DATE UNIQUE NOT NULL,
    status TEXT DEFAULT 'open', -- open, full, completed
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Volunteer signups for events
CREATE TABLE event_volunteers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    volunteer_id INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'packer', 'driver', 'both'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id),
    UNIQUE(event_id, volunteer_id)
);

-- Driver routes to specific kitchens
CREATE TABLE routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    driver_volunteer_id INTEGER NOT NULL,
    destination_kitchen_id INTEGER NOT NULL,
    status TEXT DEFAULT 'planned', -- planned, confirmed, completed
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (driver_volunteer_id) REFERENCES volunteers(id),
    FOREIGN KEY (destination_kitchen_id) REFERENCES kitchens(id)
); 