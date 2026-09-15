from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from ..models import Production, ProductionItem
from .pg_import import _connect, get_or_create_settings

EXPORT_MARKER = "producaoscan:"
DEFAULT_FILIAL_ID = 1


def _product_code_candidates(code: str) -> list[str]:
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


def _find_produto_id(cur, product_code: str) -> int | None:
    for code in _product_code_candidates(product_code):
        cur.execute("SELECT id FROM produto WHERE codigo = %s ORDER BY id LIMIT 1", (code,))
        row = cur.fetchone()
        if row:
            return int(row[0])
    return None


def _next_codigo(cur) -> str:
    cur.execute(
        "SELECT COALESCE(MAX(CAST(codigo AS BIGINT)), 0) + 1 "
        "FROM registroproducao WHERE codigo ~ '^[0-9]+$'"
    )
    value = cur.fetchone()[0] or 1
    return str(int(value))


def _pick_filial_id(cur) -> int | None:
    cur.execute("SELECT id FROM filial ORDER BY id LIMIT 1")
    row = cur.fetchone()
    return int(row[0]) if row else DEFAULT_FILIAL_ID


def export_production(db: Session, production: Production) -> dict:
    if production.status == "excluida":
        raise ValueError("Produção excluída não pode ser enviada ao Uniplus.")
    if production.exported_pg_id is not None or production.status == "enviada":
        raise ValueError("Produção já enviada ao Uniplus — alteração bloqueada.")
    items: list[ProductionItem] = list(production.items)
    if not items:
        raise ValueError("Produção sem itens para enviar.")

    cfg = get_or_create_settings(db)
    now = datetime.now()
    millis = int(now.timestamp() * 1000)
    marker = f"{EXPORT_MARKER}{production.id}"
    produced_at = datetime.combine(production.production_date, datetime.min.time()).replace(
        hour=now.hour, minute=now.minute, second=now.second, microsecond=now.microsecond
    )

    with _connect(cfg) as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            unmatched: list[str] = []
            mapped: list[tuple[ProductionItem, int]] = []
            for item in items:
                produto_id = _find_produto_id(cur, item.product_code)
                if produto_id is None:
                    unmatched.append(f"{item.product_code} ({item.product_name})")
                else:
                    mapped.append((item, produto_id))
            if unmatched:
                conn.rollback()
                raise ValueError(
                    "Produto(s) sem correspondência em produto.codigo: " + ", ".join(unmatched)
                )

            cur.execute(
                "SELECT id, codigo FROM registroproducao WHERE extra1 = %s LIMIT 1",
                (marker,),
            )
            existing = cur.fetchone()
            if existing:
                registro_id, codigo = int(existing[0]), existing[1]
                cur.execute(
                    """
                    UPDATE registroproducao
                    SET descricao = %s,
                        datahora = %s,
                        datahoraproducao = %s,
                        currenttimemillis = %s,
                        status = 0,
                        extra2 = %s
                    WHERE id = %s
                    """,
                    (
                        (production.label or "")[:255],
                        now,
                        produced_at,
                        millis,
                        f"{production.item_count} itens; {production.total_weight} kg; {production.total_price}",
                        registro_id,
                    ),
                )
                cur.execute(
                    "DELETE FROM registroproducaoitem WHERE idregistroproducao = %s",
                    (registro_id,),
                )
            else:
                codigo = _next_codigo(cur)
                filial_id = _pick_filial_id(cur)
                cur.execute(
                    """
                    INSERT INTO registroproducao (
                        codigo, descricao, datahora, idfilial, currenttimemillis,
                        datahoraproducao, status, extra1, extra2
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, 0, %s, %s)
                    RETURNING id
                    """,
                    (
                        codigo[:20],
                        (production.label or "")[:255],
                        now,
                        filial_id,
                        millis,
                        produced_at,
                        marker,
                        f"{production.item_count} itens; {production.total_weight} kg; {production.total_price}",
                    ),
                )
                registro_id = int(cur.fetchone()[0])

            for item, produto_id in mapped:
                cur.execute(
                    """
                    INSERT INTO registroproducaoitem (
                        idregistroproducao, idproduto, quantidade, ordemvariacao,
                        currenttimemillis, lote, datalote, quantidadesolicitada,
                        quantidadepadrao, tipoquantidade
                    )
                    VALUES (%s, %s, %s, 0, %s, %s, %s, %s, 1, 0)
                    """,
                    (
                        registro_id,
                        produto_id,
                        item.weight_kg or 0,
                        millis,
                        (item.barcode or "")[:30],
                        production.production_date,
                        item.weight_kg or 0,
                    ),
                )
        conn.commit()

    production.status = "enviada"
    production.exported_at = datetime.utcnow()
    production.exported_pg_id = registro_id
    db.commit()
    db.refresh(production)

    return {
        "ok": True,
        "registroproducao_id": registro_id,
        "codigo": codigo,
        "items": len(mapped),
        "message": (
            f"Produção enviada para registroproducao id={registro_id} "
            f"(código {codigo}) com {len(mapped)} item(ns)."
        ),
        "unmatched": [],
    }
