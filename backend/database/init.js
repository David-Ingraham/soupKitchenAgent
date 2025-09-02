const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'volunteer_system.db');

// Remove existing database
if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
}

const db = new sqlite3.Database(DB_PATH);
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

db.serialize(() => {
    db.exec(schema);
    
    // Mock data
    const volunteers = [
        ['John Smith', 'john@email.com', '555-0101', 'driver'],
        ['Sarah Johnson', 'sarah@email.com', '555-0102', 'packer']
    ];
    
    const stores = [
        ['Whole Foods Market', '10 Columbus Circle, New York, NY', 'manager@wholefoods.com', '212-823-9600', 'Store Manager', 'potential'],
        ['Fairway Market', '2127 Broadway, New York, NY', 'donations@fairway.com', '212-595-1888', 'Community Relations', 'partner']
    ];
    
    const kitchens = [
        ['BronxWorks Food Pantry', '60 E Tremont Ave, Bronx, NY', 'pantry@bronxworks.org', '718-508-8000', 'Food Coordinator', 150, 'bronx', 'partner'],
        ['Holy Apostles Soup Kitchen', '296 9th Ave, New York, NY', 'kitchen@holyapostles.org', '212-924-0167', 'Kitchen Manager', 200, 'manhattan', 'partner']
    ];
    
    const deliveries = [
        ['2024-01-20', 2, 'planned', '300 lbs produce', 'Fairway pickup'],
        ['2024-01-27', 1, 'planned', '400 lbs mixed', 'Whole Foods pickup']
    ];

    volunteers.forEach(v => db.run('INSERT INTO volunteers (name, email, phone, role) VALUES (?, ?, ?, ?)', v));
    stores.forEach(s => db.run('INSERT INTO grocery_stores (name, address, contact_email, contact_phone, contact_person, status) VALUES (?, ?, ?, ?, ?, ?)', s));
    kitchens.forEach(k => db.run('INSERT INTO food_kitchens (name, address, contact_email, contact_phone, contact_person, capacity_people, borough, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', k));
    deliveries.forEach(d => db.run('INSERT INTO deliveries (delivery_date, grocery_store_id, status, estimated_food_amount, notes) VALUES (?, ?, ?, ?, ?)', d));
    
    console.log('Database initialized with mock data');
    db.close();
});
