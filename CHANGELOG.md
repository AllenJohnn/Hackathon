# Project Changelog - ResQNet Improvements & Security Fixes

This document tracks all code enhancements, security fixes, and architectural upgrades applied to the ResQNet project chronologically.

---

### 1. Pruned Emojis in Documentation
* **Change:** Removed decorative emojis from all markdown section headers in [readme.md](file:///D:/Hackathon/readme.md).
* **Reason:** Ensures clean, professional documentation style consistency.

### 2. Fixed Public Registration Security Vulnerability
* **Change:** Hardcoded the public signup endpoint role assignment to strictly force `'Citizen'` in [authController.js](file:///D:/Hackathon/backend/controllers/authController.js).
* **Reason:** Prevented malicious actors from registering themselves as `Admin` or `Responder` by passing a custom role parameter in the signup request body.

### 3. Added Database Ingestion Sanitization
* **Change:** Implemented a validation checker in [requestController.js](file:///D:/Hackathon/backend/controllers/requestController.js) to clean, validate, and default the JSON values returned by the Gemini AI triage model.
* **Reason:** Prevented SQLite database inserts from failing and crashing the server with 500 errors when the AI model hallucinated non-schema priorities or severities.

### 4. Resolved Route Authorization Access Barriers
* **Change:** Authorized the `Responder` role to fetch requests in [requestRoutes.js](file:///D:/Hackathon/backend/routes/requestRoutes.js) and update request statuses in [adminRoutes.js](file:///D:/Hackathon/backend/routes/adminRoutes.js).
* **Reason:** Resolved authorization blocks that were throwing `403 Forbidden` errors on the Field Responder dashboard when responders tried to query their missions or mark them as completed.

### 5. Enforced Status Verification Constraints
* **Change:** Updated [adminController.js](file:///D:/Hackathon/backend/controllers/adminController.js) to restrict triage priority updates to `Admin` accounts, while permitting `Responders` to only adjust status to `'Accepted'` or `'Completed'`.
* **Reason:** Enforces proper privilege verification so responders cannot manipulate critical triage parameters.

### 6. Implemented Offline SOS Cache Auto-Sync
* **Change:** Added a network status listener and data-sync function in [CitizenForm.jsx](file:///D:/Hackathon/frontend/src/pages/CitizenForm.jsx).
* **Reason:** Ensured reports cached in browser `localStorage` during internet outages are automatically uploaded to the database once connection is restored.

### 7. Patched Vulnerable Transitive Packages
* **Change:** Added package overrides for `uuid` and `esbuild` in [backend/package.json](file:///D:/Hackathon/backend/package.json) and [frontend/package.json](file:///D:/Hackathon/frontend/package.json), and upgraded `vite` to `^6.4.3`.
* **Reason:** Patched severe developer server path traversal and alternate data stream vulnerabilities, bringing vulnerabilities to **0**.

### 8. Fixed React State Closure Crash (Blank Screen Bug)
* **Change:** Fixed a closure state bug in [Home.jsx](file:///D:/Hackathon/frontend/src/pages/Home.jsx) by capturing log text locally before updating state and added defensive rendering checks.
* **Reason:** Resolved a crash where the async state updater evaluated a mutated index variable, appending `undefined` to the log list and rendering a blank white screen.

### 9. Minimalist Light-Themed Redesign
* **Change:** Re-designed all user portals ([Home.jsx](file:///D:/Hackathon/frontend/src/pages/Home.jsx), [Login.jsx](file:///D:/Hackathon/frontend/src/pages/Login.jsx), [CitizenForm.jsx](file:///D:/Hackathon/frontend/src/pages/CitizenForm.jsx), [AdminDashboard.jsx](file:///D:/Hackathon/frontend/src/pages/AdminDashboard.jsx), [ResponderPortal.jsx](file:///D:/Hackathon/frontend/src/pages/ResponderPortal.jsx)) into a clean, minimalist, high-contrast light theme.
* **Reason:** Delivers a premium, consistent visual identity across the entire system.

### 10. Added Dispatch Roster Queries
* **Change:** Exposed a new `/api/admin/responders` API route and modified request listing queries to nested-include responder name and department.
* **Reason:** Allows the Admin Dashboard to dynamically list responder accounts and displays assignment statuses in real-time.

### 11. Multimodal Evidence Photo Ingestion
* **Change:** Added `multer` file upload middleware to the backend, allowed files to be statically served, and extended the Gemini SDK query to send base64 image data to the model.
* **Reason:** Enables citizens to upload crisis photos and enables the AI to inspect image contents during triage calculations. Styled file selectors and inline previews were added to the portal dashboards.

### 12. Geographic De-duplication Checking
* **Change:** Added a spatial check in [requestController.js](file:///D:/Hackathon/backend/controllers/requestController.js) to flag reports of the same category reported within a 100-meter radius in the last 1 hour.
* **Reason:** Prevents dispatch noise by flagging duplicate alerts and routing them for mandatory manual verification.

### 13. Auto-Dispatch & Dynamic Verification
* **Change:** Configured the backend to automatically assign responder units and transition status to `'Assigned'` for signals with confidence `>= 50%`. Created a "✓ Verify AI Triage" button on the dashboard for low-confidence alerts, updating their status based on severity (High/Medium -> Verified, Low -> Submitted).
* **Reason:** Streamlines emergency coordination by automating high-confidence dispatches while preserving human verification loops.

### 14. Integrated OpenStreetMap Links
* **Change:** Added direct map routing links to all coordinates rendered in the Citizen, Admin, and Responder portals.
* **Reason:** Allows operators and responders to inspect crisis coordinates on a live map in one click.

### 15. Split Admin Dashboard Incident Grid views
* **Change:** Added two togglable grid tab views ("Active" vs "All Archives") inside the Admin Dashboard.
* **Reason:** Separates ongoing stabilization missions from closed logs archives to optimize dispatcher view space.
