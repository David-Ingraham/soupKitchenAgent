const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class VolunteerTool {
    constructor() {
        this.dbPath = path.join(__dirname, '../backend/database/volunteer_system.db');
        this.description = "Manage volunteers, their assignments, and coordination for food deliveries";
    }

    getDb() {
        return new sqlite3.Database(this.dbPath);
    }

    // Register new volunteer
    async registerVolunteer(volunteerData) {
        const { name, email, phone, role } = volunteerData;
        
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            db.run(
                'INSERT INTO volunteers (name, email, phone, role) VALUES (?, ?, ?, ?)',
                [name, email, phone, role],
                function(err) {
                    db.close();
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            resolve({ success: false, message: 'Email already registered' });
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve({ 
                            success: true, 
                            data: { id: this.lastID },
                            message: `Registered volunteer: ${name} as ${role}` 
                        });
                    }
                }
            );
        });
    }

    // Assign volunteer to delivery
    async assignVolunteerToDelivery(volunteerId, deliveryId, notes = '') {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            db.run(
                'INSERT INTO volunteer_assignments (volunteer_id, delivery_id, notes) VALUES (?, ?, ?)',
                [volunteerId, deliveryId, notes],
                function(err) {
                    db.close();
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            resolve({ success: false, message: 'Volunteer already assigned to this delivery' });
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve({ 
                            success: true, 
                            data: { assignmentId: this.lastID },
                            message: 'Volunteer assigned to delivery successfully' 
                        });
                    }
                }
            );
        });
    }

    // Get volunteers available for a specific date
    async getAvailableVolunteers(deliveryDate, role = null) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            
            let query = `
                SELECT v.* FROM volunteers v
                WHERE v.id NOT IN (
                    SELECT va.volunteer_id 
                    FROM volunteer_assignments va
                    JOIN deliveries d ON va.delivery_id = d.id
                    WHERE d.delivery_date = ?
                )
            `;
            
            let params = [deliveryDate];
            
            if (role) {
                query += ' AND v.role = ?';
                params.push(role);
            }
            
            query += ' ORDER BY v.created_at ASC';

            db.all(query, params, (err, rows) => {
                db.close();
                if (err) reject(err);
                else resolve({ 
                    success: true, 
                    data: rows, 
                    message: `Found ${rows.length} available ${role || 'volunteers'} for ${deliveryDate}` 
                });
            });
        });
    }

    // Get volunteer assignments for a delivery
    async getDeliveryVolunteers(deliveryId) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            const query = `
                SELECT 
                    v.*,
                    va.status as assignment_status,
                    va.notes as assignment_notes,
                    va.created_at as assigned_at
                FROM volunteers v
                JOIN volunteer_assignments va ON v.id = va.volunteer_id
                WHERE va.delivery_id = ?
                ORDER BY v.role, v.name
            `;

            db.all(query, [deliveryId], (err, rows) => {
                db.close();
                if (err) reject(err);
                else {
                    const drivers = rows.filter(v => v.role === 'driver');
                    const packers = rows.filter(v => v.role === 'packer');
                    
                    resolve({ 
                        success: true, 
                        data: { 
                            all: rows,
                            drivers: drivers,
                            packers: packers,
                            summary: `${drivers.length} drivers, ${packers.length} packers assigned`
                        },
                        message: `Found ${rows.length} volunteers assigned to delivery` 
                    });
                }
            });
        });
    }

    // Check if delivery has enough volunteers
    async checkDeliveryStaffing(deliveryId) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            const query = `
                SELECT 
                    COUNT(*) as total_assigned,
                    SUM(CASE WHEN v.role = 'driver' THEN 1 ELSE 0 END) as drivers_assigned,
                    SUM(CASE WHEN v.role = 'packer' THEN 1 ELSE 0 END) as packers_assigned
                FROM volunteer_assignments va
                JOIN volunteers v ON va.volunteer_id = v.id
                WHERE va.delivery_id = ? AND va.status != 'cancelled'
            `;

            db.get(query, [deliveryId], (err, row) => {
                db.close();
                if (err) reject(err);
                else {
                    const needsMoreDrivers = row.drivers_assigned < 2;
                    const needsMorePackers = row.packers_assigned < 3;
                    
                    resolve({ 
                        success: true, 
                        data: {
                            ...row,
                            needsMoreDrivers,
                            needsMorePackers,
                            isFullyStaffed: !needsMoreDrivers && !needsMorePackers
                        },
                        message: `Delivery staffing: ${row.drivers_assigned} drivers, ${row.packers_assigned} packers. ${needsMoreDrivers ? 'Need more drivers. ' : ''}${needsMorePackers ? 'Need more packers.' : ''}` 
                    });
                }
            });
        });
    }

    // Update volunteer assignment status
    async updateAssignmentStatus(volunteerId, deliveryId, status, notes = '') {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            db.run(
                'UPDATE volunteer_assignments SET status = ?, notes = ? WHERE volunteer_id = ? AND delivery_id = ?',
                [status, notes, volunteerId, deliveryId],
                function(err) {
                    db.close();
                    if (err) reject(err);
                    else resolve({ 
                        success: true, 
                        message: `Updated volunteer assignment status to ${status}` 
                    });
                }
            );
        });
    }

    // Get volunteer statistics
    async getVolunteerStats() {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            const query = `
                SELECT 
                    COUNT(*) as total_volunteers,
                    SUM(CASE WHEN role = 'driver' THEN 1 ELSE 0 END) as drivers,
                    SUM(CASE WHEN role = 'packer' THEN 1 ELSE 0 END) as packers,
                    COUNT(DISTINCT va.volunteer_id) as active_volunteers
                FROM volunteers v
                LEFT JOIN volunteer_assignments va ON v.id = va.volunteer_id
            `;

            db.get(query, (err, row) => {
                db.close();
                if (err) reject(err);
                else resolve({ 
                    success: true, 
                    data: row,
                    message: `System has ${row.total_volunteers} total volunteers (${row.drivers} drivers, ${row.packers} packers)` 
                });
            });
        });
    }
}

module.exports = VolunteerTool;
