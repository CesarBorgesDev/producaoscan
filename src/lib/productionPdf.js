import { jsPDF } from "jspdf";
import { formatBRL, formatWeight } from "@/lib/toledo";

// Gera um PDF da produção do lote atual.
export function generateProductionPdf({ items, totals, production }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Controle de Produção", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const now = new Date();
  const dateStr = now.toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
  doc.text(`Data: ${dateStr}`, margin, y);
  y += 14;
  doc.text(`Lote: ${production?.label || ""}`, margin, y);
  y += 14;
  doc.text(`Total de itens: ${items.length}`, margin, y);
  y += 24;

  // Tabela
  const cols = [
    { label: "Produto", x: margin, w: 200 },
    { label: "Código", x: margin + 200, w: 60 },
    { label: "Peso", x: margin + 260, w: 80, align: "right" },
    { label: "Preço/kg", x: margin + 340, w: 80, align: "right" },
    { label: "Total", x: margin + 420, w: 90, align: "right" },
  ];

  doc.setFillColor(15, 15, 15);
  doc.rect(margin, y - 14, pageW - margin * 2, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  cols.forEach((c) => {
    doc.text(c.label, c.x + (c.align === "right" ? c.w - 6 : 4), y);
  });
  y += 18;

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const lineH = 18;
  items.forEach((it, i) => {
    if (y > doc.internal.pageSize.getHeight() - margin - 60) {
      doc.addPage();
      y = margin;
    }
    if (i % 2 === 1) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 13, pageW - margin * 2, lineH, "F");
    }
    doc.text(String(it.product_name || "").slice(0, 38), cols[0].x + 4, y);
    doc.text(String(it.product_code || ""), cols[1].x + 4, y);
    doc.text(formatWeight(it.weight_kg), cols[2].x + cols[2].w - 6, y, { align: "right" });
    doc.text(formatBRL(it.unit_price), cols[3].x + cols[3].w - 6, y, { align: "right" });
    doc.text(formatBRL(it.total_price), cols[4].x + cols[4].w - 6, y, { align: "right" });
    y += lineH;
  });

  // Totais
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Peso total:", margin, y);
  doc.text(formatWeight(totals.weight), pageW - margin, y, { align: "right" });
  y += 18;
  doc.text("Valor total:", margin, y);
  doc.text(formatBRL(totals.price), pageW - margin, y, { align: "right" });

  doc.save(`producao-${now.toISOString().slice(0, 10)}.pdf`);
}