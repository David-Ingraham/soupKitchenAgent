const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'volunteer_system.db');

// Remove existing database if it exists
if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('Removed existing database');
}

// Create new database
const db = new sqlite3.Database(DB_PATH);

// Read and execute schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

db.serialize(() => {
    // Execute schema
    db.exec(schema, (err) => {
        if (err) {
            console.error('Error creating schema:', err);
            return;
        }
        console.log('Database schema created successfully');
    });

    // Insert sample volunteers
    const volunteers = [
        ['John Smith', 'john@email.com', '555-0101'],
        ['Sarah Johnson', 'sarah@email.com', '555-0102'],
        ['Mike Chen', 'mike@email.com', '555-0103']
    ];
    
    volunteers.forEach(volunteer => {
        db.run('INSERT INTO volunteers (name, email, phone) VALUES (?, ?, ?)', volunteer);
    });

    // Insert sample kitchens
    const kitchens = [
        ['Manhattan Community Kitchen', '123 Main St, Manhattan, NY', 'Maria Garcia', '212-555-0101', 'maria@mck.org', 'soup kitchen'],
        ['Bronx Food Pantry', '456 Grand Ave, Bronx, NY', 'James Wilson', '718-555-0102', 'james@bfp.org', 'food pantry'],
        ['East Harlem Community Center', '789 Lexington Ave, Manhattan, NY', 'Lisa Chen', '212-555-0103', 'lisa@ehcc.org', 'community center']
    ];
    
    kitchens.forEach(kitchen => {
        db.run('INSERT INTO kitchens (name, address, contact_person, phone, email, type) VALUES (?, ?, ?, ?, ?, ?)', kitchen);
    });

    // Create upcoming bi-weekly Saturday events
    const today = new Date();
    const nextSaturday = new Date(today);
    nextSaturday.setDate(today.getDate() + (6 - today.getDay()));
    
    // Create 4 bi-weekly events (every 2 weeks)
    for (let i = 0; i < 4; i++) {
        const eventDate = new Date(nextSaturday);
        eventDate.setDate(nextSaturday.getDate() + (i * 14)); // Every 2 weeks
        const dateStr = eventDate.toISOString().split('T')[0];
        
        db.run('INSERT INTO events (event_date) VALUES (?)', [dateStr]);
    }

    // Add some sample volunteer signups and routes for demo
    // Sign up John as driver for first event
    db.run('INSERT INTO event_volunteers (event_id, volunteer_id, role) VALUES (1, 1, "driver")');
    // Sign up Sarah as packer for first event  
    db.run('INSERT INTO event_volunteers (event_id, volunteer_id, role) VALUES (1, 2, "packer")');
    // Sign up Mike as both for first event
    db.run('INSERT INTO event_volunteers (event_id, volunteer_id, role) VALUES (1, 3, "both")');
    
    // Create some sample routes
    db.run('INSERT INTO routes (event_id, driver_volunteer_id, destination_kitchen_id, status) VALUES (1, 1, 1, "planned")');
    db.run('INSERT INTO routes (event_id, driver_volunteer_id, destination_kitchen_id, status) VALUES (1, 3, 2, "planned")');
    
    console.log('Sample data inserted successfully');
    
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database initialized successfully!');
        }
    });
}); 