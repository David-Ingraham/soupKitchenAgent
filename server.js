const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Database connection
const dbPath = path.join(__dirname, 'database', 'volunteer_system.db');
const db = new sqlite3.Database(dbPath);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// Database tools for the AI
class DatabaseTools {
    // Get all volunteers
    static getVolunteers() {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM volunteers ORDER BY name', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Add new volunteer
    static addVolunteer(name, email, phone = null) {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO volunteers (name, email, phone) VALUES (?, ?, ?)',
                [name, email, phone],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, name, email, phone });
                }
            );
        });
    }

    // Get deliveries with volunteer assignments
    static getDeliveries() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    d.id,
                    d.delivery_date,
                    d.status,
                    d.notes,
                    d1.name as driver1_name,
                    d2.name as driver2_name,
                    p1.name as packer1_name,
                    p2.name as packer2_name,
                    p3.name as packer3_name
                FROM deliveries d
                LEFT JOIN volunteers d1 ON d.driver1_id = d1.id
                LEFT JOIN volunteers d2 ON d.driver2_id = d2.id
                LEFT JOIN volunteers p1 ON d.packer1_id = p1.id
                LEFT JOIN volunteers p2 ON d.packer2_id = p2.id
                LEFT JOIN volunteers p3 ON d.packer3_id = p3.id
                WHERE d.delivery_date >= date('now')
                ORDER BY d.delivery_date
            `;
            db.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Sign up volunteer for a role on a specific date
    static signupVolunteer(volunteerEmail, deliveryDate, role) {
        return new Promise((resolve, reject) => {
            // First find the volunteer
            db.get('SELECT id FROM volunteers WHERE email = ?', [volunteerEmail], (err, volunteer) => {
                if (err) return reject(err);
                if (!volunteer) return reject(new Error('Volunteer not found'));

                // Find or create delivery for that date
                db.get('SELECT * FROM deliveries WHERE delivery_date = ?', [deliveryDate], (err, delivery) => {
                    if (err) return reject(err);
                    
                    if (!delivery) {
                        // Create new delivery
                        db.run('INSERT INTO deliveries (delivery_date) VALUES (?)', [deliveryDate], function(err) {
                            if (err) return reject(err);
                            assignVolunteerToDelivery(this.lastID, volunteer.id, role, resolve, reject);
                        });
                    } else {
                        assignVolunteerToDelivery(delivery.id, volunteer.id, role, resolve, reject);
                    }
                });
            });
        });
    }

    // Cancel volunteer assignment
    static cancelVolunteer(volunteerEmail, deliveryDate) {
        return new Promise((resolve, reject) => {
            db.get('SELECT id FROM volunteers WHERE email = ?', [volunteerEmail], (err, volunteer) => {
                if (err) return reject(err);
                if (!volunteer) return reject(new Error('Volunteer not found'));

                const query = `
                    UPDATE deliveries SET 
                        driver1_id = CASE WHEN driver1_id = ? THEN NULL ELSE driver1_id END,
                        driver2_id = CASE WHEN driver2_id = ? THEN NULL ELSE driver2_id END,
                        packer1_id = CASE WHEN packer1_id = ? THEN NULL ELSE packer1_id END,
                        packer2_id = CASE WHEN packer2_id = ? THEN NULL ELSE packer2_id END,
                        packer3_id = CASE WHEN packer3_id = ? THEN NULL ELSE packer3_id END
                    WHERE delivery_date = ?
                `;
                
                db.run(query, [volunteer.id, volunteer.id, volunteer.id, volunteer.id, volunteer.id, deliveryDate], 
                    function(err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            });
        });
    }
}

// Helper function to assign volunteer to first available slot
function assignVolunteerToDelivery(deliveryId, volunteerId, role, resolve, reject) {
    // Get current delivery state
    db.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId], (err, delivery) => {
        if (err) return reject(err);
        
        let updateQuery, updateParams;
        
        if (role === 'driver') {
            if (!delivery.driver1_id) {
                updateQuery = 'UPDATE deliveries SET driver1_id = ? WHERE id = ?';
                updateParams = [volunteerId, deliveryId];
            } else if (!delivery.driver2_id) {
                updateQuery = 'UPDATE deliveries SET driver2_id = ? WHERE id = ?';
                updateParams = [volunteerId, deliveryId];
            } else {
                return reject(new Error('All driver slots are full for this date'));
            }
        } else if (role === 'packer') {
            if (!delivery.packer1_id) {
                updateQuery = 'UPDATE deliveries SET packer1_id = ? WHERE id = ?';
                updateParams = [volunteerId, deliveryId];
            } else if (!delivery.packer2_id) {
                updateQuery = 'UPDATE deliveries SET packer2_id = ? WHERE id = ?';
                updateParams = [volunteerId, deliveryId];
            } else if (!delivery.packer3_id) {
                updateQuery = 'UPDATE deliveries SET packer3_id = ? WHERE id = ?';
                updateParams = [volunteerId, deliveryId];
            } else {
                return reject(new Error('All packer slots are full for this date'));
            }
        } else {
            return reject(new Error('Invalid role. Must be "driver" or "packer"'));
        }
        
        db.run(updateQuery, updateParams, function(err) {
            if (err) reject(err);
            else resolve({ success: true, deliveryId, volunteerId, role });
        });
    });
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, userEmail } = req.body;
        
        // Get current database state for context
        const volunteers = await DatabaseTools.getVolunteers();
        const deliveries = await DatabaseTools.getDeliveries();
        
        const systemPrompt = `You are an AI assistant managing a volunteer food distribution system. 

