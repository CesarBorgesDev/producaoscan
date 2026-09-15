from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Product
from ..schemas import ProductIn, ProductOut

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(q: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Product).order_by(Product.name.asc())
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            Product.name.ilike(like) | Product.code.ilike(like) | Product.category.ilike(like)
        )
    return query.all()


@router.delete("", status_code=200)
def delete_all_products(db: Session = Depends(get_db)):
    deleted = db.query(Product).delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "deleted": deleted}


@router.post("", response_model=ProductOut, status_code=201)
def create_product(payload: ProductIn, db: Session = Depends(get_db)):
    code = payload.code.strip()
    if db.query(Product).filter(Product.code == code).one_or_none():
        raise HTTPException(409, "Já existe um produto com este código.")
    row = Product(
        code=code,
        name=payload.name.strip(),
        category=payload.category.strip() if payload.category else None,
        unit_price=payload.unit_price,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: str, payload: ProductIn, db: Session = Depends(get_db)):
    row = db.get(Product, product_id)
    if not row:
        raise HTTPException(404, "Produto não encontrado.")
    other = db.query(Product).filter(Product.code == payload.code.strip(), Product.id != product_id).one_or_none()
    if other:
        raise HTTPException(409, "Já existe um produto com este código.")
    row.code = payload.code.strip()
    row.name = payload.name.strip()
    row.category = payload.category.strip() if payload.category else None
    row.unit_price = payload.unit_price
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: str, db: Session = Depends(get_db)):
    row = db.get(Product, product_id)
    if not row:
        raise HTTPException(404, "Produto não encontrado.")
    db.delete(row)
    db.commit()
