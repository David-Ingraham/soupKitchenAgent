


const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const db = new sqlite3.Database(path.join(__dirname, '../database', 'volunteer_system.db'));

// Get all volunteers
router.get('/', (req, res) => {
    db.all('SELECT * FROM volunteers ORDER BY created_at DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create new volunteer
router.post('/', (req, res) => {
    const { name, email, phone, role } = req.body;
    
    if (!name || !email || !role) {
        return res.status(400).json({ error: 'Name, email, and role are required' });
    }

    db.run(
        'INSERT INTO volunteers (name, email, phone, role) VALUES (?, ?, ?, ?)',
        [name, email, phone, role],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    res.status(400).json({ error: 'Email already registered' });
                } else {
                    res.status(500).json({ error: err.message });
                }
                return;
            }
            res.status(201).json({ id: this.lastID, message: 'Volunteer registered successfully' });
        }
    );
});

module.exports = router;