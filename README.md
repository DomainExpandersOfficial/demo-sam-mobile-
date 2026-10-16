# SAM MOBILE - Field Sales Management & Retail ERP

A modern Field Force & Distribution ERP system built specifically for Mobile Handset Distributors & Retailers in Noida / NCR.

## 🚀 Quick Start

### 1. Frontend (Root Directory)
The frontend is built with **TypeScript + Vite** and uses **IndexedDB** for browser-based offline-first data storage.
```bash
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 2. Backend (Separate `backend/` Folder)
The backend is built in **TypeScript + Express** with persistent storage, ready to connect to PostgreSQL / Supabase / MongoDB.
```bash
cd backend
npm install
npm run dev
```
Runs at **http://localhost:5000/api**.

---

## 📱 Feature Mapping (From Requirements Note)

| # | Feature | Implementation Details |
|---|---|---|
| **1** | **Attendance** | Daily punch-in / punch-out with live timestamps, GPS geofencing and presence register. |
| **2** | **Tracking** | Field agent route simulation across Noida (Sector 18, 29, 62), battery %, distance & online pings. |
| **3** | **Store & Location Submission** | Store visit submission with photo upload/camera preview and GPS grab. Auto-ticks **`[✓] Verified Visit`** status. |
| **4** | **Party Amount & Payment Reminder** | Outstanding ledger balance with due date, credit limit warning, and **1-Click WhatsApp Reminder** pre-filled with UPI pay link. |
| **5** | **Customer Biodata (CRM)** | Detailed customer profiles: store name, owner name, phone, address, GSTIN, and retail history. |
| **6** | **Invoice Creating** | Handset billing engine with **15-digit IMEI number tracking**, item rows, auto-tax (GST 18%), and printable tax receipt. |
| **7** | **Total Collection (UPI vs Cash)** | Payment register with split payments, real-time KPI totals, Cash vs UPI percentage bar, and ledger filters. |

---

## 🔄 Switching Storage Engines & Migration
Inside the application, open the **"Database & Backup"** tab:
1. **Toggle Storage Mode:** Switch between `IndexedDB (Local)` and `Backend REST API (localhost:5000)`.
2. **Export JSON:** Download complete application data into a single `.json` file for easy server database seeding.
3. **Import JSON:** Restore or upload data into the browser database.
