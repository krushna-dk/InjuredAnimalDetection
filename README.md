# Injured Animal Detection and Rehabilitation Using AI

A full-stack web application that uses live camera feeds and AI vision to detect injured animals in real time, generate rescue reports, and notify nearby rescue teams.

---

## Features

- **Live Camera Feed** — Open browser webcam or DroidCam via MediaDevices API
- **Automatic AI Detection** — Capture frames at configurable intervals (2s–10s) and analyze with AI
- **Modular AI Provider** — Supports Google Gemini Vision, custom REST endpoints, and mock/demo mode
- **Duplicate Prevention** — In-memory cache + database-backed cooldown prevents report flooding
- **Rescue Reports** — Automatic report generation with unique IDs (IAD-YYYY-XXXX)
- **Dashboard** — Real-time metrics, AI result panel, status timeline, and dynamic report feed
- **Manual Reporting** — Citizen report submission form
    
---

## Tech Stack

| Layer     | Technology                                     |
| --------- | ---------------------------------------------- |
| Frontend  | HTML5, CSS3, Bootstrap 5, Vanilla JavaScript   |
| Backend   | Node.js, Express.js                            |
| Database  | MySQL 8 (`injured_animal_detection`)           |
| AI        | Google Gemini Vision (`gemini-flash-lite-latest`) |
| Security  | Helmet, CORS, Multer file validation           |

---

## 🚀 One-Click Launch (Easiest)

Simply double-click:
```bash
start_server.bat
```
This launcher automatically:
1. Clears any stuck process on port 5000
2. Starts the Node.js API server
3. Opens the platform directly in your default browser at `http://localhost:5000/index.html`

---

## Prerequisites

- **Node.js** ≥ 18
- **MySQL** ≥ 8.0 (running locally on port 3306)
- **Browser** with camera access (Chrome, Edge, Firefox)

---

## Manual Start Option

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Create the Database

**Option A — MySQL Command Line:**

```bash
mysql -u root -p < database.sql
```

**Option B — MySQL Workbench:**

1. Open MySQL Workbench → connect to your local instance
2. File → Open SQL Script → select `backend/database.sql`
3. Click the ⚡ Execute button
4. Verify tables: `cameras`, `detections`, `reports`, `rescue_contacts`

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `backend/.env` and fill in your values:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=animal_monitoring

# AI Configuration
# Options: "gemini", "custom", "mock"
# If no API key is provided, mock mode is used automatically
AI_PROVIDER=gemini
AI_API_KEY=your_gemini_api_key_here
AI_MODEL=gemini-1.5-flash

DUPLICATE_COOLDOWN_SECONDS=60
```

> **Note:** If you leave `AI_API_KEY` empty, the system automatically uses **mock/demo mode** with realistic simulated detections. You can test the full pipeline without an API key.

### 4. Start the Backend

```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

You should see:
```
==========================================================
[Server] Backend API running at http://localhost:5000
[AI Mode] Provider: gemini (Key present: false)
==========================================================
[Database] Successfully connected to MySQL database: animal_monitoring
```

### 5. Launch the Frontend

Open the project root folder in VS Code, then use **Live Server** extension:

1. Right-click `index.html` → "Open with Live Server"
2. Navigate to the **Automatic Detection Module** page
3. Click **Start Camera** → **Start Detection**

---

## Project Structure

```
InjuredAnimalDetection/
├── index.html                          # Landing page
├── style.css                           # Global stylesheet
├── script.js                           # Landing page script
│
├── manual-report/
│   └── manual-report.html              # Manual report submission form
│
├── automatic-module/
│   ├── automatic_module.html           # Live detection dashboard
│   └── automatic_module_script.js      # Camera + detection frontend logic
│
├── backend/
│   ├── server.js                       # Express server entry point
│   ├── package.json                    # Dependencies & scripts
│   ├── .env.example                    # Environment template
│   ├── database.sql                    # MySQL schema + seed data
│   │
│   ├── config/
│   │   └── db.js                       # MySQL connection pool
│   │
│   ├── controllers/
│   │   ├── detectionController.js      # Frame analysis endpoints
│   │   └── reportController.js         # Report CRUD endpoints
│   │
│   ├── services/
│   │   ├── aiService.js                # AI provider (Gemini/custom/mock)
│   │   ├── detectionService.js         # Frame processing lifecycle
│   │   ├── duplicateService.js         # Duplicate report prevention
│   │   └── reportService.js            # Report creation & queries
│   │
│   ├── middleware/
│   │   ├── uploadMiddleware.js         # Multer image upload config
│   │   └── errorMiddleware.js          # Centralized error handler
│   │
│   ├── routes/
│   │   ├── detectionRoutes.js          # Detection API routes
│   │   └── reportRoutes.js             # Report API routes
│   │
│   ├── scripts/
│   │   └── test-api.js                 # API smoke test script
│   │
│   └── uploads/                        # Captured frame storage
│
└── assets/                             # Static images & icons
```

---

## API Endpoints

| Method | Endpoint                  | Description                        |
| ------ | ------------------------- | ---------------------------------- |
| GET    | `/`                       | Health check & endpoint list       |
| POST   | `/api/detection/analyze`  | Upload frame for AI analysis       |
| GET    | `/api/detection/status`   | System status, AI config, stats    |
| POST   | `/api/detection/start`    | Mark detection session as started  |
| POST   | `/api/detection/stop`     | Mark detection session as stopped  |
| GET    | `/api/reports`            | List reports (paginated, filtered) |
| GET    | `/api/reports/:id`        | Single report with rescue contacts |
| POST   | `/api/reports`            | Create manual report               |

---

## Testing

Run the API smoke tests (backend must be running):

```bash
cd backend
npm run test-api
```

---

## AI Provider Configuration

### Google Gemini (Default)

Set in `.env`:
```env
AI_PROVIDER=gemini
AI_API_KEY=your_gemini_api_key
AI_MODEL=gemini-1.5-flash
```

### Custom REST Endpoint

For YOLO, Flask, FastAPI, or other vision servers:
```env
AI_PROVIDER=custom
AI_API_URL=http://localhost:8080/predict
AI_API_KEY=optional_bearer_token
```

### Mock / Demo Mode

No configuration needed — used automatically when no API key is provided:
```env
AI_PROVIDER=mock
```

Cycles through realistic scenarios: injured dog, healthy cat, severely injured dog, no animal.

---

## License

ISC
