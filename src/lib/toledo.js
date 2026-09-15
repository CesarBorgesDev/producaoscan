// Padrão da etiqueta: 2CCCC0TTTTTT
//   2        prefixo
//   CCCC     código do produto (4 dígitos)
//   0        separador fixo
//   TTTTTT   quantidade total em kg, 3 casas decimais (001250 = 1,250 kg)
// Aceita também o 13º dígito verificador (EAN-13).

export function parseToledoBarcode(raw) {
  if (raw == null) return null;
  const code = String(raw).trim().replace(/\s+/g, "");
  const match = /^2(\d{4})0(\d{6})\d?$/.exec(code);
  if (!match) return null;

  const productCode = match[1];
  const qtyField = parseInt(match[2], 10);
  const weightKg = qtyField / 1000;

  return {
    raw: code,
    prefix: "2",
    productCode,
    productCodePadded: productCode.padStart(5, "0"),
    weightKg,
    check: code.length === 13 ? code.slice(12, 13) : null,
  };
}

export function formatBRL(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatWeight(kg) {
  const n = Number(kg || 0);
  return `${n.toFixed(3).replace(".", ",")} kg`;
}
