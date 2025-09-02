const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class CalendarTool {
    constructor() {
        this.dbPath = path.join(__dirname, '../backend/database/volunteer_system.db');
        this.description = "Manage delivery schedules, volunteer appointments, and coordinate timing for food distribution operations";
    }

    getDb() {
        return new sqlite3.Database(this.dbPath);
    }

    // Create new delivery appointment
    async createDeliveryAppointment(deliveryData) {
        const { 
            delivery_date, 
            grocery_store_id, 
            packing_location_id, 
            pickup_time = '09:00',
            estimated_food_amount,
            notes 
        } = deliveryData;

        return new Promise((resolve, reject) => {
            const db = this.getDb();
            db.run(
                `INSERT INTO deliveries (delivery_date, grocery_store_id, packing_location_id, 
                 estimated_food_amount, notes, status) VALUES (?, ?, ?, ?, ?, 'planned')`,
                [delivery_date, grocery_store_id, packing_location_id, estimated_food_amount, notes],
                function(err) {
                    if (err) {
                        db.close();
                        reject(err);
                    } else {
                        // Also create a calendar entry for pickup time
                        db.run(
                            `INSERT INTO delivery_schedule (delivery_id, pickup_time, status) VALUES (?, ?, 'scheduled')`,
                            [this.lastID, pickup_time],
                            function(schedErr) {
                                db.close();
                                if (schedErr) {
                                    resolve({ 
                                        success: true, 
                                        data: { id: this.lastID },
                                        message: `Delivery created but schedule entry failed: ${schedErr.message}` 
                                    });
                                } else {
                                    resolve({ 
                                        success: true, 
                                        data: { id: this.lastID },
                                        message: `Delivery appointment created for ${delivery_date}` 
                                    });
                                }
                            }
                        );
                    }
                }
            );
        });
    }

    // Get upcoming deliveries/appointments
    async getUpcomingAppointments(daysAhead = 30) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            const query = `
                SELECT 
                    d.id,
                    d.delivery_date,
                    d.status,
                    d.estimated_food_amount,
                    d.notes,
                    gs.name as store_name,
                    gs.address as store_address,
                    gs.contact_phone as store_phone,
                    pl.name as location_name,
                    pl.address as location_address,
                    COUNT(va.id) as volunteers_assigned,
                    GROUP_CONCAT(v.name || ' (' || v.role || ')') as volunteer_list
                FROM deliveries d
                LEFT JOIN grocery_stores gs ON d.grocery_store_id = gs.id
                LEFT JOIN packing_locations pl ON d.packing_location_id = pl.id
                LEFT JOIN volunteer_assignments va ON d.id = va.delivery_id AND va.status != 'cancelled'
                LEFT JOIN volunteers v ON va.volunteer_id = v.id
                WHERE d.delivery_date >= date('now') 
                AND d.delivery_date <= date('now', '+${daysAhead} days')
                AND d.status != 'cancelled'
                GROUP BY d.id
                ORDER BY d.delivery_date ASC
            `;

            db.all(query, (err, rows) => {
                db.close();
                if (err) reject(err);
                else resolve({ 
                    success: true, 
                    data: rows,
                    message: `Found ${rows.length} upcoming appointments in next ${daysAhead} days` 
                });
            });
        });
    }

    // Get volunteer's personal schedule
    async getVolunteerSchedule(volunteerId, daysAhead = 30) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            const query = `
                SELECT 
                    d.id as delivery_id,
                    d.delivery_date,
                    d.status as delivery_status,
                    va.status as assignment_status,
                    va.notes as assignment_notes,
                    gs.name as store_name,
                    gs.address as store_address,
                    pl.name as location_name,
                    pl.address as location_address,
                    v.role as volunteer_role
                FROM volunteer_assignments va
                JOIN deliveries d ON va.delivery_id = d.id
                JOIN volunteers v ON va.volunteer_id = v.id
                LEFT JOIN grocery_stores gs ON d.grocery_store_id = gs.id
                LEFT JOIN packing_locations pl ON d.packing_location_id = pl.id
                WHERE va.volunteer_id = ?
                AND d.delivery_date >= date('now')
                AND d.delivery_date <= date('now', '+${daysAhead} days')
                AND va.status != 'cancelled'
                ORDER BY d.delivery_date ASC
            `;

            db.all(query, [volunteerId], (err, rows) => {
                db.close();
                if (err) reject(err);
                else resolve({ 
                    success: true, 
                    data: rows,
                    message: `Found ${rows.length} upcoming assignments for volunteer` 
                });
            });
        });
    }

    // Check for scheduling conflicts
    async checkVolunteerAvailability(volunteerId, proposedDate) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            const query = `
                SELECT COUNT(*) as conflicts
                FROM volunteer_assignments va
                JOIN deliveries d ON va.delivery_id = d.id
                WHERE va.volunteer_id = ? 
                AND d.delivery_date = ?
                AND va.status NOT IN ('cancelled', 'completed')
            `;

            db.get(query, [volunteerId, proposedDate], (err, row) => {
                db.close();
                if (err) reject(err);
                else resolve({ 
                    success: true, 
                    data: { 
                        isAvailable: row.conflicts === 0,
                        conflicts: row.conflicts
                    },
                    message: row.conflicts === 0 ? 
                        'Volunteer is available for this date' : 
                        `Volunteer has ${row.conflicts} existing assignment(s) on this date` 
                });
            });
        });
    }

    // Get calendar view for specific month
    async getMonthlyCalendar(year, month) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            const query = `
                SELECT 
                    d.delivery_date,
                    d.id,
                    d.status,
                    gs.name as store_name,
                    COUNT(va.id) as volunteers_assigned,
                    SUM(CASE WHEN v.role = 'driver' THEN 1 ELSE 0 END) as drivers,
                    SUM(CASE WHEN v.role = 'packer' THEN 1 ELSE 0 END) as packers
                FROM deliveries d
                LEFT JOIN grocery_stores gs ON d.grocery_store_id = gs.id
                LEFT JOIN volunteer_assignments va ON d.id = va.delivery_id AND va.status != 'cancelled'
                LEFT JOIN volunteers v ON va.volunteer_id = v.id
                WHERE strftime('%Y', d.delivery_date) = ? 
                AND strftime('%m', d.delivery_date) = ?
                AND d.status != 'cancelled'
                GROUP BY d.id
                ORDER BY d.delivery_date ASC
            `;

            const monthStr = month.toString().padStart(2, '0');
            
            db.all(query, [year.toString(), monthStr], (err, rows) => {
                db.close();
                if (err) reject(err);
                else {
                    // Group by date for calendar display
                    const calendarData = {};
                    rows.forEach(row => {
                        const date = row.delivery_date;
                        if (!calendarData[date]) {
                            calendarData[date] = [];
                        }
                        calendarData[date].push(row);
                    });

                    resolve({ 
                        success: true, 
                        data: {
                            month: `${year}-${monthStr}`,
                            appointments: rows,
                            calendarView: calendarData,
                            totalAppointments: rows.length
                        },
                        message: `Found ${rows.length} appointments for ${year}-${monthStr}` 
                    });
                }
            });
        });
    }

    // Reschedule delivery appointment
    async rescheduleDelivery(deliveryId, newDate, reason = '') {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            
            // First get current delivery info
            db.get('SELECT * FROM deliveries WHERE id = ?', [deliveryId], (err, delivery) => {
                if (err) {
                    db.close();
                    reject(err);
                    return;
                }
                
                if (!delivery) {
                    db.close();
                    resolve({ success: false, message: 'Delivery not found' });
                    return;
                }

                // Update delivery date
                db.run(
                    'UPDATE deliveries SET delivery_date = ?, notes = ? WHERE id = ?',
                    [newDate, `${delivery.notes || ''}\nRescheduled: ${reason}`.trim(), deliveryId],
                    function(updateErr) {
                        db.close();
                        if (updateErr) {
                            reject(updateErr);
                        } else {
                            resolve({ 
                                success: true, 
                                data: { 
                                    deliveryId,
                                    oldDate: delivery.delivery_date,
                                    newDate: newDate
                                },
                                message: `Delivery rescheduled from ${delivery.delivery_date} to ${newDate}` 
                            });
                        }
                    }
                );
            });
        });
    }

    // Cancel volunteer assignment
    async cancelVolunteerAssignment(volunteerId, deliveryId, reason = '') {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            db.run(
                'UPDATE volunteer_assignments SET status = ?, notes = ? WHERE volunteer_id = ? AND delivery_id = ?',
                ['cancelled', reason, volunteerId, deliveryId],
                function(err) {
                    db.close();
                    if (err) reject(err);
                    else resolve({ 
                        success: true, 
                        message: `Volunteer assignment cancelled. Reason: ${reason || 'No reason provided'}` 
                    });
                }
            );
        });
    }

    // Get delivery staffing summary
    async getDeliveryStaffingSummary(deliveryId) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            const query = `
                SELECT 
                    d.delivery_date,
                    d.status,
                    gs.name as store_name,
                    COUNT(va.id) as total_volunteers,
                    SUM(CASE WHEN v.role = 'driver' THEN 1 ELSE 0 END) as drivers,
                    SUM(CASE WHEN v.role = 'packer' THEN 1 ELSE 0 END) as packers,
                    GROUP_CONCAT(v.name || ' (' || v.role || ')') as volunteer_list
                FROM deliveries d
                LEFT JOIN grocery_stores gs ON d.grocery_store_id = gs.id
                LEFT JOIN volunteer_assignments va ON d.id = va.delivery_id AND va.status != 'cancelled'
                LEFT JOIN volunteers v ON va.volunteer_id = v.id
                WHERE d.id = ?
                GROUP BY d.id
            `;

            db.get(query, [deliveryId], (err, row) => {
                db.close();
                if (err) reject(err);
                else if (!row) {
                    resolve({ success: false, message: 'Delivery not found' });
                } else {
                    const needsMoreDrivers = row.drivers < 2;
                    const needsMorePackers = row.packers < 3;
                    
                    resolve({ 
                        success: true, 
                        data: {
                            ...row,
                            needsMoreDrivers,
                            needsMorePackers,
                            isFullyStaffed: !needsMoreDrivers && !needsMorePackers,
                            staffingStatus: needsMoreDrivers || needsMorePackers ? 'understaffed' : 'fully_staffed'
                        },
                        message: `${row.store_name} delivery on ${row.delivery_date}: ${row.drivers} drivers, ${row.packers} packers` 
                    });
                }
            });
        });
    }

    // Find optimal dates for new deliveries
    async findOptimalDeliveryDates(daysAhead = 30, maxPerDay = 2) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            const query = `
                SELECT 
                    date('now', '+' || seq || ' days') as potential_date,
                    CASE strftime('%w', date('now', '+' || seq || ' days'))
                        WHEN '0' THEN 'Sunday'
                        WHEN '1' THEN 'Monday' 
                        WHEN '2' THEN 'Tuesday'
                        WHEN '3' THEN 'Wednesday'
                        WHEN '4' THEN 'Thursday'
                        WHEN '5' THEN 'Friday'
                        WHEN '6' THEN 'Saturday'
                    END as day_of_week,
                    COALESCE(delivery_count, 0) as existing_deliveries
                FROM (
                    SELECT 0 as seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION 
                    SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION
                    SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION
                    SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION
                    SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION
                    SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30
                ) dates
                LEFT JOIN (
                    SELECT delivery_date, COUNT(*) as delivery_count
                    FROM deliveries 
                    WHERE status != 'cancelled'
                    GROUP BY delivery_date
                ) existing ON dates.potential_date = existing.delivery_date
                WHERE COALESCE(delivery_count, 0) < ?
                AND strftime('%w', potential_date) IN ('6', '0')  -- Weekends only
                ORDER BY existing_deliveries ASC, potential_date ASC
                LIMIT 10
            `;

            db.all(query, [maxPerDay], (err, rows) => {
                db.close();
                if (err) reject(err);
                else resolve({ 
                    success: true, 
                    data: rows,
                    message: `Found ${rows.length} optimal dates for new deliveries (weekends with < ${maxPerDay} deliveries)` 
                });
            });
        });
    }

    // Get volunteer workload analysis
    async getVolunteerWorkloadAnalysis(timeframe = 30) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            const query = `
                SELECT 
                    v.id,
                    v.name,
                    v.role,
                    v.email,
                    COUNT(va.id) as assignments_count,
                    COUNT(CASE WHEN d.delivery_date >= date('now') THEN 1 END) as upcoming_assignments,
                    COUNT(CASE WHEN va.status = 'completed' THEN 1 END) as completed_assignments
                FROM volunteers v
                LEFT JOIN volunteer_assignments va ON v.id = va.volunteer_id
                LEFT JOIN deliveries d ON va.delivery_id = d.id 
                    AND d.delivery_date >= date('now', '-${timeframe} days')
                    AND va.status != 'cancelled'
                GROUP BY v.id
                ORDER BY assignments_count DESC, v.name ASC
            `;

            db.all(query, (err, rows) => {
                db.close();
                if (err) reject(err);
                else {
                    const overloaded = rows.filter(v => v.upcoming_assignments > 3);
                    const underutilized = rows.filter(v => v.upcoming_assignments === 0);
                    
                    resolve({ 
                        success: true, 
                        data: {
                            all: rows,
                            overloaded: overloaded,
                            underutilized: underutilized,
                            summary: {
                                totalVolunteers: rows.length,
                                overloadedCount: overloaded.length,
                                underutilizedCount: underutilized.length
                            }
                        },
                        message: `Workload analysis: ${overloaded.length} overloaded, ${underutilized.length} underutilized volunteers` 
                    });
                }
            });
        });
    }
}

module.exports = CalendarTool;
