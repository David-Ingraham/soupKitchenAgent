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

    // Create some upcoming delivery dates (next few Saturdays)
    const today = new Date();
    const nextSaturday = new Date(today);
    nextSaturday.setDate(today.getDate() + (6 - today.getDay()));
    
    for (let i = 0; i < 4; i++) {
        const deliveryDate = new Date(nextSaturday);
        deliveryDate.setDate(nextSaturday.getDate() + (i * 7));
        const dateStr = deliveryDate.toISOString().split('T')[0];
        
        db.run('INSERT INTO deliveries (delivery_date) VALUES (?)', [dateStr]);
    }
    
    console.log('Sample data inserted successfully');
    
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database initialized successfully!');
        }
    });
}); 