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

    // Get deliveries with volunteer assignments and kitchen info
    static getDeliveries() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    d.id,
                    d.delivery_date,
                    d.status,
                    d.notes,
                    k.name as kitchen_name,
                    k.address as kitchen_address,
                    k.type as kitchen_type,
                    d1.name as driver1_name,
                    d2.name as driver2_name,
                    p1.name as packer1_name,
                    p2.name as packer2_name,
                    p3.name as packer3_name
                FROM deliveries d
                LEFT JOIN kitchens k ON d.destination_kitchen_id = k.id
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

    // Get all kitchens
    static getKitchens() {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM kitchens WHERE active = 1 ORDER BY name', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Add new kitchen
    static addKitchen(name, address, contactPerson, phone, email, type) {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO kitchens (name, address, contact_person, phone, email, type) VALUES (?, ?, ?, ?, ?, ?)',
                [name, address, contactPerson, phone, email, type],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, name, address, contactPerson, phone, email, type });
                }
            );
        });
    }

    // Get conversation state for user
    static getConversationState(userEmail) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM conversation_state WHERE user_email = ? ORDER BY updated_at DESC LIMIT 1', [userEmail], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    // Save conversation state
    static saveConversationState(userEmail, processType, currentStep, collectedData) {
        return new Promise((resolve, reject) => {
            const dataJson = JSON.stringify(collectedData);
            db.run(
                'INSERT OR REPLACE INTO conversation_state (user_email, process_type, current_step, collected_data, updated_at) VALUES (?, ?, ?, ?, datetime("now"))',
                [userEmail, processType, currentStep, dataJson],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    }

    // Clear conversation state
    static clearConversationState(userEmail) {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM conversation_state WHERE user_email = ?', [userEmail], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
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

    // Update volunteer phone number
    static updateVolunteerPhone(email, phone) {
        return new Promise((resolve, reject) => {
            db.run('UPDATE volunteers SET phone = ? WHERE email = ?', [phone, email], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
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
        console.log(`\n=== CHAT MESSAGE ===`);
        console.log(`User: ${userEmail}`);
        console.log(`Message: ${message}`);
        
        // Get current database state for context
        const volunteers = await DatabaseTools.getVolunteers();
        const deliveries = await DatabaseTools.getDeliveries();
        const kitchens = await DatabaseTools.getKitchens();
        const conversationState = await DatabaseTools.getConversationState(userEmail);
        
        const systemPrompt = `You are an AI assistant managing a volunteer food distribution system. 

CURRENT DATABASE STATE:
Volunteers: ${JSON.stringify(volunteers, null, 2)}
Deliveries: ${JSON.stringify(deliveries, null, 2)}
Kitchens: ${JSON.stringify(kitchens, null, 2)}

CONVERSATION STATE: ${conversationState ? `User is in process: ${conversationState.process_type}, step: ${conversationState.current_step}, data: ${conversationState.collected_data}` : 'No active conversation process'}

AVAILABLE ACTIONS:
1. Register new volunteer: addVolunteer(name, email, phone)
2. Update volunteer phone: updateVolunteerPhone(email, phone)
3. Sign up existing volunteer: signupVolunteer(email, date, role)
4. Cancel volunteer: cancelVolunteer(email, date)
5. Show schedule: getDeliveries()
6. Show kitchens: getKitchens()
7. Add kitchen: addKitchen(name, address, contactPerson, phone, email, type)
8. Save conversation state: saveConversationState(email, processType, step, data)
9. Clear conversation state: clearConversationState(email)

USER MESSAGE: "${message}"
USER EMAIL: "${userEmail}"

IMPORTANT: 
- Check CONVERSATION STATE first - if user is in middle of a process, continue from where they left off
- Before signing up a volunteer, check if their email exists in the volunteers list above. If not, ask for their name and register them first with addVolunteer().
- For kitchen registration, use conversation state to track progress through: name → address → contact → phone → email → type
- Save state after each step with saveConversationState, clear state when process completes

Respond naturally to the user, and if they want to perform an action, specify the exact function call needed.
Format function calls as: FUNCTION_CALL: functionName(param1, param2)

VOLUNTEER EXAMPLES:
- If user wants to sign up but email not in volunteers list → Ask "I don't see you registered yet. What's your name so I can add you?"
- User says "my name is Pete" → FUNCTION_CALL: addVolunteer("Pete", "${userEmail}", null)
- User says just "Pete" → FUNCTION_CALL: addVolunteer("Pete", "${userEmail}", null)
- User says "pete" → FUNCTION_CALL: addVolunteer("Pete", "${userEmail}", null)
- If volunteer already exists and provides phone → FUNCTION_CALL: updateVolunteerPhone("${userEmail}", "phone_number")
- Existing volunteer wants to drive → FUNCTION_CALL: signupVolunteer("${userEmail}", "2024-01-20", "driver")
- "Cancel my packing on the 15th" → FUNCTION_CALL: cancelVolunteer("${userEmail}", "2024-01-15")

KITCHEN REGISTRATION WITH STATE EXAMPLES:
- "I want to register our kitchen" → FUNCTION_CALL: saveConversationState("${userEmail}", "kitchen_registration", "waiting_for_name", {}) + Ask "Great! What's the name of your kitchen?"
- User in step "waiting_for_name" says "Downtown Soup Kitchen" → FUNCTION_CALL: saveConversationState("${userEmail}", "kitchen_registration", "waiting_for_address", {"name": "Downtown Soup Kitchen"}) + Ask "What's the full address?"
- User in step "waiting_for_address" says "123 Main St" → FUNCTION_CALL: saveConversationState("${userEmail}", "kitchen_registration", "waiting_for_contact", {"name": "Downtown Soup Kitchen", "address": "123 Main St"}) + Ask "Who should we list as the main contact?"
- User in step "waiting_for_contact" says "John Smith" → FUNCTION_CALL: saveConversationState("${userEmail}", "kitchen_registration", "waiting_for_phone", {"name": "Downtown Soup Kitchen", "address": "123 Main St", "contact": "John Smith"}) + Ask "What's the phone number?"
- User in step "waiting_for_phone" says "555-1234" → FUNCTION_CALL: saveConversationState("${userEmail}", "kitchen_registration", "waiting_for_email", {"name": "Downtown Soup Kitchen", "address": "123 Main St", "contact": "John Smith", "phone": "555-1234"}) + Ask "What's the email?"
- User in step "waiting_for_email" says "john@kitchen.org" → FUNCTION_CALL: saveConversationState("${userEmail}", "kitchen_registration", "waiting_for_type", {"name": "Downtown Soup Kitchen", "address": "123 Main St", "contact": "John Smith", "phone": "555-1234", "email": "john@kitchen.org"}) + Ask "What type? (soup kitchen, food pantry, etc.)"
- User in step "waiting_for_type" says "soup kitchen" → FUNCTION_CALL: addKitchen("Downtown Soup Kitchen", "123 Main St", "John Smith", "555-1234", "john@kitchen.org", "soup kitchen") + FUNCTION_CALL: clearConversationState("${userEmail}")

QUERY EXAMPLES:
- "Show me the schedule" → FUNCTION_CALL: getDeliveries()
- "Show me the kitchens" → FUNCTION_CALL: getKitchens()

CRITICAL: 
- When user provides volunteer name, immediately call addVolunteer!
- When collecting kitchen info, move step by step and call addKitchen when you have all 6 pieces!
- Don't repeat questions - use the info they provide and move to next step!`;

        const result = await model.generateContent(systemPrompt);
        const response = result.response.text();
        console.log(`AI Response: ${response}`);
        
        // Parse and execute function calls
        let executionResult = null;
        let sqlQuery = null;
        if (response.includes('FUNCTION_CALL:')) {
            const functionMatch = response.match(/FUNCTION_CALL:\s*(\w+)\((.*?)\)/);
            if (functionMatch) {
                const [, functionName, paramsStr] = functionMatch;
                const params = paramsStr.split(',').map(p => p.trim().replace(/"/g, ''));
                
                console.log(`\n=== EXECUTING FUNCTION ===`);
                console.log(`Function: ${functionName}(${params.join(', ')})`);
                
                try {
                    switch (functionName) {
                        case 'addVolunteer':
                            sqlQuery = `INSERT INTO volunteers (name, email, phone) VALUES ('${params[0]}', '${params[1]}', '${params[2] || 'NULL'}')`;
                            executionResult = await DatabaseTools.addVolunteer(...params);
                            break;
                        case 'signupVolunteer':
                            sqlQuery = `UPDATE deliveries SET [role]_id = (SELECT id FROM volunteers WHERE email = '${params[0]}') WHERE delivery_date = '${params[1]}'`;
                            executionResult = await DatabaseTools.signupVolunteer(...params);
                            break;
                        case 'cancelVolunteer':
                            sqlQuery = `UPDATE deliveries SET driver1_id = NULL, driver2_id = NULL, packer1_id = NULL, packer2_id = NULL, packer3_id = NULL WHERE delivery_date = '${params[1]}' AND volunteer = '${params[0]}'`;
                            executionResult = await DatabaseTools.cancelVolunteer(...params);
                            break;
                        case 'updateVolunteerPhone':
                            sqlQuery = `UPDATE volunteers SET phone = '${params[1]}' WHERE email = '${params[0]}'`;
                            executionResult = await DatabaseTools.updateVolunteerPhone(...params);
                            break;
                        case 'getDeliveries':
                            sqlQuery = `SELECT d.*, k.name as kitchen_name, v1.name as driver1_name FROM deliveries d LEFT JOIN kitchens k ON d.destination_kitchen_id = k.id LEFT JOIN volunteers v1 ON d.driver1_id = v1.id`;
                            executionResult = await DatabaseTools.getDeliveries();
                            break;
                        case 'getKitchens':
                            sqlQuery = `SELECT * FROM kitchens WHERE active = 1 ORDER BY name`;
                            executionResult = await DatabaseTools.getKitchens();
                            break;
                        case 'addKitchen':
                            sqlQuery = `INSERT INTO kitchens (name, address, contact_person, phone, email, type) VALUES ('${params[0]}', '${params[1]}', '${params[2]}', '${params[3]}', '${params[4]}', '${params[5]}')`;
                            executionResult = await DatabaseTools.addKitchen(...params);
                            break;
                        case 'saveConversationState':
                            sqlQuery = `INSERT OR REPLACE INTO conversation_state (user_email, process_type, current_step, collected_data) VALUES ('${params[0]}', '${params[1]}', '${params[2]}', '${params[3]}')`;
                            executionResult = await DatabaseTools.saveConversationState(...params);
                            break;
                        case 'clearConversationState':
                            sqlQuery = `DELETE FROM conversation_state WHERE user_email = '${params[0]}'`;
                            executionResult = await DatabaseTools.clearConversationState(...params);
                            break;
                    }
                    console.log(`SQL Query: ${sqlQuery}`);
                    console.log(`Result:`, executionResult);
                } catch (dbError) {
                    console.log(`Database Error: ${dbError.message}`);
                    executionResult = { error: dbError.message };
                }
            }
        }
        
        res.json({ 
            response: response.replace(/FUNCTION_CALL:.*/, '').trim(),
            executionResult,
            sqlQuery 
        });
        
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

// API endpoint to get current database state
app.get('/api/db-state', async (req, res) => {
    try {
        const volunteers = await DatabaseTools.getVolunteers();
        const deliveries = await DatabaseTools.getDeliveries();
        const kitchens = await DatabaseTools.getKitchens();
        
        res.json({
            volunteers,
            deliveries,
            kitchens
        });
    } catch (error) {
        console.error('DB state error:', error);
        res.status(500).json({ error: 'Failed to get database state' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 