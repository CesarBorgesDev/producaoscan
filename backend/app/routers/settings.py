from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import ConnectionTestOut, SettingsIn, SettingsOut
from ..services.pg_import import get_or_create_settings, test_connection

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return get_or_create_settings(db)


@router.put("", response_model=SettingsOut)
def save_settings(payload: SettingsIn, db: Session = Depends(get_db)):
    row = get_or_create_settings(db)
    row.pg_host = payload.pg_host.strip()
    row.pg_port = payload.pg_port or 5432
    row.pg_database = payload.pg_database.strip()
    row.pg_username = payload.pg_username.strip()
    row.pg_password = payload.pg_password
    row.source_table = (payload.source_table or "catalogo_origem").strip()
    db.commit()
    db.refresh(row)
    return row


@router.post("/test-connection", response_model=ConnectionTestOut)
def ping_postgres(db: Session = Depends(get_db)):
    return test_connection(get_or_create_settings(db))
