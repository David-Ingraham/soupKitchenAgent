const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Import all tools
const EmailTool = require('./tools/emailSender');
const WebSearchTool = require('./tools/webSearch');
const CalendarTool = require('./tools/calendarManager');
const VolunteerTool = require('./tools/volunteerManager');

class VolunteerSystemAgent {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        
        // Initialize tools
        this.tools = {
            email: new EmailTool(),
            webSearch: new WebSearchTool(),
            calendar: new CalendarTool(),
            volunteer: new VolunteerTool()
        };
    }

    getSystemPrompt() {
        return `You are an AI agent managing a volunteer food distribution system in NYC. Your mission is to:

GOALS:
1. Find grocery stores with food donation programs in Manhattan/Bronx and establish partnerships
2. Contact stores via email to coordinate food pickups
3. Find food kitchens in Bronx/Northern Manhattan for food delivery
4. Manage volunteer signups and coordinate delivery schedules
5. Optimize the entire food rescue operation

AVAILABLE TOOLS:
- email: Send professional emails to stores and food kitchens
- webSearch: Search the web for stores, kitchens, and contact information
- calendar: Manage delivery schedules, volunteer appointments, and coordinate timing
- volunteer: Handle volunteer registration and assignment coordination

INSTRUCTIONS:
- Be autonomous and proactive in accomplishing the mission
- Use tools strategically to build partnerships and coordinate operations
- Prioritize stores and kitchens most likely to participate
- Keep detailed records in the database
- Send professional, compelling outreach emails
- Coordinate volunteer schedules efficiently

Start by assessing the current database state, then begin finding and contacting potential grocery store partners.`;
    }

    async executeAgentCycle() {
        try {
            console.log(' Starting Volunteer System Agent...');
            
            const prompt = this.getSystemPrompt();
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();
            
            console.log(' Agent Response:', response);
            
            // Here we would parse the response and execute any tool calls
            // For now, just log the agent's plan
            
        } catch (error) {
            console.error(' Agent Error:', error);
        }
    }

    async run() {
        console.log(' Initializing Volunteer Food Distribution Agent');
        await this.executeAgentCycle();
    }
}

// Run the agent
const agent = new VolunteerSystemAgent();
agent.run();
