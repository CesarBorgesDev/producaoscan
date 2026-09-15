from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Product, Production, ProductionItem
from ..schemas import (
    DashboardDay,
    DashboardOut,
    DashboardStatus,
    DashboardTopProduct,
    DashboardTotals,
    ExportResult,
    ProductionIn,
    ProductionItemOut,
    ProductionOut,
    ScanIn,
)
from ..services.pdf import build_production_pdf
from ..services.pg_export import export_production
from ..toledo import parse_toledo_barcode

router = APIRouter(prefix="/api/productions", tags=["productions"])

def _recalc(db: Session, production: Production) -> None:
    items = production.items
    weight = sum(it.weight_kg or 0 for it in items)
    price = sum(it.total_price or 0 for it in items)
    production.item_count = len(items)
    production.total_weight = round(weight, 3)
    production.total_price = round(price, 2)
    db.commit()
    db.refresh(production)


def _get_production(db: Session, production_id: str, with_items: bool = False) -> Production:
    query = db.query(Production)
    if with_items:
        query = query.options(joinedload(Production.items))
    row = query.filter(Production.id == production_id).one_or_none()
    if not row:
        raise HTTPException(404, "Produção não encontrada.")
    return row


def _is_exported(production: Production) -> bool:
    return production.exported_pg_id is not None or production.status == "enviada"


def _ensure_open(production: Production) -> None:
    if _is_exported(production):
        raise HTTPException(409, "Produção enviada ao Uniplus — alteração bloqueada.")
    if production.status == "excluida":
        raise HTTPException(409, "Produção excluída — operação bloqueada.")
    if production.status == "concluida":
        raise HTTPException(409, "Produção concluída — coleta bloqueada.")


def _ensure_not_exported(production: Production) -> None:
    if _is_exported(production):
        raise HTTPException(409, "Produção enviada ao Uniplus — alteração e exclusão bloqueadas.")


def _active(query):
    return query.filter(Production.status != "excluida")


def _totals(db: Session, *filters) -> DashboardTotals:
    row = (
        _active(db.query(
            func.count(Production.id),
            func.coalesce(func.sum(Production.item_count), 0),
            func.coalesce(func.sum(Production.total_weight), 0.0),
            func.coalesce(func.sum(Production.total_price), 0.0),
        ))
        .filter(*filters)
        .one()
    )
    return DashboardTotals(
        productions=int(row[0] or 0),
        items=int(row[1] or 0),
        weight=round(float(row[2] or 0), 3),
        value=round(float(row[3] or 0), 2),
    )


@router.get("", response_model=list[ProductionOut])
def list_productions(
    include_deleted: bool = Query(False),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Production)
    if status:
        query = query.filter(Production.status == status)
    elif not include_deleted:
        query = query.filter(Production.status != "excluida")
    return query.order_by(Production.created_at.desc()).all()


@router.get("/dashboard", response_model=DashboardOut)
def production_dashboard(
    days: int = Query(14, ge=1, le=90),
    as_of: date | None = Query(None),
    db: Session = Depends(get_db),
):
    today = as_of or date.today()
    start = today - timedelta(days=days - 1)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)
    yesterday = today - timedelta(days=1)

    daily_rows = (
        _active(
            db.query(
                Production.production_date,
                func.count(Production.id),
                func.coalesce(func.sum(Production.item_count), 0),
                func.coalesce(func.sum(Production.total_weight), 0.0),
                func.coalesce(func.sum(Production.total_price), 0.0),
            )
        )
        .filter(Production.production_date >= start, Production.production_date <= today)
        .group_by(Production.production_date)
        .all()
    )
    by_date = {row[0]: row for row in daily_rows}
    series: list[DashboardDay] = []
    cursor = start
    while cursor <= today:
        row = by_date.get(cursor)
        series.append(
            DashboardDay(
                date=cursor,
                productions=int(row[1] or 0) if row else 0,
                items=int(row[2] or 0) if row else 0,
                weight=round(float(row[3] or 0), 3) if row else 0,
                value=round(float(row[4] or 0), 2) if row else 0,
            )
        )
        cursor += timedelta(days=1)

    status_rows = (
        _active(
            db.query(
                Production.status,
                func.count(Production.id),
                func.coalesce(func.sum(Production.item_count), 0),
                func.coalesce(func.sum(Production.total_weight), 0.0),
                func.coalesce(func.sum(Production.total_price), 0.0),
            )
        )
        .filter(Production.production_date >= start, Production.production_date <= today)
        .group_by(Production.status)
        .all()
    )
    by_status = [
        DashboardStatus(
            status=row[0],
            count=int(row[1] or 0),
            items=int(row[2] or 0),
            weight=round(float(row[3] or 0), 3),
            value=round(float(row[4] or 0), 2),
        )
        for row in status_rows
    ]

    top_rows = (
        db.query(
            ProductionItem.product_code,
            func.max(ProductionItem.product_name),
            func.count(ProductionItem.id),
            func.coalesce(func.sum(ProductionItem.weight_kg), 0.0),
            func.coalesce(func.sum(ProductionItem.total_price), 0.0),
        )
        .join(Production, ProductionItem.production_id == Production.id)
        .filter(
            Production.status != "excluida",
            Production.production_date >= start,
            Production.production_date <= today,
        )
        .group_by(ProductionItem.product_code)
        .order_by(func.sum(ProductionItem.total_price).desc())
        .limit(8)
        .all()
    )
    top_products = [
        DashboardTopProduct(
            product_code=row[0],
            product_name=row[1] or row[0],
            items=int(row[2] or 0),
            weight=round(float(row[3] or 0), 3),
            value=round(float(row[4] or 0), 2),
        )
        for row in top_rows
    ]

    open_production = (
        db.query(Production)
        .filter(Production.status == "em_andamento")
        .order_by(Production.created_at.desc())
        .first()
    )
    recent = (
        _active(db.query(Production))
        .order_by(Production.created_at.desc())
        .limit(6)
        .all()
    )
    pending_export = (
        db.query(func.count(Production.id))
        .filter(
            Production.status == "concluida",
            Production.exported_pg_id.is_(None),
        )
        .scalar()
        or 0
    )
    deleted_count = (
        db.query(func.count(Production.id)).filter(Production.status == "excluida").scalar() or 0
    )
    catalog_products = db.query(func.count(Product.id)).scalar() or 0

    return DashboardOut(
        days=days,
        from_date=start,
        to_date=today,
        today=_totals(db, Production.production_date == today),
        yesterday=_totals(db, Production.production_date == yesterday),
        period=_totals(
            db,
            Production.production_date >= start,
            Production.production_date <= today,
        ),
        previous_period=_totals(
            db,
            Production.production_date >= prev_start,
            Production.production_date <= prev_end,
        ),
        catalog_products=int(catalog_products),
        pending_export=int(pending_export),
        deleted_count=int(deleted_count),
        open_production=open_production,
        series=series,
        by_status=by_status,
        top_products=top_products,
        recent=recent,
    )


