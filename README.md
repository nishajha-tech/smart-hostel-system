# 🏨 SmartHostel 360™ - Intelligent Hostel Management System

SmartHostel 360 is a modern, enterprise-grade campus residential and hostel management web application. It features a dark glassmorphic UI, responsive layouts, a high-performance native SQLite relational database, and role-based access control (Admin & Warden personas).

---

## 🌟 Key Features

1. **Student Registration & Directory**:
   - Automated roll number suggestion (`STU-2024-xxx`)
   - Complete student directory with real-time search and filter by block, program, or allocation status.
   - 1-click room bed assignment and deallocation.

2. **Interactive Room & Bed Allocation Matrix**:
   - Visual floor plan for **Block A (Boys)**, **Block B (Girls)**, and **Block C (International / Scholars)**.
   - Real-time bed slot status: Empty / Occupied / Maintenance.
   - Resident rosters mapped by room and bed.

3. **Fee Records & Billing Ledger**:
   - Semester fee tracking, partial/full settlements, and overdue defaulters tracking.
   - Instant printable digital tax invoice receipts with watermark stamp.

4. **Complaints & Maintenance Desk**:
   - Issue tickets categorized by Electrical, Plumbing, Wi-Fi, Food, and Cleanliness.
   - SLA tracking, priority levels (Emergency, High, Medium, Low), and staff resolution logging.

5. **Visitor Gate Pass Registry**:
   - Digital gate pass token generation (`VP-xxxx`) with in/out timestamps.
   - Live campus visitor tracking and security departure checkouts.

6. **Warden Access Control & Granular Permissions**:
   - Chief Admin authority to create and manage warden accounts.
   - Granular privilege checkboxes (Allocate Rooms, Manage Complaints, Issue Passes, Manage Fees, View Reports).
   - Instant account activation and suspension.

7. **SQL Analytical Reports & Live Query Lab**:
   - Pre-built reports (Defaulters, Block Occupancy, Active Visitors, Category Complaints).
   - Live SQLite query console with millisecond execution timer and 1-click CSV export.

---

## 💻 Tech Stack

- **Frontend**: Vanilla HTML5, Modern CSS3 (Dark Glassmorphism, Google Fonts `Outfit`, `Inter`, `JetBrains Mono`), Vanilla JavaScript (ES6+).
- **Backend**: Node.js, Express.js (v5.x REST API).
- **Database**: SQLite with native `node:sqlite` (`DatabaseSync`), auto-initialized and auto-seeded schema on first run.
- **Port**: Configurable via `PORT` environment variable (defaults to `3000`).

---

## 🚀 Quick Setup Guide (Windows / Local)

### Prerequisites
- [Node.js](https://nodejs.org/) (Version **22.5.0** or higher recommended).
- Git installed on your computer.

### Installation Steps

1. **Open Terminal / PowerShell** in the project directory:
   ```bash
   cd smart-hostel-system
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables** (Optional):
   ```bash
   copy .env.example .env
   ```

4. **Start the Application**:
   ```bash
   npm start
   ```

5. **Open in Browser**:
   Navigate to: **`http://localhost:3000`**

---

## ☁️ How to Publish Online (Free Cloud Deployment)

### Deploying to Render.com (Recommended - 100% Free):
1. Push this project to your GitHub repository (see GitHub instructions below).
2. Go to [Render.com](https://render.com/) and sign up / log in with your GitHub account.
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository (`smart-hostel-system`).
5. Set the following settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Click **Deploy Web Service**.
7. In 1-2 minutes, Render will provide a live public link (e.g. `https://smart-hostel-system.onrender.com`).

---

## 🔐 Default Demo Accounts

| Role | Username | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Chief Admin (Dean)** | `admin` | `admin123` | Full Campus (All Blocks) |
| **Warden (Boys Wing)** | `warden_a` | `warden123` | Block A |
| **Warden (Girls Wing)** | `warden_b` | `warden123` | Block B |

---

## 🛡️ License & Credits
Developed as an advanced smart campus solution. Distributed under the ISC License.
