from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Loss, LossItem
from ..schemas import LossIn, LossItemOut, LossOut, ManualItemIn, ScanIn
from ..services.product_lookup import find_product_by_code, manual_barcode, normalize_weight_kg
from ..toledo import parse_toledo_barcode

router = APIRouter(prefix="/api/losses", tags=["losses"])


def _recalc(db: Session, loss: Loss) -> None:
    items = loss.items
    weight = sum(it.weight_kg or 0 for it in items)
    price = sum(it.total_price or 0 for it in items)
    loss.item_count = len(items)
    loss.total_weight = round(weight, 3)
    loss.total_price = round(price, 2)
    db.commit()
    db.refresh(loss)


def _get_loss(db: Session, loss_id: str, with_items: bool = False) -> Loss:
    query = db.query(Loss)
    if with_items:
        query = query.options(joinedload(Loss.items))
    row = query.filter(Loss.id == loss_id).one_or_none()
    if not row:
        raise HTTPException(404, "Registro de perda não encontrado.")
    return row


def _ensure_open(loss: Loss) -> None:
    if loss.status == "excluida":
        raise HTTPException(409, "Perda excluída — operação bloqueada.")
    if loss.status == "concluida":
        raise HTTPException(409, "Perda concluída — coleta bloqueada.")


def _add_loss_item(db: Session, loss: Loss, product, weight_kg: float, barcode: str):
    unit_price = product.unit_price or 0
    item = LossItem(
        barcode=barcode,
        product_code=product.code,
        product_name=product.name,
        weight_kg=weight_kg,
        unit_price=unit_price,
        total_price=round(weight_kg * unit_price, 2),
        loss_id=loss.id,
    )
    db.add(item)
    db.flush()
    _recalc(db, loss)
    db.refresh(item)
    return item


@router.get("", response_model=list[LossOut])
def list_losses(
    include_deleted: bool = Query(False),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Loss)
    if status:
        query = query.filter(Loss.status == status)
    elif not include_deleted:
        query = query.filter(Loss.status != "excluida")
    return query.order_by(Loss.created_at.desc()).all()


@router.post("", response_model=LossOut)
def create_loss(payload: LossIn, db: Session = Depends(get_db)):
    existing = (
        db.query(Loss)
        .filter(Loss.status == "em_andamento")
        .order_by(Loss.created_at.desc())
        .first()
    )
    if existing:
        return existing

    label = (payload.label or "").strip() or f"Perda {date.today().strftime('%d/%m/%Y')}"
    row = Loss(
        label=label[:255],
        status=payload.status or "em_andamento",
        loss_date=payload.loss_date or date.today(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{loss_id}", response_model=LossOut)
def get_loss(loss_id: str, db: Session = Depends(get_db)):
    return _get_loss(db, loss_id)


@router.put("/{loss_id}", response_model=LossOut)
def update_loss(loss_id: str, payload: LossIn, db: Session = Depends(get_db)):
    row = _get_loss(db, loss_id)
    if row.status == "excluida":
        raise HTTPException(409, "Perda excluída — operação bloqueada.")
    if payload.label and payload.label.strip():
        row.label = payload.label.strip()[:255]
    row.status = payload.status
    if payload.loss_date:
        row.loss_date = payload.loss_date
    if payload.status == "excluida" and row.deleted_at is None:
        row.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


@router.post("/{loss_id}/delete", response_model=LossOut)
def soft_delete_loss(loss_id: str, db: Session = Depends(get_db)):
    row = _get_loss(db, loss_id)
    if row.status == "excluida":
        return row
    row.status = "excluida"
    row.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


@router.get("/{loss_id}/items", response_model=list[LossItemOut])
def list_items(loss_id: str, db: Session = Depends(get_db)):
    _get_loss(db, loss_id)
    return (
        db.query(LossItem)
        .filter(LossItem.loss_id == loss_id)
        .order_by(LossItem.created_at.desc())
        .all()
    )


@router.post("/{loss_id}/scan", response_model=LossItemOut)
def scan_item(loss_id: str, payload: ScanIn, db: Session = Depends(get_db)):
    loss = _get_loss(db, loss_id)
    _ensure_open(loss)
    parsed = parse_toledo_barcode(payload.barcode)
    if not parsed:
        raise HTTPException(
            400,
            "Etiqueta inválida. Use o padrão 2CCCC0TTTTTT (C=código, T=quantidade em kg).",
        )
    product = find_product_by_code(db, parsed["product_code"])
    return _add_loss_item(db, loss, product, parsed["weight_kg"], parsed["raw"])


@router.post("/{loss_id}/manual", response_model=LossItemOut)
def add_manual_item(loss_id: str, payload: ManualItemIn, db: Session = Depends(get_db)):
    loss = _get_loss(db, loss_id)
    _ensure_open(loss)
    product = find_product_by_code(db, payload.product_code)
    weight_kg = normalize_weight_kg(payload.weight_kg)
    return _add_loss_item(db, loss, product, weight_kg, manual_barcode(product.code, weight_kg))


@router.delete("/{loss_id}/items/{item_id}", status_code=204)
def delete_item(loss_id: str, item_id: str, db: Session = Depends(get_db)):
    loss = _get_loss(db, loss_id)
    _ensure_open(loss)
    item = db.get(LossItem, item_id)
    if not item or item.loss_id != loss_id:
        raise HTTPException(404, "Item não encontrado.")
    db.delete(item)
    db.flush()
    _recalc(db, loss)
