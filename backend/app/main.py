import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine, SessionLocal
from app.models import user, client, order, business_config  # Ensures tables are registered
from app.database import Base
from app.services.auth_service import create_admin_if_not_exists
from app.routers import auth, clients, orders, dashboard, config as config_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables (Alembic manages migrations in prod, this is a fallback)
    Base.metadata.create_all(bind=engine)
    # Create admin user if not exists
    db = SessionLocal()
    try:
        create_admin_if_not_exists(db)
    finally:
        db.close()
    # Ensure static folder exists
    os.makedirs("static/logos", exist_ok=True)
    yield


app = FastAPI(
    title="Sistema Shoper - API",
    description="Sistema de Gestión de Pedidos para Shoper",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - Allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", "https://your-frontend.onrender.com"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files (logos)
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Routers
app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(orders.router)
app.include_router(dashboard.router)
app.include_router(config_router.router)


@app.get("/")
def root():
    return {"message": "Sistema Shoper API v1.0", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
