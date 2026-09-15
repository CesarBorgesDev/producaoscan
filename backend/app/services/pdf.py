from __future__ import annotations

from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ..models import Production, ProductionItem

BLUE = colors.HexColor("#1565C0")
HEADER_TEXT = colors.white
ZEBRA = colors.HexColor("#F5F8FC")


def _brl(value: float) -> str:
    formatted = f"{value:,.2f}"
    return "R$ " + formatted.replace(",", "X").replace(".", ",").replace("X", ".")


def _kg(value: float) -> str:
    formatted = f"{value:,.3f}"
    return formatted.replace(",", "X").replace(".", ",").replace("X", ".") + " kg"


def _status_label(status: str) -> str:
    return {
        "em_andamento": "Em andamento",
        "concluida": "Concluída",
        "enviada": "Enviada ao Uniplus",
        "excluida": "Excluída",
    }.get(status or "", status or "")


def build_production_pdf(production: Production, items: list[ProductionItem]) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Produção {production.label}",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitlePt",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=BLUE,
        spaceAfter=4,
    )
    meta_style = ParagraphStyle("MetaPt", parent=styles["Normal"], fontSize=9, leading=13)
    cell_style = ParagraphStyle("CellPt", parent=styles["Normal"], fontSize=8, leading=11)
    right_style = ParagraphStyle(
        "RightPt",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        alignment=2,
    )

    story = [
        Paragraph("Controle de Produção — DAMA Carnes Nobres", title_style),
        Paragraph(
            f"<b>Lote:</b> {production.label}<br/>"
            f"<b>Data da produção:</b> {production.production_date.strftime('%d/%m/%Y')}<br/>"
            f"<b>Status:</b> {_status_label(production.status)}<br/>"
            f"<b>Emitido em:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}<br/>"
            f"<b>Itens:</b> {len(items)}",
            meta_style,
        ),
        Spacer(1, 8 * mm),
    ]

    header = ["Produto", "Código", "Peso", "Preço/kg", "Total"]
    data = [header]
    for item in items:
        data.append(
            [
                Paragraph((item.product_name or "")[:80], cell_style),
                Paragraph(item.product_code or "", cell_style),
                Paragraph(_kg(item.weight_kg or 0), right_style),
                Paragraph(_brl(item.unit_price or 0), right_style),
                Paragraph(_brl(item.total_price or 0), right_style),
            ]
        )

    table = Table(data, colWidths=[75 * mm, 25 * mm, 28 * mm, 28 * mm, 28 * mm], repeatRows=1)
    style_commands = [
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), HEADER_TEXT),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D0D7E2")),
    ]
    for index in range(1, len(data)):
        if index % 2 == 0:
            style_commands.append(("BACKGROUND", (0, index), (-1, index), ZEBRA))
    table.setStyle(TableStyle(style_commands))
    story.append(table)
    story.append(Spacer(1, 8 * mm))

    totals = Table(
        [
            ["Peso total", _kg(production.total_weight or 0)],
            ["Valor total", _brl(production.total_price or 0)],
        ],
        colWidths=[130 * mm, 54 * mm],
    )
    totals.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("TEXTCOLOR", (0, 1), (-1, 1), BLUE),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(totals)
    doc.build(story)
    return buffer.getvalue()
