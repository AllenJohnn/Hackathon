# ResQNet

> Next-generation autonomous emergency triage and civilian coordination gateway.

ResQNet is a resilient, dual-layered communication matrix built to handle emergency intake and smart routing when localized infrastructure fails. It pairs an offline-first browser-to-SMS fallback engine with centralized Gemini AI processing models to analyze, score, and dispatch civilian distress signals directly to regional field units.

---

## Core Architecture Matrix

* **Frontend:** React 18, Vite 6, Tailwind CSS, Lucide Icons, React Router DOM, OpenStreetMap
* **Backend:** Node.js, Express, SQLite, Sequelize ORM, Multer (multimodal uploads)
* **Intelligence:** Google Gemini Multimodal SDK (`@google/genai`)

---

## Key Modules & Workflows

### 1. Civilian Distress Intake
* **Smart Telemetry:** Captures verified GPS coordinates natively via the browser geolocation API, with clickable OpenStreetMap validation links.
* **Evidence Uploads:** Citizens can attach optional photos detailing the crisis.
* **Air-Gapped Resiliency:** If network connection fails, the client shifts to offline state, caching reports locally and outputting compressed, single-string SMS blocks for satellite/radio transmission. Cached alerts are automatically synced once online connectivity is restored.
* **Private Alerts Tracking:** Citizens can view their own submitted reports, see live status, and monitor dispatched responder names and departments.

### 2. Autonomous Multimodal AI Triage
* **Triage Analysis Engine:** Incoming crisis descriptions and evidence photos are processed by Gemini Pro to categorize hazard types (e.g., Medical, Flood, Fire).
* **Sanitized Risk Metrics:** The AI generates an objective severity priority (`Critical`, `High`, `Medium`, `Low`) and confidence scores, sanitized before database insertion to prevent constraint conflicts.
* **Active De-duplication:** Automatically flags similar incidents reported within a 100-meter radius in the last 1 hour, triggering duplicate warnings and routing them for manual operator review.

### 3. Human-in-the-Loop dispatch Console
* **Tactical Command Grid:** A clean, minimal operator dashboard to oversee AI metrics and execute priority overrides.
* **Responder Dispatches:** Operators can dynamically fetch registered responder accounts and assign specific departments (Police, Fire Force, Paramedic, Disaster Response, Volunteer), immediately routing tasks to responder terminals.

### 4. Field Responder Portal
* **Unit Terminal:** Responders see assigned rescue vectors, victim counts, landmark details, and active GPS coordinates with navigation links.
* **Stabilization Log:** Enables responders to acknowledge missions and submit closure signatures, updating the status to `Completed`.

---

## Local Deployment Lifecycle

### Prerequisites
* Node.js (v18+ recommended)
* A valid Google Gemini API Key saved inside your system environment variables (`GEMINI_API_KEY`).

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the database seeder to inject demo verification accounts:
   ```bash
   node seed.js
   ```
4. Launch the local Node.js development server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite local development server:
   ```bash
   npm run dev
   ```

---

## Demo Credentials (Hashed in Database)
All accounts default to the password: **`p123`**

* **Citizen Access:** `citizen@resqnet.org`
* **Operator Access:** `admin@resqnet.org`
* **Responder Access:** `responder@resqnet.org`