@router.post("", response_model=ProductionOut, status_code=201)
def create_production(payload: ProductionIn, db: Session = Depends(get_db)):
    row = Production(
        label=payload.label.strip(),
        status=payload.status or "em_andamento",
        production_date=payload.production_date or date.today(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{production_id}", response_model=ProductionOut)
def get_production(production_id: str, db: Session = Depends(get_db)):
    return _get_production(db, production_id)


@router.put("/{production_id}", response_model=ProductionOut)
def update_production(production_id: str, payload: ProductionIn, db: Session = Depends(get_db)):
    row = _get_production(db, production_id)
    _ensure_not_exported(row)
    if row.status == "excluida":
        raise HTTPException(409, "Produção excluída — operação bloqueada.")
    row.label = payload.label.strip()
    row.status = payload.status
    if payload.production_date:
        row.production_date = payload.production_date
    if payload.status == "excluida" and row.deleted_at is None:
        row.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


@router.post("/{production_id}/delete", response_model=ProductionOut)
def soft_delete_production(production_id: str, db: Session = Depends(get_db)):
    row = _get_production(db, production_id)
    _ensure_not_exported(row)
    if row.status == "excluida":
        return row
    row.status = "excluida"
    row.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


@router.get("/{production_id}/pdf")
def production_pdf(production_id: str, db: Session = Depends(get_db)):
    row = _get_production(db, production_id)
    items = (
        db.query(ProductionItem)
        .filter(ProductionItem.production_id == production_id)
        .order_by(ProductionItem.created_at.asc())
        .all()
    )
    pdf_bytes = build_production_pdf(row, items)
    safe_label = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in (row.label or "producao"))
    filename = f"producao-{safe_label[:40]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{production_id}/export", response_model=ExportResult)
def export_production_route(production_id: str, db: Session = Depends(get_db)):
    row = _get_production(db, production_id, with_items=True)
    try:
        return export_production(db, row)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"Falha ao enviar para o PostgreSQL: {exc}") from exc


@router.get("/{production_id}/items", response_model=list[ProductionItemOut])
def list_items(production_id: str, db: Session = Depends(get_db)):
    _get_production(db, production_id)
    return (
        db.query(ProductionItem)
        .filter(ProductionItem.production_id == production_id)
        .order_by(ProductionItem.created_at.desc())
        .all()
    )


@router.post("/{production_id}/scan", response_model=ProductionItemOut)
def scan_item(production_id: str, payload: ScanIn, db: Session = Depends(get_db)):
    production = _get_production(db, production_id)
    _ensure_open(production)

    parsed = parse_toledo_barcode(payload.barcode)
    if not parsed:
        raise HTTPException(
            400,
            "Etiqueta inválida. Use o padrão 2CCCC0TTTTTT (C=código, T=quantidade em kg).",
        )

    product = db.query(Product).filter(Product.code == parsed["product_code"]).one_or_none()
    if not product:
        product = (
            db.query(Product)
            .filter(Product.code == parsed["product_code_padded"])
            .one_or_none()
        )
    if not product:
        raise HTTPException(404, f"Produto {parsed['product_code']} não cadastrado.")

    weight_kg = parsed["weight_kg"]
    unit_price = product.unit_price or 0
    total = round(weight_kg * unit_price, 2)
    item = ProductionItem(
        barcode=parsed["raw"],
        product_code=product.code,
        product_name=product.name,
        weight_kg=weight_kg,
        unit_price=unit_price,
        total_price=total,
        production_id=production.id,
    )
    db.add(item)
    db.flush()
    _recalc(db, production)
    db.refresh(item)
    return item


@router.delete("/{production_id}/items/{item_id}", status_code=204)
def delete_item(production_id: str, item_id: str, db: Session = Depends(get_db)):
    production = _get_production(db, production_id)
    _ensure_open(production)
    item = db.get(ProductionItem, item_id)
    if not item or item.production_id != production_id:
        raise HTTPException(404, "Item não encontrado.")
    db.delete(item)
    db.flush()
    _recalc(db, production)
