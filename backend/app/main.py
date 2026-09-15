from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine, ensure_schema
from .routers import import_data, productions, products, settings as settings_router
from .services.pg_import import get_or_create_settings
from .database import SessionLocal

Base.metadata.create_all(bind=engine)
ensure_schema()

with SessionLocal() as db:
    get_or_create_settings(db)

origins = (
    ["*"]
    if settings.cors_origins.strip() == "*"
    else [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
)

app = FastAPI(title="ProducaoScan API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(productions.router)
app.include_router(settings_router.router)
app.include_router(import_data.router)


@app.get("/api/health")
def health():
    return {"ok": True, "service": "producaoscan"}
