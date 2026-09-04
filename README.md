# 🚗 Fuel Share — Smart Fuel Cost Sharing & Ride Matching Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-000000?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql)](https://www.postgresql.org)
[![Razorpay](https://img.shields.io/badge/Payments-Razorpay_SDK-0C2340?logo=razorpay)](https://razorpay.com)

**Fuel Share** is a smart, transparent, and eco-friendly mobility platform that enables daily commuters to pool rides, share exact fuel expenses, reduce individual transit costs, and lower urban carbon footprints.

---

## 🌟 Key Features

* 🔐 **Secure JWT Authentication**: User registration, login, profile management, and Argon2 password hashing.
* 🚗 **Vehicle & Mileage Registry**: Store vehicle details (type, fuel type, mileage in km/L) to calculate exact fuel consumption.
* 🗺️ **Haversine Proximity & Distance Calculation**: Mathematical spatial distance calculation between pickup and drop-off coordinates.
* ⚡ **Rule-Based Ride Matching Engine**: 5-point match algorithm assessing route proximity, time windows, and seat availability (returns a 0–100% compatibility score with human-readable match reasons).
* 🎫 **Join Requests & Transaction-Safe Seat Reservation**: Passengers request to join trips; creators accept/reject requests with PostgreSQL row locking (`WITH FOR UPDATE`) to prevent double-booking.
* 💰 **Transparent Fuel Cost Calculation**: Formula-driven equal cost-sharing breakdown based on vehicle mileage, trip distance, fuel price, and participant count.
* 💳 **Razorpay Test Payment Integration**: Integrated Razorpay order creation and HMAC-SHA256 signature verification for seamless fuel contribution payments.
* 🌱 **Real Impact Dashboard**: Personalized dashboard tracking real financial savings (₹), fuel saved (Litres), estimated $\text{CO}_2$ reduced (kg), and a live activity feed.

---

## 🛠️ Technology Stack

### **Backend**
* **Framework**: FastAPI (Python 3.11+)
* **Database**: PostgreSQL / SQLite (Development) + SQLAlchemy ORM + Alembic Migrations
* **Auth**: PyJWT + Argon2 password hashing
* **Payment Gateway**: Razorpay Python SDK + HMAC-SHA256 signature verification
* **Testing**: pytest (45 passing unit and integration test cases)

### **Frontend**
* **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
* **Styling**: Tailwind CSS v4
* **State & Auth**: React Context API (`AuthContext`) + Centralized API Client (`apiFetch`)

---

## 📐 System Architecture & Workflow

```
[User A: Trip Creator]                     [User B: Passenger]
         │                                          │
         ├─ 1. Register & Add Vehicle               ├─ 1. Register / Login
         ├─ 2. Offer Fuel Share (A → B)             ├─ 2. Find Compatible Trips
         │                                          ├─ 3. Request to Join
         ├─ 3. Receives Join Request                │
         ├─ 4. Accepts Request                      │
         │   └─ Seats updated (-1)                  │
         │   └─ Calculates Cost Share               ├─ 4. Sees Contribution Amount
         │                                          ├─ 5. Pay via Razorpay Checkout
         ├─ 5. Backend Verifies Signature ◄───────┤
         │   └─ Status = SUCCESS                    │
         │                                          │
         ▼                                          ▼
   [Impact Dashboard: Money Saved ₹ | Fuel Saved L | CO₂ Reduced kg]
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* Python 3.11+
* Node.js 18+ & npm
* Git

---

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
# or install core dependencies:
pip install fastapi uvicorn sqlalchemy psycopg pydantic pydantic-settings pyjwt passlib argon2-cffi razorpay pytest

# Setup environment variables
cp .env.example .env

# Run database migrations (or auto-create tables)
alembic upgrade head

# Seed demo dataset (Gujarat routes: Ahmedabad, Gandhinagar, Anand, Bopal)
python scripts/seed_demo_data.py

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
Backend API interactive documentation available at: **http://localhost:8000/docs**

---

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Start Next.js development server
npm run dev
```
Frontend Web App available at: **http://localhost:3000**

---

## 🔑 Environment Variables Guide

### **Backend (`backend/.env`)**
```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/fuelshare
APP_NAME=Fuel Share
APP_ENV=development

# JWT Authentication
JWT_SECRET_KEY=fuelshare_secret_key_change_in_production_2026
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Matching Engine & Fuel Defaults
MATCH_THRESHOLD=60
DEFAULT_FUEL_PRICE=100.0

# Razorpay Test Credentials (Backend Only)
RAZORPAY_KEY_ID=rzp_test_fuelshare123
RAZORPAY_KEY_SECRET=rzp_test_secret_key_456
```

### **Frontend (`frontend/.env.local`)**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_fuelshare123
```

---

## 🧪 Running Tests

### Backend Unit & Integration Tests (45 Tests)
```bash
cd backend
.\.venv\Scripts\python.exe -m pytest tests/ -v
```

### Frontend Production Build Verification
```bash
cd frontend
npm run build
```

---

## 🏆 Recommended 10-Step Hackathon Demo Walkthrough

1. **Log in as Creator (User A)**:
   * Email: `margil@fuelshare.com` | Password: `password123`
2. **View Vehicles**: Observe registered Honda City (Mileage: 16.5 km/L).
3. **Offer Fuel Share**: Create a trip from *Ahmedabad Junction* to *Gandhinagar Bus Station*.
4. **Log in as Passenger (User B)** in another browser/incognito window:
   * Email: `rahul@fuelshare.com` | Password: `password123`
5. **Find Matches**: Click **"Find Matches"** to see compatible routes with match percentage badges (e.g. 94% Match) and reason breakdowns.
6. **Request to Join**: User B submits a join request for User A's trip.
7. **Accept Request**: User A reviews incoming request on `/fuel-shares/[id]` and clicks **Accept**. Seat count decrements by 1 automatically.
8. **View Cost Breakdown**: User B sees transparent fuel cost breakdown (Total cost: ₹250, Cost per participant: ₹125).
9. **Pay with Razorpay**: User B clicks **"Pay ₹125 with Razorpay"**. Completes test payment modal. Backend verifies HMAC-SHA256 signature and returns `SUCCESS`.
10. **Impact Dashboard**: Open `/dashboard` to view real financial savings (₹), fuel saved (L), $\text{CO}_2$ reduced (kg), and live activity feed.

---

## 📄 License
Licensed under the MIT License.
