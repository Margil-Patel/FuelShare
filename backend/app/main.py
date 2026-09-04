from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.controllers.root import router as root_router
from app.controllers.health import router as health_router
from app.controllers.auth import router as auth_router
from app.controllers.users import router as users_router
from app.controllers.vehicles import router as vehicles_router
from app.controllers.fuel_shares import router as fuel_shares_router
from app.controllers.locations import router as locations_router
from app.controllers.matches import router as matches_router
from app.controllers.join_requests import router as join_requests_router
from app.controllers.payments import router as payments_router
from app.controllers.dashboard import router as dashboard_router
from app.controllers.ride_requests_corridor import router as ride_requests_corridor_router
from app.controllers.corridor_matches import router as corridor_matches_router

app = FastAPI(
    title=settings.APP_NAME,
    description="Fuel Share Backend API - Smart fuel sharing and ride matching platform.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register controllers
app.include_router(root_router)
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(vehicles_router)
app.include_router(fuel_shares_router)
app.include_router(locations_router)
app.include_router(matches_router)
app.include_router(join_requests_router)
app.include_router(payments_router)
app.include_router(dashboard_router)
app.include_router(ride_requests_corridor_router)
app.include_router(corridor_matches_router)
