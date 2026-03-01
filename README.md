
# JEEVAN – Offline-First Intelligent Symptom Triage Platform

An offline-first hybrid clinical triage platform that allows doctors to design customizable triage protocols and enables healthcare workers to assess patients through guided symptom-based decision workflows.

## 1. Problem Statement

### Problem Title:
Intelligent Offline Symptom Triage Flowchart Builder

### Problem Description
Frontline healthcare workers such as nurses, paramedics, and community health workers perform initial patient assessments before doctors are available. These assessments rely on static paper-based triage flowcharts and manual decision-making processes.

Paper-based triage systems:

- Are difficult to update
- Are slow to navigate
- Cause inconsistent decisions
- Increase cognitive workload

Many rural clinics and field healthcare environments also operate with limited or no internet connectivity, making cloud-based solutions unreliable.

There is currently no lightweight system that allows healthcare providers to create customizable triage decision trees and deploy them offline for real-time patient assessment.

### Target Users

**Primary Users**

- Frontline healthcare workers:
  - Nurses
  - Paramedics
  - ASHA workers
  - Rural clinic staff
  - Primary healthcare workers

These users perform first-level patient assessments.

**Secondary Users**

- Medical professionals:
  - Doctors
  - Clinic administrators
  - Public health officials
  - NGOs

These users design and manage triage protocols.

### Deployment Environments

- Rural clinics
- Mobile health vans
- Disaster response units
- Primary healthcare centers
- Field hospitals

### Existing Gaps

Current triage systems suffer from:

- Static paper-based flowcharts
- No customization for clinics
- Slow manual navigation
- No explainable decisions
- No offline digital tools
- No structured risk scoring
- Difficult protocol distribution

## 2. Problem Understanding & Approach

### Root Cause Analysis
- **Static Protocols** – Paper-based triage systems cannot be easily updated.
- **Lack of Structured Decision Support** – Healthcare workers must interpret protocols manually.
- **Connectivity Limitations** – Many clinics cannot rely on cloud systems.
- **Cognitive Overload** – Workers must remember complex decision trees.

### Solution Strategy
We propose an offline-first triage decision platform that transforms static medical flowcharts into a structured digital decision engine.

The solution focuses on:

- Customizable triage protocols
- Guided patient assessments
- Offline-first architecture
- Risk scoring
- Explainable decisions
- Hybrid online/offline operation

## 3. Proposed Solution

### Solution Overview
MedFlow is an offline-first hybrid triage platform that allows:

- Doctors to design triage protocols using decision nodes and questions
- Healthcare workers to perform guided patient assessments
- Clinics to deploy protocols offline

Protocols are stored locally and can be updated when internet connectivity is available.

#### Core Idea
The system converts traditional triage flowcharts into structured digital protocols.  
The platform consists of:

- **Protocol Builder**
- **Triage Engine**
- **Offline Medical Knowledge Base**
- **Protocol Deployment System**

Doctors create triage protocols consisting of:

- Symptoms
- Questions
- Decision branches
- Risk scores
- Recommendations

Healthcare workers use these protocols for guided triage.

#### Key Features

1. **Doctor-Created Triage Protocols**
   - Doctors can design custom triage protocols including decision nodes, symptom questions, conditional branching, risk scoring and final recommendations.
   - Example flowchart:
     ```
     Fever?
       Yes → Temperature above 102?
             Yes → HIGH RISK
             No → MEDIUM RISK
       No → LOW RISK
     ```

2. **Guided Patient Assessment**
   - Healthcare workers answer questions step‑by‑step.
   - Example:
     ```
     Do you have fever? → Yes
     Do you have breathing difficulty? → Yes
     ```

3. **Symptom-Based Condition Identification**
   - The system identifies likely conditions using symptom matching.
   - Example:
     ```
     Likely Conditions:
     - Pneumonia (85%)
     - Flu (70%)
     ```

4. **Follow-Up Question Suggestions**
   - The system suggests relevant follow‑up questions.
   - Example:
     ```
     Follow-up Questions:
     • How long has the fever lasted?
     • Any breathing difficulty?
     • Chest pain?
     ```

5. **Risk Scoring System**
   - Each symptom contributes to a risk score.
   - Example:
     ```
     Fever → +2
     Chest Pain → +5
     Breathing Difficulty → +8

     Risk Levels:
     0–5 → Low Risk
     6–10 → Medium Risk
     11+ → High Risk
     ```

6. **Explainable Decisions**
   - The system explains why a decision was made.
   - Example:
     ```
     Result: HIGH RISK
     Reasons:
     • High Fever
     • Breathing Difficulty
     Score: 14
     ```

7. **Offline-First Operation**
   - The system works without internet connectivity.
   - Offline features include symptom input, decision engine, risk scoring, protocol loading, assessment reports.

8. **Hybrid Online + Offline Mode**
   - When internet is available:
     - Protocol updates are downloaded
     - Medical database is updated
   - When offline:
     - Local database is used

