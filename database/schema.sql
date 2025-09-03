-- MVP Schema for Volunteer Food Distribution System

-- Basic volunteer info
CREATE TABLE volunteers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One delivery per day with volunteer assignments
CREATE TABLE deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    delivery_date DATE UNIQUE NOT NULL,
    driver1_id INTEGER,
    driver2_id INTEGER,
    packer1_id INTEGER,
    packer2_id INTEGER,
    packer3_id INTEGER,
    status TEXT DEFAULT 'open', -- open, full, completed
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver1_id) REFERENCES volunteers(id),
    FOREIGN KEY (driver2_id) REFERENCES volunteers(id),
    FOREIGN KEY (packer1_id) REFERENCES volunteers(id),
    FOREIGN KEY (packer2_id) REFERENCES volunteers(id),
    FOREIGN KEY (packer3_id) REFERENCES volunteers(id)
); 