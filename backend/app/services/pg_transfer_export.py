from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from ..models import TransferItem, TransferRequest
from .pg_export import DEFAULT_FILIAL_ID, _find_produto_id
from .pg_import import _connect, get_or_create_settings

EXPORT_MARKER = "producaoscan:"
KG_UNIT_CODE = "KG"


def _next_codigo(cur) -> int:
    cur.execute("SELECT COALESCE(MAX(codigo), 0) + 1 FROM requisicaotransferencia")
    value = cur.fetchone()[0] or 1
    return int(value)


def _origin_filial_id(cur, destination_id: int) -> int:
    cur.execute("SELECT id FROM filial ORDER BY id LIMIT 1")
    row = cur.fetchone()
    origin = int(row[0]) if row else DEFAULT_FILIAL_ID
    if origin == int(destination_id):
        cur.execute(
            "SELECT id FROM filial WHERE id <> %s ORDER BY id LIMIT 1",
            (destination_id,),
        )
        other = cur.fetchone()
        if other:
            return int(other[0])
    return origin


def _kg_unidade_id(cur) -> int | None:
    cur.execute(
        "SELECT id FROM unidademedida WHERE UPPER(BTRIM(codigo)) = %s ORDER BY id LIMIT 1",
        (KG_UNIT_CODE,),
    )
    row = cur.fetchone()
    if row:
        return int(row[0])
    cur.execute("SELECT id FROM unidademedida ORDER BY id LIMIT 1")
    row = cur.fetchone()
    return int(row[0]) if row else None


def _produto_unidade_id(cur, produto_id: int, fallback: int | None) -> int | None:
    cur.execute("SELECT idunidademedida FROM produto WHERE id = %s", (produto_id,))
    row = cur.fetchone()
    if row and row[0] is not None:
        return int(row[0])
    return fallback


def export_transfer(db: Session, transfer: TransferRequest) -> dict:
    if transfer.status == "excluida":
        raise ValueError("Requisição excluída não pode ser enviada ao Uniplus.")
    if transfer.exported_pg_id is not None or transfer.status == "enviada":
        raise ValueError("Requisição já enviada ao Uniplus — alteração bloqueada.")
    items: list[TransferItem] = list(transfer.items)
    if not items:
        raise ValueError("Requisição sem itens para enviar.")

    cfg = get_or_create_settings(db)
    now = datetime.now()
    millis = int(now.timestamp() * 1000)
    marker = f"{EXPORT_MARKER}{transfer.id}"
    summary = (
        f"{transfer.item_count} itens; {transfer.total_weight} kg; {transfer.total_price}"
    )
    observacao = f"{marker}\n{transfer.label or ''}\n{summary}"[:4000]
    destination_id = int(transfer.filial_id)

    with _connect(cfg) as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            unmatched: list[str] = []
            mapped: list[tuple[TransferItem, int]] = []
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

            kg_unidade = _kg_unidade_id(cur)
            origin_id = _origin_filial_id(cur, destination_id)

            cur.execute(
                "SELECT id, codigo FROM requisicaotransferencia WHERE observacao LIKE %s LIMIT 1",
                (f"{marker}%",),
            )
            existing = cur.fetchone()
            if existing:
                requisicao_id, codigo = int(existing[0]), existing[1]
                cur.execute(
                    """
                    UPDATE requisicaotransferencia
                    SET idfilial = %s,
                        idfilialrequisitada = %s,
                        status = 0,
                        dataemissao = %s,
                        observacao = %s,
                        currenttimemillis = %s
                    WHERE id = %s
                    """,
                    (
                        origin_id,
                        destination_id,
                        transfer.request_date,
                        observacao,
                        millis,
                        requisicao_id,
                    ),
                )
                cur.execute(
                    "DELETE FROM requisicaotransferenciaitem WHERE idrequisicaotransferencia = %s",
                    (requisicao_id,),
                )
            else:
                codigo = _next_codigo(cur)
                cur.execute(
                    """
                    INSERT INTO requisicaotransferencia (
                        codigo, idfilial, idfilialrequisitada, status,
                        dataemissao, observacao, currenttimemillis
                    )
                    VALUES (%s, %s, %s, 0, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        codigo,
                        origin_id,
                        destination_id,
                        transfer.request_date,
                        observacao,
                        millis,
                    ),
                )
                requisicao_id = int(cur.fetchone()[0])

            for index, (item, produto_id) in enumerate(mapped, start=1):
                unidade_id = _produto_unidade_id(cur, produto_id, kg_unidade)
                extra = f"{item.product_name} · {item.weight_kg} kg"[:500]
                cur.execute(
                    """
                    INSERT INTO requisicaotransferenciaitem (
                        idrequisicaotransferencia, nritem, quantidade,
                        idunidademedida, idproduto, observacao,
                        informacaoadicional, currenttimemillis
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        requisicao_id,
                        index,
                        item.weight_kg or 0,
                        unidade_id,
                        produto_id,
                        (item.barcode or "")[:20],
                        extra,
                        millis,
                    ),
                )
        conn.commit()

    transfer.status = "enviada"
    transfer.exported_at = datetime.utcnow()
    transfer.exported_pg_id = requisicao_id
    db.commit()
    db.refresh(transfer)

    return {
        "ok": True,
        "requisicaotransferencia_id": requisicao_id,
        "codigo": str(codigo),
        "items": len(mapped),
        "message": (
            f"Requisição enviada para requisicaotransferencia id={requisicao_id} "
            f"(código {codigo}) com {len(mapped)} item(ns)."
        ),
        "unmatched": [],
    }
