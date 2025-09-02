const express = require('express');
const CalendarTool = require('../../tools/calendarManager');

const router = express.Router();
const calendar = new CalendarTool();

// Get upcoming appointments/deliveries
router.get('/upcoming', async (req, res) => {
    try {
        const daysAhead = parseInt(req.query.days) || 30;
        const result = await calendar.getUpcomingAppointments(daysAhead);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.data,
                message: result.message
            });
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Error fetching upcoming appointments: ${error.message}`
        });
    }
});

// Get monthly calendar view
router.get('/month/:year/:month', async (req, res) => {
    try {
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);
        
        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: 'Invalid year or month parameter'
            });
        }

        const result = await calendar.getMonthlyCalendar(year, month);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Error fetching monthly calendar: ${error.message}`
        });
    }
});

// Get volunteer's personal schedule
router.get('/volunteer/:id/schedule', async (req, res) => {
    try {
        const volunteerId = parseInt(req.params.id);
        const daysAhead = parseInt(req.query.days) || 30;
        
        if (isNaN(volunteerId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid volunteer ID'
            });
        }

        const result = await calendar.getVolunteerSchedule(volunteerId, daysAhead);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Error fetching volunteer schedule: ${error.message}`
        });
    }
});

// Check volunteer availability for a specific date
router.get('/volunteer/:id/availability/:date', async (req, res) => {
    try {
        const volunteerId = parseInt(req.params.id);
        const proposedDate = req.params.date;
        
        if (isNaN(volunteerId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid volunteer ID'
            });
        }

        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(proposedDate)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        const result = await calendar.checkVolunteerAvailability(volunteerId, proposedDate);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Error checking availability: ${error.message}`
        });
    }
});

// Create new delivery appointment
router.post('/delivery', async (req, res) => {
    try {
        const deliveryData = req.body;
        
        // Validate required fields
        if (!deliveryData.delivery_date) {
            return res.status(400).json({
                success: false,
                message: 'delivery_date is required'
            });
        }

        const result = await calendar.createDeliveryAppointment(deliveryData);
        
        if (result.success) {
            res.status(201).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Error creating delivery appointment: ${error.message}`
        });
    }
});

// Reschedule delivery
router.put('/delivery/:id/reschedule', async (req, res) => {
    try {
        const deliveryId = parseInt(req.params.id);
        const { newDate, reason } = req.body;
        
        if (isNaN(deliveryId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid delivery ID'
            });
        }

        if (!newDate) {
            return res.status(400).json({
                success: false,
                message: 'newDate is required'
            });
        }

        const result = await calendar.rescheduleDelivery(deliveryId, newDate, reason);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Error rescheduling delivery: ${error.message}`
        });
    }
});

// Cancel volunteer assignment
router.put('/volunteer/:volunteerId/delivery/:deliveryId/cancel', async (req, res) => {
    try {
        const volunteerId = parseInt(req.params.volunteerId);
        const deliveryId = parseInt(req.params.deliveryId);
        const { reason } = req.body;
        
        if (isNaN(volunteerId) || isNaN(deliveryId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid volunteer ID or delivery ID'
            });
        }

        const result = await calendar.cancelVolunteerAssignment(volunteerId, deliveryId, reason);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Error cancelling assignment: ${error.message}`
        });
    }
});

// Get delivery staffing summary
router.get('/delivery/:id/staffing', async (req, res) => {
    try {
        const deliveryId = parseInt(req.params.id);
        
        if (isNaN(deliveryId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid delivery ID'
            });
        }

        const result = await calendar.getDeliveryStaffingSummary(deliveryId);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Error fetching staffing summary: ${error.message}`
        });
    }
});

// Find optimal delivery dates
router.get('/optimal-dates', async (req, res) => {
    try {
        const daysAhead = parseInt(req.query.days) || 30;
        const maxPerDay = parseInt(req.query.maxPerDay) || 2;
        
        const result = await calendar.findOptimalDeliveryDates(daysAhead, maxPerDay);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Error finding optimal dates: ${error.message}`
        });
    }
});

// Get volunteer workload analysis
router.get('/workload-analysis', async (req, res) => {
    try {
        const timeframe = parseInt(req.query.timeframe) || 30;
        
        const result = await calendar.getVolunteerWorkloadAnalysis(timeframe);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Error analyzing workload: ${error.message}`
        });
    }
});

module.exports = router;
