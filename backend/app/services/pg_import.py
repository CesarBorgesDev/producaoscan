from __future__ import annotations

import csv
import io
import json
from typing import Any

import psycopg2
from psycopg2 import sql
from sqlalchemy.orm import Session

from ..models import AppSettings, ImportedFile, Product

CODE_KEYS = ("codigo", "code", "cod", "produto_codigo")
NAME_KEYS = ("nome", "name", "descricao", "description", "produto")
CATEGORY_KEYS = ("categoria", "category", "grupo")
PRICE_KEYS = ("preco_kg", "unit_price", "preco", "price", "valor")
IPPT_KEYS = ("ippt",)


def get_or_create_settings(db: Session) -> AppSettings:
    row = db.get(AppSettings, 1)
    if row is None:
        row = AppSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _connect(cfg: AppSettings):
    return psycopg2.connect(
        host=cfg.pg_host,
        port=cfg.pg_port,
        dbname=cfg.pg_database,
        user=cfg.pg_username,
        password=cfg.pg_password,
        connect_timeout=8,
    )


def test_connection(cfg: AppSettings) -> dict:
    try:
        with _connect(cfg) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                    """
                )
                tables = [r[0] for r in cur.fetchall()]
        return {
            "ok": True,
            "message": f"Conectado a {cfg.pg_database} em {cfg.pg_host}:{cfg.pg_port}",
            "tables": tables,
        }
    except Exception as exc:
        return {"ok": False, "message": str(exc), "tables": []}


def _pick(row: dict[str, Any], keys: tuple[str, ...]) -> Any:
    lowered = {str(k).lower(): v for k, v in row.items()}
    for key in keys:
        if key in lowered and lowered[key] not in (None, ""):
            return lowered[key]
    return None


def _row_has_ippt(row: dict[str, Any]) -> bool:
    return any(str(key).lower() == "ippt" for key in row)


def _ippt_allows_import(row: dict[str, Any]) -> bool:
    # CSV/JSON sem a coluna ippt devem ser importados.
    # Quando o campo existe (PostgreSQL ou arquivo), só entra ippt = P.
    if not _row_has_ippt(row):
        return True
    value = _pick(row, IPPT_KEYS)
    if value is None:
        return False
    return str(value).strip().upper() == "P"


def _normalize_row(row: dict[str, Any]) -> dict | None:
    code = _pick(row, CODE_KEYS)
    name = _pick(row, NAME_KEYS)
    price = _pick(row, PRICE_KEYS)
    if code is None or name is None or price is None:
        return None
    try:
        unit_price = float(str(price).replace(",", "."))
    except (TypeError, ValueError):
        return None
    category = _pick(row, CATEGORY_KEYS)
    return {
        "code": str(code).strip().zfill(5) if str(code).strip().isdigit() else str(code).strip(),
        "name": str(name).strip(),
        "category": str(category).strip() if category else None,
        "unit_price": unit_price,
    }


def upsert_products(db: Session, rows: list[dict], source: str, filename: str) -> dict:
    imported = updated = skipped = 0
    for raw in rows:
        if not _ippt_allows_import(raw):
            skipped += 1
            continue
        data = _normalize_row(raw)
        if not data:
            skipped += 1
            continue
        existing = db.query(Product).filter(Product.code == data["code"]).one_or_none()
        if existing:
            existing.name = data["name"]
            existing.category = data["category"]
            existing.unit_price = data["unit_price"]
            updated += 1
        else:
            db.add(Product(**data))
            imported += 1

    log = ImportedFile(
        filename=filename,
        source=source,
        records=imported + updated,
        detail=f"novos={imported}; atualizados={updated}; ignorados={skipped}",
    )
    db.add(log)
    db.commit()
    return {
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "source": source,
        "detail": log.detail or "",
    }


def import_from_postgresql(db: Session, table_name: str | None = None) -> dict:
    cfg = get_or_create_settings(db)
    table = (table_name or cfg.source_table or "catalogo_origem").strip()
    if not table.replace("_", "").isalnum():
        raise ValueError("Nome de tabela inválido.")

    with _connect(cfg) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND lower(table_name) = lower(%s)
                """,
                (table,),
            )
            columns = [row[0] for row in cur.fetchall()]
            if not columns:
                raise ValueError(f"Tabela '{table}' não encontrada.")
            ippt_col = next((col for col in columns if col.lower() == "ippt"), None)
            if not ippt_col:
                raise ValueError(
                    f"A tabela '{table}' não possui o campo ippt. "
                    "A importação inclui somente produtos com ippt = P."
                )
            cur.execute(
                sql.SQL("SELECT * FROM {} WHERE UPPER(BTRIM({}::text)) = 'P'").format(
                    sql.Identifier(table),
                    sql.Identifier(ippt_col),
                )
            )
            fetched_cols = [desc[0] for desc in cur.description]
            fetched = [dict(zip(fetched_cols, row)) for row in cur.fetchall()]

    return upsert_products(db, fetched, "postgresql", table)


def parse_file_bytes(filename: str, content: bytes) -> list[dict]:
    name = filename.lower()
    text = content.decode("utf-8-sig")
    if name.endswith(".json"):
        payload = json.loads(text)
        if isinstance(payload, dict):
            for key in ("products", "produtos", "items", "data"):
                if isinstance(payload.get(key), list):
                    payload = payload[key]
                    break
            else:
                payload = [payload]
        if not isinstance(payload, list):
            raise ValueError("JSON precisa ser uma lista de produtos.")
        return [row for row in payload if isinstance(row, dict)]

    if name.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(text))
        return [dict(row) for row in reader]

    raise ValueError("Use um arquivo .csv ou .json.")
