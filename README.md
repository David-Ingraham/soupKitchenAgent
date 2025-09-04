# Food Distribution Volunteer Management System

A conversational AI system for managing volunteers in a food distribution operation, built with Node.js, SQLite, and Google Gemini AI.

## Quick Start

```bash
# Install dependencies
npm install

# Initialize database with sample data
npm run init-db

# Start server
npm start
```

Visit `http://localhost:3000` to interact with the system.

## Technical Architecture: AI-Database Integration

### Overview
This system uses Google Gemini AI to interpret natural language and execute database operations through a structured function calling mechanism. The AI acts as an intelligent interface layer between users and the SQLite database.

### Function Calling System

#### 1. Prompt Engineering
The AI receives a comprehensive system prompt (`detailed_prompt_examples.txt`) containing:
- **Database schema context**: Current state of all tables (volunteers, events, routes, kitchens)
- **Available functions**: Detailed specifications for each database operation
- **Conversation examples**: Multi-turn dialogues showing proper function usage
- **Critical rules**: Constraints and behavioral guidelines

#### 2. Function Definition
Functions are defined as simple string patterns in the prompt:
```
AVAILABLE ACTIONS:
1. Register volunteer: addVolunteer(name, email, phone)
2. Update volunteer phone: updateVolunteerPhone(email, phone) 
3. Sign up volunteer for event: signupForEvent(email, eventId, role)
4. Assign driver route: assignDriverRoute(email, eventId, kitchenName)
...
```

#### 3. AI Response Generation
When the AI determines a database operation is needed, it generates responses containing structured function calls:
```
AI: "Perfect! I've registered you as a volunteer."
FUNCTION_CALL: addVolunteer("John Smith", "john@email.com", "555-1234")
```

#### 4. Server-Side Function Parsing
The Node.js server parses AI responses using regex to extract function calls:

```javascript
// Extract ALL function calls from AI response
const functionMatches = response.matchAll(/FUNCTION_CALL:\s*(\w+)\((.*?)\)/g);

for (const match of functionMatches) {
    const [, functionName, paramsStr] = match;
    const params = paramsStr.split(',').map(p => p.trim().replace(/"/g, ''));
    
    // Execute function based on name
    switch (functionName) {
        case 'addVolunteer':
            executionResult = await DatabaseTools.addVolunteer(...params);
            break;
        // ... other cases
    }
}
```

#### 5. Database Execution Layer
`DatabaseTools` class provides async methods that wrap SQLite operations:

```javascript
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
```

### Multi-Function Execution
The system supports multiple function calls in a single AI response:
```
FUNCTION_CALL: signupForEvent("user@email.com", 1, "driver")
FUNCTION_CALL: assignDriverRoute("user@email.com", 1, "Manhattan Community Kitchen")
```

Both functions execute sequentially, enabling complex workflows like volunteer registration + event signup + route assignment in one interaction.

### State Management
The AI maintains conversation context through:
- **Database state injection**: Current table contents are injected into each prompt
- **Conversation state table**: Persistent storage for multi-turn processes (kitchen registration)
- **Email-based user identification**: Each conversation is tied to a user email

### Error Handling
- **Database errors** are caught and logged with detailed SQL queries
- **Function parsing errors** fall back to text-only responses
- **Invalid parameters** are handled by individual DatabaseTools methods

### Key Technical Features
- **Real-time database reflection**: AI always sees current database state
- **Natural language to SQL translation**: No direct SQL exposure to AI
- **Multi-step conversation flows**: Complex registration processes span multiple messages
- **Automatic route assignment**: AI intelligently assigns drivers to available kitchens
- **Type-safe parameter handling**: String parsing with validation in database layer

This architecture enables natural language database management while maintaining data integrity and providing rich conversational experiences.
