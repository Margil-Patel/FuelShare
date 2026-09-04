# Fuel Share Backend API

FastAPI + PostgreSQL + SQLAlchemy + Alembic backend foundation for the Fuel Share project.

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application entrypoint
│   ├── controllers/         # REST API route handlers
│   ├── models/              # SQLAlchemy database models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── services/            # Core business logic layer
│   └── core/                # App config & DB connection settings
├── alembic/                 # Database migration scripts
├── alembic.ini              # Alembic config
├── requirements.txt         # Dependencies
├── .env.example             # Template environment variables
└── README.md
```

## Local Setup & Run Instructions

1. Create a Python Virtual Environment:
   ```bash
   python -m venv .venv
   ```

2. Activate the Virtual Environment:
   - Windows PowerShell:
     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```
   - Linux/macOS:
     ```bash
     source .venv/bin/activate
     ```

3. Install Dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set Up Environment Variables:
   Copy `.env.example` to `.env` and adjust your PostgreSQL `DATABASE_URL`:
   ```env
   DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/fuelshare
   APP_NAME=Fuel Share
   APP_ENV=development
   ```

5. Run the FastAPI Server:
   ```bash
   uvicorn app.main:app --reload
   ```

6. Access Endpoints & Interactive Docs:
   - Root Status: [http://localhost:8000/](http://localhost:8000/)
   - Health Check: [http://localhost:8000/health](http://localhost:8000/health)
   - Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
   - ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
