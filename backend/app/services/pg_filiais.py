from __future__ import annotations

from fastapi import HTTPException

from ..models import AppSettings
from .pg_import import _connect

NAME_KEYS = ("nome", "nomefantasia", "fantasia", "descricao", "razaosocial", "nomeempresarial")
CODE_KEYS = ("codigo", "cod", "sigla")


def _first_text(data: dict, keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = data.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def list_filiais(cfg: AppSettings) -> list[dict]:
    try:
        with _connect(cfg) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'filial'
                    """
                )
                if not cur.fetchone():
                    raise HTTPException(400, "Tabela filial não encontrada no Uniplus.")
                cur.execute("SELECT * FROM filial ORDER BY id")
                columns = [col[0] for col in cur.description]
                rows = cur.fetchall()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Falha ao listar filiais no Uniplus: {exc}") from exc

    filiais: list[dict] = []
    for row in rows:
        data = {str(col).lower(): value for col, value in zip(columns, row)}
        filial_id = data.get("id")
        if filial_id is None:
            continue
        name = _first_text(data, NAME_KEYS) or f"Filial {filial_id}"
        code = _first_text(data, CODE_KEYS)
        filiais.append({"id": int(filial_id), "code": code, "name": name})

    filiais.sort(key=lambda item: ((item["name"] or "").lower(), item["id"]))
    return filiais


def get_filial(cfg: AppSettings, filial_id: int) -> dict:
    for filial in list_filiais(cfg):
        if filial["id"] == int(filial_id):
            return filial
    raise HTTPException(400, "Filial não encontrada no Uniplus.")