CURRENT DATABASE STATE:
Volunteers: ${JSON.stringify(volunteers, null, 2)}
Deliveries: ${JSON.stringify(deliveries, null, 2)}

AVAILABLE ACTIONS:
1. Register new volunteer: addVolunteer(name, email, phone)
2. Sign up existing volunteer: signupVolunteer(email, date, role)
3. Cancel volunteer: cancelVolunteer(email, date)
4. Show schedule: getDeliveries()

USER MESSAGE: "${message}"
USER EMAIL: "${userEmail}"

Respond naturally to the user, and if they want to perform an action, specify the exact function call needed.
Format function calls as: FUNCTION_CALL: functionName(param1, param2)

Examples:
- "I want to drive on Saturday" → FUNCTION_CALL: signupVolunteer("${userEmail}", "2024-01-20", "driver")
- "Cancel my packing on the 15th" → FUNCTION_CALL: cancelVolunteer("${userEmail}", "2024-01-15")
- "Register me as Sarah Jones" → FUNCTION_CALL: addVolunteer("Sarah Jones", "${userEmail}", null)`;

        const result = await model.generateContent(systemPrompt);
        const response = result.response.text();
        
        // Parse and execute function calls
        let executionResult = null;
        if (response.includes('FUNCTION_CALL:')) {
            const functionMatch = response.match(/FUNCTION_CALL:\s*(\w+)\((.*?)\)/);
            if (functionMatch) {
                const [, functionName, paramsStr] = functionMatch;
                const params = paramsStr.split(',').map(p => p.trim().replace(/"/g, ''));
                
                try {
                    switch (functionName) {
                        case 'addVolunteer':
                            executionResult = await DatabaseTools.addVolunteer(...params);
                            break;
                        case 'signupVolunteer':
                            executionResult = await DatabaseTools.signupVolunteer(...params);
                            break;
                        case 'cancelVolunteer':
                            executionResult = await DatabaseTools.cancelVolunteer(...params);
                            break;
                        case 'getDeliveries':
                            executionResult = await DatabaseTools.getDeliveries();
                            break;
                    }
                } catch (dbError) {
                    executionResult = { error: dbError.message };
                }
            }
        }
        
        res.json({ 
            response: response.replace(/FUNCTION_CALL:.*/, '').trim(),
            executionResult 
        });
        
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 