const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Load the comprehensive prompt template
const promptTemplate = fs.readFileSync(path.join(__dirname, 'detailed_prompt_examples.txt'), 'utf8');

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

    // Get events with volunteer counts
    static getEvents() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    e.id,
                    e.event_date,
                    e.status,
                    e.notes,
                    COUNT(CASE WHEN ev.role IN ('packer', 'both') THEN 1 END) as packer_count,
                    COUNT(CASE WHEN ev.role IN ('driver', 'both') THEN 1 END) as driver_count,
                    COUNT(ev.id) as total_volunteers
                FROM events e
                LEFT JOIN event_volunteers ev ON e.id = ev.event_id
                WHERE e.event_date >= date('now')
                GROUP BY e.id, e.event_date, e.status, e.notes
                ORDER BY e.event_date
            `;
            db.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Get volunteers signed up for a specific event
    static getEventVolunteers(eventId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    v.name,
                    v.email,
                    v.phone,
                    ev.role
                FROM event_volunteers ev
                JOIN volunteers v ON ev.volunteer_id = v.id
                WHERE ev.event_id = ?
                ORDER BY ev.role, v.name
            `;
            db.all(query, [eventId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Get all routes
    static getAllRoutes() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    e.event_date,
                    v.name as driver_name,
                    k.name as kitchen_name,
                    r.status
                FROM routes r
                JOIN events e ON r.event_id = e.id
                JOIN volunteers v ON r.driver_volunteer_id = v.id
                JOIN kitchens k ON r.destination_kitchen_id = k.id
                WHERE e.event_date >= date('now')
                ORDER BY e.event_date, v.name
            `;
            db.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Get routes for a specific event
    static getEventRoutes(eventId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    r.id,
                    v.name as driver_name,
                    k.name as kitchen_name,
                    k.address as kitchen_address,
                    r.status,
                    r.notes
                FROM routes r
                JOIN volunteers v ON r.driver_volunteer_id = v.id
                JOIN kitchens k ON r.destination_kitchen_id = k.id
                WHERE r.event_id = ?
                ORDER BY v.name
            `;
            db.all(query, [eventId], (err, rows) => {
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

    // Sign up volunteer for an event
    static signupForEvent(volunteerEmail, eventId, role) {
        return new Promise((resolve, reject) => {
            // First find the volunteer
            db.get('SELECT id FROM volunteers WHERE email = ?', [volunteerEmail], (err, volunteer) => {
                if (err) return reject(err);
                if (!volunteer) return reject(new Error('Volunteer not found'));

                // Check if event exists
                db.get('SELECT id FROM events WHERE id = ?', [eventId], (err, event) => {
                    if (err) return reject(err);
                    if (!event) return reject(new Error('Event not found'));

                    // Sign up volunteer
                    db.run(
                        'INSERT OR REPLACE INTO event_volunteers (event_id, volunteer_id, role) VALUES (?, ?, ?)',
                        [eventId, volunteer.id, role],
                        function(err) {
                            if (err) reject(err);
                            else resolve({ eventId, volunteerId: volunteer.id, role });
                        }
                    );
                });
            });
        });
    }

    // Assign driver to route
    static assignDriverRoute(volunteerEmail, eventId, kitchenId) {
        return new Promise((resolve, reject) => {
            // Find the volunteer
            db.get('SELECT id FROM volunteers WHERE email = ?', [volunteerEmail], (err, volunteer) => {
                if (err) return reject(err);
                if (!volunteer) return reject(new Error('Volunteer not found'));

                // Create route assignment
                db.run(
                    'INSERT INTO routes (event_id, driver_volunteer_id, destination_kitchen_id) VALUES (?, ?, ?)',
                    [eventId, volunteer.id, kitchenId],
                    function(err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID, eventId, volunteerId: volunteer.id, kitchenId });
                    }
                );
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

    // Cancel volunteer from event
    static cancelVolunteerFromEvent(volunteerEmail, eventId) {
        return new Promise((resolve, reject) => {
            db.get('SELECT id FROM volunteers WHERE email = ?', [volunteerEmail], (err, volunteer) => {
                if (err) return reject(err);
                if (!volunteer) return reject(new Error('Volunteer not found'));

                db.run('DELETE FROM event_volunteers WHERE event_id = ? AND volunteer_id = ?', 
                    [eventId, volunteer.id], 
                    function(err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes });
                    }
                );
            });
        });
    }
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
        const events = await DatabaseTools.getEvents();
        const routes = await DatabaseTools.getAllRoutes();
        const kitchens = await DatabaseTools.getKitchens();
        const conversationState = await DatabaseTools.getConversationState(userEmail);
        
        const systemPrompt = `${promptTemplate}

CURRENT DATABASE STATE:
Volunteers: ${JSON.stringify(volunteers, null, 2)}
Events: ${JSON.stringify(events, null, 2)}
Routes: ${JSON.stringify(routes, null, 2)}
Kitchens: ${JSON.stringify(kitchens, null, 2)}

CONVERSATION STATE: ${conversationState ? `User is in process: ${conversationState.process_type}, step: ${conversationState.current_step}, data: ${conversationState.collected_data}` : 'No active conversation process'}

AVAILABLE ACTIONS:
1. Register new volunteer: addVolunteer(name, email, phone)
2. Update volunteer phone: updateVolunteerPhone(email, phone)
3. Sign up volunteer for event: signupForEvent(email, eventId, role)
4. Cancel volunteer from event: cancelVolunteerFromEvent(email, eventId)
5. Assign driver route: assignDriverRoute(email, eventId, kitchenId)
6. Show events: getEvents()
7. Show event volunteers: getEventVolunteers(eventId)
8. Show event routes: getEventRoutes(eventId)
9. Show kitchens: getKitchens()
10. Add kitchen: addKitchen(name, address, contactPerson, phone, email, type)
11. Save conversation state: saveConversationState(email, processType, step, data)
12. Clear conversation state: clearConversationState(email)

USER MESSAGE: "${message}"
USER EMAIL: "${userEmail}"

IMPORTANT: 
- Check CONVERSATION STATE first - if user is in middle of a process, continue from where they left off
- If volunteer email EXISTS in volunteers list, they are already registered - proceed with their request directly
- If volunteer email does NOT exist, ask for their name and register them first with addVolunteer()
- For event signup, volunteers can choose role: "packer", "driver", or "both"
- Events are bi-weekly Saturday food distribution events
- For kitchen registration, use conversation state to track progress through: name → address → contact → phone → email → type
- Save state after each step with saveConversationState, clear state when process completes

Respond naturally to the user, and if they want to perform an action, specify the exact function call needed. Keep the text you show the user exclusivly about thier request.. nothing about you thoughts or tools called
Format function calls as: FUNCTION_CALL: functionName(param1, param2)

VOLUNTEER EXAMPLES:
- If user wants to sign up but email NOT in volunteers list → Ask "I don't see you registered yet. What's your name so I can add you?"
- User says "frank" → FUNCTION_CALL: addVolunteer("Frank", "${userEmail}", null)
- User says "my name is frank" → FUNCTION_CALL: addVolunteer("Frank", "${userEmail}", null) 
- User says "frank, 915-346-2351" → FUNCTION_CALL: addVolunteer("Frank", "${userEmail}", "915-346-2351")
- User says "my name is frnak" → FUNCTION_CALL: addVolunteer("Frank", "${userEmail}", null)
- If volunteer IS already registered and wants to drive → FUNCTION_CALL: signupForEvent("${userEmail}", eventId, "driver")
- If volunteer IS already registered and wants to pack → FUNCTION_CALL: signupForEvent("${userEmail}", eventId, "packer")
- Existing volunteer: "Cancel me from the December 15th event" → FUNCTION_CALL: cancelVolunteerFromEvent("${userEmail}", eventId)

CRITICAL FOR EXISTING VOLUNTEERS: If email IS in volunteers list, don't ask for registration info - proceed with their request!

KITCHEN REGISTRATION WITH STATE EXAMPLES:
- "I want to register my kitchen, name is Downtown Soup Kitchen, address 123 Main St, contact John Smith, phone 555-1234" → Extract all info and FUNCTION_CALL: saveConversationState("${userEmail}", "kitchen_registration", "waiting_for_email", {"name": "Downtown Soup Kitchen", "address": "123 Main St", "contact": "John Smith", "phone": "555-1234"}) + Ask "What's the email address? (optional - you can skip this)"
- User provides partial info like "register kitchen called Downtown Soup Kitchen" → FUNCTION_CALL: saveConversationState("${userEmail}", "kitchen_registration", "waiting_for_address", {"name": "Downtown Soup Kitchen"}) + Ask "What's the address?"
- User says "skip" or "none" for email → Use null for email and continue to type
- User in any step provides multiple pieces → Extract what you can, save state with all collected data, ask for what's still missing
- When you have required pieces (name, address, contact, phone, type) → FUNCTION_CALL: addKitchen() + FUNCTION_CALL: clearConversationState() (email can be null)

CRITICAL: PARSE THE MESSAGE FOR ALL AVAILABLE INFO! Don't ask for things they already told you! EMAIL IS OPTIONAL!

QUERY EXAMPLES:
- "Show me upcoming events" → FUNCTION_CALL: getEvents()
- "Show me the kitchens" → FUNCTION_CALL: getKitchens()
- "Who's signed up for the next event?" → FUNCTION_CALL: getEventVolunteers(eventId)

CRITICAL: 
- When user provides ANY name, call addVolunteer immediately - don't ask again!
- Names can have typos (frnak = Frank) - fix them when calling addVolunteer
- Don't repeat questions - use the info they provide and move to next step!
- When collecting kitchen info, move step by step and call addKitchen when you have all pieces!`;

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
                        case 'signupForEvent':
                            sqlQuery = `INSERT OR REPLACE INTO event_volunteers (event_id, volunteer_id, role) VALUES ('${params[1]}', (SELECT id FROM volunteers WHERE email = '${params[0]}'), '${params[2]}')`;
                            executionResult = await DatabaseTools.signupForEvent(...params);
                            break;
                        case 'cancelVolunteerFromEvent':
                            sqlQuery = `DELETE FROM event_volunteers WHERE event_id = '${params[1]}' AND volunteer_id = (SELECT id FROM volunteers WHERE email = '${params[0]}')`;
                            executionResult = await DatabaseTools.cancelVolunteerFromEvent(...params);
                            break;
                        case 'assignDriverRoute':
                            sqlQuery = `INSERT INTO routes (event_id, driver_volunteer_id, destination_kitchen_id) VALUES ('${params[1]}', (SELECT id FROM volunteers WHERE email = '${params[0]}'), '${params[2]}')`;
                            executionResult = await DatabaseTools.assignDriverRoute(...params);
                            break;
                        case 'updateVolunteerPhone':
                            sqlQuery = `UPDATE volunteers SET phone = '${params[1]}' WHERE email = '${params[0]}'`;
                            executionResult = await DatabaseTools.updateVolunteerPhone(...params);
                            break;
                        case 'getEvents':
                            sqlQuery = `SELECT e.*, COUNT(ev.id) as volunteer_count FROM events e LEFT JOIN event_volunteers ev ON e.id = ev.event_id GROUP BY e.id`;
                            executionResult = await DatabaseTools.getEvents();
                            break;
                        case 'getEventVolunteers':
                            sqlQuery = `SELECT v.name, ev.role FROM event_volunteers ev JOIN volunteers v ON ev.volunteer_id = v.id WHERE ev.event_id = '${params[0]}'`;
                            executionResult = await DatabaseTools.getEventVolunteers(...params);
                            break;
                        case 'getEventRoutes':
                            sqlQuery = `SELECT v.name as driver, k.name as kitchen FROM routes r JOIN volunteers v ON r.driver_volunteer_id = v.id JOIN kitchens k ON r.destination_kitchen_id = k.id WHERE r.event_id = '${params[0]}'`;
                            executionResult = await DatabaseTools.getEventRoutes(...params);
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
        const events = await DatabaseTools.getEvents();
        const routes = await DatabaseTools.getAllRoutes();
        const kitchens = await DatabaseTools.getKitchens();
        
        res.json({
            volunteers,
            events,
            routes,
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