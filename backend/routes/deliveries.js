


const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const db = new sqlite3.Database(path.join(__dirname, '../database', 'volunteer_system.db'));

// Get all deliveries
router.get('/', (req, res) => {
    const query = `
        SELECT 
            d.*,
            gs.name as store_name,
            COUNT(va.id) as volunteer_count
        FROM deliveries d
        LEFT JOIN grocery_stores gs ON d.grocery_store_id = gs.id
        LEFT JOIN volunteer_assignments va ON d.id = va.delivery_id
        GROUP BY d.id
        ORDER BY d.delivery_date ASC
    `;

    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

module.exports = router;