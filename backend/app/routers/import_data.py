from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ImportedFile
from ..schemas import ImportResult, ImportedFileOut
from ..services.pg_import import import_from_postgresql, parse_file_bytes, upsert_products

router = APIRouter(prefix="/api/import", tags=["import"])


@router.post("/postgresql", response_model=ImportResult)
def import_postgresql(table: str | None = None, db: Session = Depends(get_db)):
    try:
        return import_from_postgresql(db, table)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Falha ao importar do PostgreSQL: {exc}") from exc


@router.post("/file", response_model=ImportResult)
async def import_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    try:
        rows = parse_file_bytes(file.filename or "upload.csv", content)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(400, f"Arquivo inválido: {exc}") from exc
    return upsert_products(db, rows, "file", file.filename or "upload")


@router.get("/history", response_model=list[ImportedFileOut])
def import_history(db: Session = Depends(get_db)):
    return db.query(ImportedFile).order_by(ImportedFile.created_at.desc()).limit(50).all()
