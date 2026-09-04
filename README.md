# 🚗 FuelShare — Smart Commuter Ride-Matching & Proportional Fuel Sharing Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_%2F_SQLite-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Razorpay](https://img.shields.io/badge/Payments-Razorpay_Integration-0C2340?logo=razorpay&logoColor=white)](https://razorpay.com)
[![Leaflet](https://img.shields.io/badge/Maps-Leaflet_%26_OSM-199900?logo=leaflet&logoColor=white)](https://leafletjs.com)
[![Tests](https://img.shields.io/badge/Tests-70_Passed-success?logo=pytest&logoColor=white)](https://pytest.org)

**FuelShare** is an intelligent carpooling and automated fuel cost-sharing platform designed for daily working professionals and students. 

Unlike commercial taxi-booking apps where drivers operate dedicated taxi trips, **FuelShare connects everyday commuters already traveling to their regular workplace or university**. Drivers can offer their empty vehicle seats to fellow commuters heading along the same travel path, enabling drivers to offset their fuel expenses while passengers travel conveniently and pay **only for their exact proportional segment share** via secure Razorpay payment settlement.

---

## 🌟 Key Highlights & Innovations

### 1. 🛣️ Dynamic Route Corridor Matching Engine
* **Sub-Segment Discovery**: Passengers can search for rides covering their specific pickup and drop-off points, even if they only need a ride for an intermediate portion of the driver's broader route.
* **Geospatial Polyline & Buffer Analysis**: Uses trajectory projection along encoded route polylines to verify that intermediate passenger waypoints fall within acceptable buffer thresholds without causing driver detours.
* **Interactive OpenStreetMap Visualization**: Full route polyline rendering with Leaflet, customizable map pickers, and live location autocomplete.

### 2. 💰 Proportional Segment Cost Calculation
* **Fair Micro-Segment Pricing**: Rather than charging passengers for the entire trip, FuelShare dynamically computes the exact fraction of the distance traveled by the passenger and calculates their proportional fuel expense.
* **Formula**:
  $$\text{Passenger Share} = \left(\frac{\text{Passenger Segment Distance}}{\text{Vehicle Mileage (km/L)}}\right) \times \text{Fuel Price (₹/L)}$$
* **Vehicle-Aware Efficiency**: Automatically reads the driver's registered vehicle fuel efficiency (km/L) to calculate exact consumption.

### 3. 💳 Razorpay Payment Integration
* **Segment-Specific Settlement**: Generates backend Razorpay orders for the precise proportional amount (e.g., ₹19.07 for sub-segments rather than the ₹175.00 total trip fuel cost).
* **Cryptographic Verification**: Server-side HMAC-SHA256 signature validation guarantees transaction integrity, prevents replay attacks, and provides idempotent receipts.
* **Seamless Sandbox / Test Simulation**: Includes built-in test payment simulation for instant local development and testing, alongside full production Razorpay Checkout SDK compatibility.

### 4. 🎫 End-to-End Commuter Workflows
* **Seat Reservation & Concurrency Safety**: Row-level locking (`WITH FOR UPDATE`) during seat reservation prevents race conditions and overbooking.
* **Passenger Request Tracking (`/my-requests`)**: Dedicated commuter hub for tracking join request statuses (Pending, Accepted, Rejected) with real-time **"✅ Paid"** status badges.
* **Driver Management Hub (`/my-trips` & `/fuel-shares/[id]/matches`)**: Trip creators can view incoming requests, review passenger matches, accept/reject reservations, and monitor participant contributions.

### 5. 🌱 Commuter Impact Dashboard (`/dashboard`)
* Aggregates real-time financial savings (₹), fuel saved (Litres), estimated carbon emissions reduced (kg $\text{CO}_2$), and live commute activity.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | **FastAPI** (Python 3.11+), **SQLAlchemy ORM**, **Alembic**, **Pydantic v2** |
| **Frontend** | **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS v4** |
| **Mapping & GIS** | **Leaflet**, **React-Leaflet**, **OpenStreetMap (OSM)**, **OSRM Routing Engine** |
| **Authentication** | **PyJWT** (Bearer JWT Tokens), **Argon2 / Passlib** Password Hashing |
| **Payments** | **Razorpay Python SDK** + **Razorpay Checkout.js** + HMAC-SHA256 Verification |
| **Database** | **PostgreSQL** (Production) / **SQLite** (Development) |
| **Testing** | **pytest** (70 comprehensive unit & integration tests) |

---

## 📐 System Architecture & Workflow

```
[Vehicle Owner / Driver]                                 [Commuter / Passenger]
         │                                                         │
         ├─ 1. Register & Add Vehicle Profile                      ├─ 1. Register / Login
         ├─ 2. Post Commute with Route (Origin → Destination)      ├─ 2. Search Sub-Route (Pickup → Drop-off)
         │    └─ Interactive Map & Est. Total Fuel Cost            │    └─ Geospatial Corridor Match Engine
         │                                                         ├─ 3. Reviews Proportional Fare (e.g., ₹19.07)
         │                                                         ├─ 4. Submits Join Request
         ├─ 3. Receives Incoming Request                           │
         ├─ 4. Accepts Request (Seat Decremented Safely)           │
         │    └─ Status = ACCEPTED                                 │
         │                                                         ├─ 5. Opens Trip / My Requests Dashboard
         │                                                         ├─ 6. Clicks "Pay ₹19.07 with Razorpay"
         ├─ 5. Backend Verifies HMAC Signature ◄───────────────────┤    └─ Razorpay Order Created (1907 paise)
         │    └─ Payment Status = SUCCESS                          │
         ▼                                                         ▼
   [Real-Time Sync: Driver Recovers Fuel Cost  •  Passenger Sees "✅ Paid"  •  Impact Dashboard Updated]
```

---

## 🚀 Getting Started

### 1. Prerequisites
* **Python 3.11+**
* **Node.js 18+** and **npm**
* **Git**

---

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Copy .env.example or create .env:
```

Create or verify `backend/.env`:
```env
DATABASE_URL=sqlite:///./fuelshare.db
APP_NAME=Fuel Share
APP_ENV=development

# JWT Authentication
JWT_SECRET_KEY=fuelshare_secret_key_change_in_production_2026
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Matching Engine & Defaults
MATCH_THRESHOLD=60
DEFAULT_FUEL_PRICE=100.0

# Razorpay Credentials
RAZORPAY_KEY_ID=rzp_test_fuelshare123
RAZORPAY_KEY_SECRET=rzp_test_secret_key_456
```

```bash
# Seed initial demo data (Gujarat commuter routes: Vadodara, Ahmedabad, Anand, Gandhinagar)
python scripts/seed_demo_data.py

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```
Interactive API Swagger documentation is available at: **http://localhost:8000/docs**

---

### 3. Frontend Setup

```bash
# Open a new terminal and navigate to frontend
cd frontend

# Install npm packages
npm install

# Start Next.js development server
npm run dev
```
Frontend web application is available at: **http://localhost:3000**

---

## 🧪 Running Automated Tests

The backend includes a test suite covering authentication, vehicle management, fuel calculations, corridor matching algorithms, join request state machines, and payment signature verification.

```bash
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

**Test Summary:** `70 passed in 9.3s`

---

## 🧭 Application Routes

| Route | Description |
|---|---|
| `/` | Landing page explaining platform benefits, stats, and how it works |
| `/login` & `/register` | JWT Authentication with client-side form validation |
| `/dashboard` | Personal commuter impact dashboard (money saved, fuel saved, carbon offset) |
| `/fuel-shares` | Browse all active fuel share offers |
| `/fuel-shares/create` | Create a new trip with interactive map picker, route polyline, and seat count |
| `/fuel-shares/[id]` | Trip details page with participant list, cost breakdown, and Razorpay payment card |
| `/corridor-matches` | Search for drivers whose routes pass through your intermediate pickup & drop-off |
| `/my-requests` | Passenger dashboard tracking submitted requests with real-time "Paid" status |
| `/my-trips` | Driver dashboard managing offered trips, status toggles, and edit actions |
| `/vehicles` | Manage registered vehicles (mileage in km/L, fuel type) |
| `/profile` | User profile management and contact details |

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
