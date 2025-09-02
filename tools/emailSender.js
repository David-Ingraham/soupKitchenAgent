const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailTool {
    constructor() {
        this.description = "Send professional emails to grocery stores, food kitchens, and volunteers for outreach and coordination";
        
        // Create email transporter
        this.transporter = nodemailer.createTransporter({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Email templates
        this.templates = {
            store_partnership: {
                subject: "Food Donation Partnership Opportunity - Reduce Waste, Help Community",
                body: `Dear {{contact_person}},

I hope this message finds you well. I'm reaching out regarding a meaningful partnership opportunity for {{store_name}}.

We're organizing a volunteer-driven food rescue program that helps grocery stores donate unused food to local food kitchens and pantries in the Bronx and Northern Manhattan. This partnership would help {{store_name}}:

- Reduce food waste and disposal costs
- Support local community food security
- Enhance your store's community impact

Our trained volunteers can coordinate regular pickups at times convenient for your operations. We handle all logistics, transportation, and delivery to verified food assistance organizations.

Would you be interested in discussing how we could work together? I'd be happy to schedule a brief call to explain the program and answer any questions.

Thank you for your time and consideration.

Best regards,
Food Distribution Volunteer Coordinator
{{contact_email}}
{{contact_phone}}`
            },

            kitchen_partnership: {
                subject: "Food Delivery Partnership - Fresh Donations Available",
                body: `Dear {{contact_person}},

I hope you're doing well. I'm writing to introduce a food donation program that could benefit {{kitchen_name}} and the community you serve.

We coordinate food rescue from local grocery stores and are looking for reliable food kitchens and pantries to receive fresh donations. We can provide:

- Regular deliveries of fresh produce, bakery items, and other groceries
- Flexible delivery schedules to match your needs
- Reliable volunteer drivers for consistent service

Our goal is to connect surplus food from grocery stores directly to organizations like yours that serve families in need.

Would {{kitchen_name}} be interested in receiving food donations? I'd love to discuss the details and see how we can support your important work.

Looking forward to hearing from you.

Best regards,
Food Distribution Volunteer Coordinator
{{contact_email}}
{{contact_phone}}`
            },

            volunteer_confirmation: {
                subject: "Volunteer Assignment Confirmed - {{delivery_date}}",
                body: `Hi {{volunteer_name}},

Thank you for signing up to volunteer! Your assignment is confirmed:

Date: {{delivery_date}}
Role: {{volunteer_role}}
Location: {{packing_location}}
Time: {{pickup_time}}

Details:
{{delivery_details}}

Please arrive 15 minutes early. Bring comfortable clothes and closed-toe shoes. We'll provide any necessary equipment.

If you need to cancel or have questions, please reply to this email.

Thank you for helping fight food waste and hunger in our community!

Best,
Volunteer Coordination Team`
            }
        };
    }

    // Send outreach email to grocery store
    async sendStoreOutreach(storeData) {
        const { name, contact_email, contact_person = 'Store Manager' } = storeData;
        
        if (!contact_email) {
            return { success: false, message: 'No contact email provided for store' };
        }

        const template = this.templates.store_partnership;
        const emailBody = template.body
            .replace(/{{contact_person}}/g, contact_person)
            .replace(/{{store_name}}/g, name)
            .replace(/{{contact_email}}/g, process.env.EMAIL_USER)
            .replace(/{{contact_phone}}/g, process.env.CONTACT_PHONE || '');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: contact_email,
            subject: template.subject,
            text: emailBody
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            return { 
                success: true, 
                data: { messageId: result.messageId },
                message: `Outreach email sent to ${name} at ${contact_email}` 
            };
        } catch (error) {
            return { 
                success: false, 
                message: `Failed to send email to ${name}: ${error.message}` 
            };
        }
    }

    // Send partnership email to food kitchen
    async sendKitchenOutreach(kitchenData) {
        const { name, contact_email, contact_person = 'Program Director' } = kitchenData;
        
        if (!contact_email) {
            return { success: false, message: 'No contact email provided for kitchen' };
        }

        const template = this.templates.kitchen_partnership;
        const emailBody = template.body
            .replace(/{{contact_person}}/g, contact_person)
            .replace(/{{kitchen_name}}/g, name)
            .replace(/{{contact_email}}/g, process.env.EMAIL_USER)
            .replace(/{{contact_phone}}/g, process.env.CONTACT_PHONE || '');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: contact_email,
            subject: template.subject,
            text: emailBody
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            return { 
                success: true, 
                data: { messageId: result.messageId },
                message: `Partnership email sent to ${name} at ${contact_email}` 
            };
        } catch (error) {
            return { 
                success: false, 
                message: `Failed to send email to ${name}: ${error.message}` 
            };
        }
    }

    // Send volunteer confirmation
    async sendVolunteerConfirmation(volunteerData, deliveryData) {
        const { name: volunteer_name, email: volunteer_email, role: volunteer_role } = volunteerData;
        const { delivery_date, notes: delivery_details, packing_location = 'TBD', pickup_time = '9:00 AM' } = deliveryData;

        const template = this.templates.volunteer_confirmation;
        const emailBody = template.body
            .replace(/{{volunteer_name}}/g, volunteer_name)
            .replace(/{{delivery_date}}/g, delivery_date)
            .replace(/{{volunteer_role}}/g, volunteer_role)
            .replace(/{{packing_location}}/g, packing_location)
            .replace(/{{pickup_time}}/g, pickup_time)
            .replace(/{{delivery_details}}/g, delivery_details || 'Details will be provided closer to delivery date');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: volunteer_email,
            subject: template.subject.replace(/{{delivery_date}}/g, delivery_date),
            text: emailBody
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            return { 
                success: true, 
                data: { messageId: result.messageId },
                message: `Confirmation email sent to volunteer ${volunteer_name}` 
            };
        } catch (error) {
            return { 
                success: false, 
                message: `Failed to send confirmation to ${volunteer_name}: ${error.message}` 
            };
        }
    }

    // Get email templates (for Gemini to understand available options)
    getAvailableTemplates() {
        return {
            success: true,
            data: Object.keys(this.templates),
            message: "Available email templates: store_partnership, kitchen_partnership, volunteer_confirmation"
        };
    }
}

module.exports = EmailTool;
