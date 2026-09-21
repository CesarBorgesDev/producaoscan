from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import TransferItem, TransferRequest
from ..schemas import (
    FilialOut,
    ManualItemIn,
    ScanIn,
    TransferExportResult,
    TransferIn,
    TransferItemOut,
    TransferOut,
)
from ..services.pg_filiais import get_filial, list_filiais
from ..services.pg_import import get_or_create_settings
from ..services.pg_transfer_export import export_transfer
from ..services.product_lookup import find_product_by_code, manual_barcode, normalize_weight_kg
from ..toledo import parse_toledo_barcode

router = APIRouter(prefix="/api/transfers", tags=["transfers"])


def _recalc(db: Session, transfer: TransferRequest) -> None:
    items = transfer.items
    weight = sum(it.weight_kg or 0 for it in items)
    price = sum(it.total_price or 0 for it in items)
    transfer.item_count = len(items)
    transfer.total_weight = round(weight, 3)
    transfer.total_price = round(price, 2)
    db.commit()
    db.refresh(transfer)


def _get_transfer(db: Session, transfer_id: str, with_items: bool = False) -> TransferRequest:
    query = db.query(TransferRequest)
    if with_items:
        query = query.options(joinedload(TransferRequest.items))
    row = query.filter(TransferRequest.id == transfer_id).one_or_none()
    if not row:
        raise HTTPException(404, "Requisição de transferência não encontrada.")
    return row


def _is_exported(transfer: TransferRequest) -> bool:
    return transfer.exported_pg_id is not None or transfer.status == "enviada"


def _ensure_open(transfer: TransferRequest) -> None:
    if _is_exported(transfer):
        raise HTTPException(409, "Requisição enviada ao Uniplus — alteração bloqueada.")
    if transfer.status == "excluida":
        raise HTTPException(409, "Requisição excluída — operação bloqueada.")
    if transfer.status == "concluida":
        raise HTTPException(409, "Requisição concluída — coleta bloqueada.")


def _ensure_not_exported(transfer: TransferRequest) -> None:
    if _is_exported(transfer):
        raise HTTPException(409, "Requisição enviada ao Uniplus — alteração e exclusão bloqueadas.")


def _add_transfer_item(db: Session, transfer: TransferRequest, product, weight_kg: float, barcode: str):
    unit_price = product.unit_price or 0
    item = TransferItem(
        barcode=barcode,
        product_code=product.code,
        product_name=product.name,
        weight_kg=weight_kg,
        unit_price=unit_price,
        total_price=round(weight_kg * unit_price, 2),
        transfer_id=transfer.id,
    )
    db.add(item)
    db.flush()
    _recalc(db, transfer)
    db.refresh(item)
    return item


@router.get("/filiais", response_model=list[FilialOut])
def list_transfer_filiais(db: Session = Depends(get_db)):
    return list_filiais(get_or_create_settings(db))


@router.get("", response_model=list[TransferOut])
def list_transfers(
    include_deleted: bool = Query(False),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(TransferRequest)
    if status:
        query = query.filter(TransferRequest.status == status)
    elif not include_deleted:
        query = query.filter(TransferRequest.status != "excluida")
    return query.order_by(TransferRequest.created_at.desc()).all()


@router.post("", response_model=TransferOut)
def create_transfer(payload: TransferIn, db: Session = Depends(get_db)):
    filial = get_filial(get_or_create_settings(db), payload.filial_id)
    existing = (
        db.query(TransferRequest)
        .filter(
            TransferRequest.status == "em_andamento",
            TransferRequest.filial_id == filial["id"],
        )
        .order_by(TransferRequest.created_at.desc())
        .first()
    )
    if existing:
        return existing

    label = (payload.label or "").strip() or f"Transferência {filial['name']}"
    row = TransferRequest(
        label=label[:255],
        status=payload.status or "em_andamento",
        filial_id=filial["id"],
        filial_code=filial.get("code"),
        filial_name=filial["name"],
        request_date=payload.request_date or date.today(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{transfer_id}", response_model=TransferOut)
def get_transfer(transfer_id: str, db: Session = Depends(get_db)):
    return _get_transfer(db, transfer_id)


@router.put("/{transfer_id}", response_model=TransferOut)
def update_transfer(transfer_id: str, payload: TransferIn, db: Session = Depends(get_db)):
    row = _get_transfer(db, transfer_id)
    _ensure_not_exported(row)
    if row.status == "excluida":
        raise HTTPException(409, "Requisição excluída — operação bloqueada.")
    if payload.label and payload.label.strip():
        row.label = payload.label.strip()[:255]
    row.status = payload.status
    if payload.request_date:
        row.request_date = payload.request_date
    if payload.status == "excluida" and row.deleted_at is None:
        row.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


@router.post("/{transfer_id}/delete", response_model=TransferOut)
def soft_delete_transfer(transfer_id: str, db: Session = Depends(get_db)):
    row = _get_transfer(db, transfer_id)
    _ensure_not_exported(row)
    if row.status == "excluida":
        return row
    row.status = "excluida"
    row.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


@router.post("/{transfer_id}/export", response_model=TransferExportResult)
def export_transfer_route(transfer_id: str, db: Session = Depends(get_db)):
    row = _get_transfer(db, transfer_id, with_items=True)
    try:
        return export_transfer(db, row)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Falha ao enviar para o PostgreSQL: {exc}") from exc


@router.get("/{transfer_id}/items", response_model=list[TransferItemOut])
def list_items(transfer_id: str, db: Session = Depends(get_db)):
    _get_transfer(db, transfer_id)
    return (
        db.query(TransferItem)
        .filter(TransferItem.transfer_id == transfer_id)
        .order_by(TransferItem.created_at.desc())
        .all()
    )


@router.post("/{transfer_id}/scan", response_model=TransferItemOut)
def scan_item(transfer_id: str, payload: ScanIn, db: Session = Depends(get_db)):
    transfer = _get_transfer(db, transfer_id)
    _ensure_open(transfer)

    parsed = parse_toledo_barcode(payload.barcode)
    if not parsed:
        raise HTTPException(
            400,
            "Etiqueta inválida. Use o padrão 2CCCC0TTTTTT (C=código, T=quantidade em kg).",
        )

    product = find_product_by_code(db, parsed["product_code"])
    return _add_transfer_item(db, transfer, product, parsed["weight_kg"], parsed["raw"])


@router.post("/{transfer_id}/manual", response_model=TransferItemOut)
def add_manual_item(transfer_id: str, payload: ManualItemIn, db: Session = Depends(get_db)):
    transfer = _get_transfer(db, transfer_id)
    _ensure_open(transfer)
    product = find_product_by_code(db, payload.product_code)
    weight_kg = normalize_weight_kg(payload.weight_kg)
    return _add_transfer_item(
        db,
        transfer,
        product,
        weight_kg,
        manual_barcode(product.code, weight_kg),
    )


@router.delete("/{transfer_id}/items/{item_id}", status_code=204)
def delete_item(transfer_id: str, item_id: str, db: Session = Depends(get_db)):
    transfer = _get_transfer(db, transfer_id)
    _ensure_open(transfer)
    item = db.get(TransferItem, item_id)
    if not item or item.transfer_id != transfer_id:
        raise HTTPException(404, "Item não encontrado.")
    db.delete(item)
    db.flush()
    _recalc(db, transfer)
