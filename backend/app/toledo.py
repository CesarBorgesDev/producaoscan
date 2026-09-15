import re

# Padrão da etiqueta: 2CCCC0TTTTTT
#   2        prefixo
#   CCCC     código do produto (4 dígitos)
#   0        separador fixo
#   TTTTTT   quantidade total em kg, 3 casas decimais (001250 = 1,250 kg)
# Aceita também o 13º dígito verificador (EAN-13).

_PATTERN = re.compile(r"^2(\d{4})0(\d{6})\d?$")


def parse_toledo_barcode(raw: str | None) -> dict | None:
    if raw is None:
        return None
    code = re.sub(r"\s+", "", str(raw).strip())
    if not code.isdigit():
        return None
    match = _PATTERN.fullmatch(code)
    if not match:
        return None

    product_code = match.group(1)
    qty_field = int(match.group(2))
    weight_kg = round(qty_field / 1000, 3)
    return {
        "raw": code,
        "prefix": "2",
        "product_code": product_code,
        "product_code_padded": product_code.zfill(5),
        "weight_kg": weight_kg,
        "check": code[12] if len(code) == 13 else None,
    }