9. **Protocol Export and Sharing**
   - Protocols are stored as structured files (e.g., `triage_protocol.json`)
   - Transfer via USB, local network, or direct file transfer.

## 4. System Architecture

### High-Level Flow
```
User → Frontend → Backend → Decision Engine → Database → Response
```

### Architecture Description

**Frontend**
- Provides protocol builder interface, symptom input, assessment interface, result visualization.

**Backend**
- Handles protocol management, decision processing, risk calculation.

**Decision Engine**
- Responsible for symptom matching, follow-up question generation, risk scoring, condition ranking.

**Database**
- Stores medical protocols, symptom lists, conditions, assessments.
- Supports local offline database and online synchronization.

Suggested layout:

```
Doctor → Protocol Builder → Protocol Database
Nurse → Triage Engine → Decision Output
```

## 5. Database Design
- **User**: UserID, Role, Name
- **Protocol**: ProtocolID, ProtocolName, CreatedDate
- **Node**: NodeID, ProtocolID, NodeType, QuestionText, RiskWeight
- **Condition**: ConditionID, ConditionName
- **Symptom**: SymptomID, SymptomName
- **Assessment**: AssessmentID, Date, ProtocolID
- **Response**: AssessmentID, NodeID, Answer
- **Result**: AssessmentID, RiskLevel, Score

## 6. Dataset Selected

- **Dataset Name**: Medical Triage Knowledge Base
- **Source**: Publicly available medical guidelines (WHO, government manuals, CDC, NHS)
- **Data Type**: Structured data including symptoms, conditions, questions, risk levels, recommendations
- **Selection Reason**: Medically validated triage protocols suitable for frontline healthcare.

### Preprocessing Steps
- Extract symptoms from guidelines
- Map symptoms to conditions
- Define follow-up questions
- Assign risk scores
- Convert into JSON format

## 7. Model Selected

- **Model Name**: Rule-Based Decision Engine
- **Selection Reasoning**:
  - Explainable
  - Works offline
  - Requires no training data

### Evaluation Metrics
- Decision Accuracy
- Triage Time
- Protocol Coverage
- Navigation Efficiency

## 8. Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js
- **ML/AI**: Rule-based engine
- **Database**: Local JSON database, MongoDB (online mode)
- **Deployment**: Offline-first web application, hybrid online/offline

## 9. API Documentation & Testing

- **Endpoint 1**: `POST /saveProtocol`
- **Endpoint 2**: `GET /loadProtocol`
- **Endpoint 3**: `POST /runAssessment`
## 10. Module-wise Development & Deliverables

1. **Checkpoint 1: Research & Planning**
   - Deliverables: System design, workflow diagrams, architecture design
2. **Checkpoint 2: Backend Development**
   - Deliverables: Protocol storage, decision engine, risk scoring
3. **Checkpoint 3: Frontend Development**
   - Deliverables: Protocol builder, assessment interface
4. **Checkpoint 4: Model Training**
   - Deliverables: Rule definition, symptom mapping
5. **Checkpoint 5: Model Integration**
   - Deliverables: Integrated triage engine
6. **Checkpoint 6: Deployment**
   - Deliverables: Offline hybrid application

## 11. End-to-End Workflow

```
Start
  ↓
Open JEEVAN App
  ↓
Check Internet Availability
  ↓Internet Available?
    → Yes: Sync Data → Load Triage Engine
    → No: Load Offline Database → Load Triage Engine
  ↓
Start Patient Assessment
  ↓
Enter Patient Details
  ↓
Select Symptoms
  ↓
Generate Follow-Up Questions
  ↓
Answer Questions
  ↓
Calculate Scores
  ↓
Determine Risk Level
  ↓
Display Results
  ↓
Save Assessment
  ↓
End
```

## 12. Demo & Video

- **Live Demo Link**: TBD
- **Demo Video Link**: TBD
- **GitHub Repository**: https://github.com/pepperoni-2-0/JEEVAN

## 13. Hackathon Deliverables Summary

- Working offline triage app
- Protocol builder
- Decision engine
- Risk scoring
- Explainable results
- Hybrid online/offline mode

## 14. Team Roles & Responsibilities

| Member   | Role     | Responsibilities        |
|----------|----------|-------------------------|
| Akshit Tomar | Frontend | UI Development          |
| Harsh Sharma | Backend  | Decision Engine         |
| Arshnoor Singh | Research | Medical Data            |

## 15. Future Scope & Scalability

**Short-Term**
- Mobile interface
- More protocols
- Multi-language support

**Long-Term**
- AI-assisted triage
- Hospital integration
- National deployment

## 16. Known Limitations

- Prototype medical protocols
- Limited conditions
- Requires medical validation

## 17. Impact

JEEVAN improves healthcare decision-making by:

- Standardizing triage decisions
- Reducing decision time
- Supporting rural healthcare
- Improving patient prioritization
