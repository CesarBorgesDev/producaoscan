from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import Product


def product_code_candidates(code: str) -> list[str]:
    raw = (code or "").strip()
    if not raw:
        return []
    seen: list[str] = []
    for candidate in (raw, raw.lstrip("0") or "0"):
        if candidate not in seen:
            seen.append(candidate)
        if candidate.isdigit():
            for width in (4, 5, 6):
                padded = candidate.zfill(width)
                if padded not in seen:
                    seen.append(padded)
    return seen


def find_product_by_code(db: Session, code: str) -> Product:
    raw = (code or "").strip()
    if not raw:
        raise HTTPException(400, "Informe o código do produto.")
    for candidate in product_code_candidates(raw):
        product = db.query(Product).filter(Product.code == candidate).one_or_none()
        if product:
            return product
    raise HTTPException(404, f"Produto {raw} não cadastrado.")


def normalize_weight_kg(value: float) -> float:
    weight = round(float(value), 3)
    if weight <= 0:
        raise HTTPException(400, "Informe o peso em kg maior que zero.")
    if weight > 9999:
        raise HTTPException(400, "Peso acima do limite permitido (9.999 kg).")
    return weight


def manual_barcode(product_code: str, weight_kg: float) -> str:
    return f"M:{product_code}:{weight_kg:.3f}"[:32]
