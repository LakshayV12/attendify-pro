# Attendify Pro — Student Attendance Management System

A modern, institutional-grade **Student Attendance Management System** built with **Node.js**, **Express**, native **SQLite (`node:sqlite`)**, and **modern CSS & Vanilla JavaScript**.

Designed with rich glassmorphism aesthetics, live analytics charts, QR code digital ID passes, camera-based scanning, automated <75% low attendance alerts, and institutional reporting.

---

## ✨ Key Features

1. **📊 Visual Analytics Dashboard**
   - KPI metrics: Total Enrolled Students, Present Today, Absent Today, Late / Excused Breakdown, Cumulative Academic Rate.
   - Interactive 14-Day Attendance Trend chart with 75% institutional threshold indicator.
   - Today's Status Doughnut distribution chart.
   - Inter-class performance comparison bar chart.

2. **✍️ Attendance Marking Roster**
   - General Daily Attendance and Subject-wise lecture attendance.
   - Date picker with quick jump to today.
   - Status toggle buttons: **Present (P)**, **Absent (A)**, **Late (L)**, **Excused (E)**.
   - Bulk actions: "Mark All Present", "Mark All Absent".
   - Individual remarks and time logs with auto-save indication.

3. **📷 Digital ID & QR Code Scanner**
   - Integrated camera feed using standard web APIs.
   - Laser sweep animated scanning reticle.
   - **Audio confirmation chime** synthesized via the Web Audio API.
   - USB Barcode reader / manual roll number input support.
   - **Interactive scan simulator** allowing test scans from the roster without a physical webcam.
   - Verified student pop-in cards and real-time scan feed.

4. **👥 Student & Class Management**
   - Filter and search student directory by name, roll number, or class.
   - Detailed student profiles with full date-by-date attendance history logs.
   - Modal forms for adding students, classes, and subjects.

5. **🪪 Student ID Cards & Printable Badges**
   - Dynamically generated SVG QR code passes.
   - Student avatar, name, roll number, class, and institutional session header.
   - Optimized for single or bulk printing on standard paper.

6. **📈 Institutional Reports & Export**
   - Range-filtered monthly attendance matrix table.
   - One-click **Export to CSV / Excel** format.
   - Print-ready official register with page breaks, header, and signature blocks.

7. **⚠️ Low Attendance Warning System (<75%)**
   - Real-time detection of students below the mandatory 75% threshold.
   - Direct access to parent/guardian contact numbers.
   - One-click **Draft Official Deficiency Notice** ready to copy/send.

8. **🎨 Modern Aesthetics & Dark/Light Mode**
   - Responsive Glassmorphism design with backdrop filters.
   - Theme toggle between Obsidian Dark and Clean Slate Light modes.
   - Live digital clock and status pills.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ or v24+ recommended, uses native `node:sqlite`)
- Modern web browser (Chrome, Edge, Firefox, Safari)

### Installation & Run

1. Clone or navigate to the project directory:
   ```bash
   cd "d:\New folder"
   ```

2. Start the application:
   ```bash
   npm start
   ```
   Or run with automatic file watching in development:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 📂 Project Architecture

```
d:\New folder\
├── server.js               # Express server with REST API endpoints
├── database.js             # SQLite schema, migrations, and seed dataset
├── package.json            # Project dependencies and npm scripts
├── public/
│   ├── index.html          # Semantic HTML5 accessible dashboard
│   ├── css/
│   │   ├── style.css       # Design tokens, themes, glassmorphism, components
│   │   └── print.css       # Stylesheet for official printouts and ID passes
│   └── js/
│       ├── app.js          # Core application logic and API client
│       ├── charts.js       # Lightweight, high-DPI vanilla canvas chart engine
│       ├── scanner.js      # Camera QR scanner and Web Audio chime engine
│       └── qr-generator.js # Self-contained vector SVG QR code generator
└── README.md               # Documentation
```

---

## 🧪 Demo Data & Reset

The system initializes with a rich set of 22 students across 3 classes (*Class 10 - Sec A*, *Class 11 - Science*, *Class 12 - CS & Tech*) and 14 days of realistic attendance history (including high performers and students needing intervention).

To reset or refresh the sample dataset at any time, click the **Reset Icon** in the top navigation bar or trigger `POST /api/seed/reset`.
