# JEEVAN – Offline-First Intelligent Symptom Triage Platform

A complete Node.js / Express backend supporting offline operation, simple JSON database layer, risk scoring, and dynamic triage protocols.

## Installation

Run the following commands in the `backend/` directory:

```bash
npm install
node server.js
```

You should see:
```text
Server running on port 3000
Offline mode ready
```

---

## Example Requests & Responses

### 1. Get All Symptoms
**Request:**
`GET http://localhost:3000/symptoms`

**Response:**
```json
[
  "Fever",
  "Cough",
  "Headache",
  "... (etc)"
]
```

### 2. Get Follow-Up Questions
**Request:**
`POST http://localhost:3000/triage/questions`
```json
{
  "symptoms": ["Fever", "Cough"]
}
```

**Response:**
```json
{
  "questions": [
    "How long have you had fever?",
    "Do you have body pain?",
    "Are you experiencing any nasal congestion?",
    "Is your throat painful when swallowing?",
    "... (etc)"
  ]
}
```

### 3. Run Triage Engine
**Request:**
`POST http://localhost:3000/triage/run`
```json
{
  "symptoms": ["Fever", "Cough", "Chest Pain"]
}
```

**Response:**
```json
{
  "conditions": [
    {
      "name": "Pneumonia",
      "score": 54
    },
    {
      "name": "Flu",
      "score": 40
    },
    {
      "name": "COVID-like Infection",
      "score": 40
    }
  ],
  "riskLevel": "High",
  "recommendations": "Seek urgent medical care",
  "explanation": [
    "Fever matched",
    "Cough matched",
    "Chest Pain matched",
    "Chest Pain increases risk"
  ]
}
```

### 4. Create Doctor Protocol
**Request:**
`POST http://localhost:3000/protocol`
```json
{
  "name": "Fever Protocol Builder",
  "nodes": [
    {
      "id": 1,
      "type": "question",
      "text": "Do you have fever?"
    }
  ]
}
```

**Response:**
```json
{
  "name": "Fever Protocol Builder",
  "nodes": [...],
  "id": "protocol_1700000000000"
}
```

### 5. Check Hybrid State (Sync Status)
**Request:**
`GET http://localhost:3000/sync/status`

**Response:**
```json
{
  "status": "Online"
}
```
*(Returns "Offline" if no ping to google.com works).*
