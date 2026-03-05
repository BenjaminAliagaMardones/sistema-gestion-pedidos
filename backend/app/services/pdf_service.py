import os
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# ─── KEBEXPO BRAND COLORS ───────────────────────────────
PURPLE_DARK = colors.HexColor("#2D1B5E")      # Primary dark purple
PURPLE_MID = colors.HexColor("#3D2B6E")        # Slightly lighter purple
CORAL = colors.HexColor("#E8637A")              # Coral/pink accent
CORAL_LIGHT = colors.HexColor("#F8A4B0")        # Light coral
CREAM = colors.HexColor("#FFF8F0")              # Cream background
CREAM_DARK = colors.HexColor("#FDEBD0")         # Slightly darker cream
WHITE = colors.white
GRAY_TEXT = colors.HexColor("#5D5D7A")          # Muted text
GRAY_LINE = colors.HexColor("#E0D6CC")          # Subtle borders
DARK_TEXT = colors.HexColor("#1A1A2E")          # Body text


def format_usd(value: float) -> str:
    return f"USD {value:.2f}"


def generate_invoice_pdf(order, client, items, business_config) -> bytes:
    """Genera el PDF de la boleta con estilo Kebexpo (solo USD)."""
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    elements = []

    # ─── STYLES ──────────────────────────────────────────
    title_style = ParagraphStyle(
        "KebTitle",
        fontName="Helvetica-Bold",
        fontSize=24,
        textColor=PURPLE_DARK,
        alignment=TA_LEFT,
        leading=28,
    )
    subtitle_style = ParagraphStyle(
        "KebSubtitle",
        fontName="Helvetica",
        fontSize=10,
        textColor=CORAL,
        alignment=TA_LEFT,
        leading=14,
    )
    section_style = ParagraphStyle(
        "KebSection",
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=WHITE,
        spaceBefore=0.4 * cm,
        spaceAfter=0.3 * cm,
    )
    info_style = ParagraphStyle(
        "KebInfo",
        fontName="Helvetica",
        fontSize=9,
        textColor=DARK_TEXT,
        leading=14,
    )
    bold_style = ParagraphStyle(
        "KebBold",
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=PURPLE_DARK,
    )
    header_right_style = ParagraphStyle(
        "KebHeaderRight",
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=CORAL,
        alignment=TA_RIGHT,
    )
    header_right_sub = ParagraphStyle(
        "KebHeaderRightSub",
        fontName="Helvetica",
        fontSize=9,
        textColor=GRAY_TEXT,
        alignment=TA_RIGHT,
        leading=14,
    )

    # ─── HEADER ──────────────────────────────────────────
    # Top accent bar (simulated with a colored table row)
    accent_bar = Table(
        [[""]], colWidths=[18 * cm], rowHeights=[0.3 * cm]
    )
    accent_bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PURPLE_DARK),
        ("LINEBELOW", (0, 0), (-1, -1), 3, CORAL),
    ]))
    elements.append(accent_bar)
    elements.append(Spacer(1, 0.5 * cm))

    # Logo + Business Name
    logo_cell = ""
    if business_config and business_config.logo_path and os.path.exists(business_config.logo_path):
        try:
            img = Image(business_config.logo_path, width=3.2 * cm, height=3.2 * cm, kind='proportional')
            logo_cell = img
        except Exception:
            logo_cell = ""

    business_name = business_config.business_name if business_config else "Kebexpo"

    left_content = [
        [logo_cell if logo_cell else Spacer(1, 0.1 * cm)],
        [Paragraph(business_name, title_style)],
        [Paragraph("Importaciones &amp; Envíos USA → Chile", subtitle_style)],
    ]

    right_content = [
        [Paragraph("BOLETA DE PEDIDO", header_right_style)],
        [Spacer(1, 0.2 * cm)],
        [Paragraph(f"Fecha: {order.order_date.strftime('%d/%m/%Y') if order.order_date else datetime.now().strftime('%d/%m/%Y')}", header_right_sub)],
        [Paragraph(f"N° Pedido: {str(order.id)[:8].upper()}", header_right_sub)],
        [Paragraph(f"Pago: {order.payment_status.value}", header_right_sub)],
        [Paragraph(f"Estado: {order.order_status.value}", header_right_sub)],
    ]
    if order.tracking_number:
        right_content.append([Paragraph(f"Tracking: {order.tracking_number}", header_right_sub)])
    if order.shipping_cost_usd and order.shipping_cost_usd > 0:
        right_content.append([Paragraph(f"Envío: ${order.shipping_cost_usd:.2f} USD", header_right_sub)])

    header_table = Table(
        [[
            Table(left_content, colWidths=[10 * cm]),
            Table(right_content, colWidths=[8 * cm])
        ]],
        colWidths=[10 * cm, 8 * cm]
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.3 * cm))

    # Divider line (coral gradient effect)
    elements.append(HRFlowable(
        width="100%", thickness=2, color=CORAL,
        spaceAfter=0.5 * cm, spaceBefore=0.2 * cm
    ))

    # ─── CLIENT INFO ─────────────────────────────────────
    # Section header with purple background
    section_header = Table(
        [[Paragraph("  INFORMACIÓN DEL CLIENTE", section_style)]],
        colWidths=[18 * cm], rowHeights=[0.7 * cm]
    )
    section_header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PURPLE_DARK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(section_header)

    client_data = [
        [Paragraph("Nombre:", bold_style), Paragraph(client.name, info_style),
         Paragraph("Banco:", bold_style), Paragraph(order.payment_bank or "—", info_style)],
        [Paragraph("Teléfono:", bold_style), Paragraph(client.phone, info_style),
         Paragraph("Método de Pago:", bold_style), Paragraph(order.payment_method or "—", info_style)],
        [Paragraph("Email:", bold_style), Paragraph(client.email or "—", info_style),
         Paragraph("Moneda:", bold_style), Paragraph("USD (Dólar)", info_style)],
        [Paragraph("Dirección:", bold_style), Paragraph(client.address or "—", info_style),
         Paragraph("", info_style), Paragraph("", info_style)],
    ]

    client_table = Table(client_data, colWidths=[3 * cm, 6 * cm, 4 * cm, 5 * cm])
    client_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CREAM),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [CREAM, WHITE]),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEABOVE", (0, 0), (-1, 0), 0, WHITE),  # hide top border (section header covers it)
    ]))
    elements.append(client_table)
    elements.append(Spacer(1, 0.6 * cm))

    # ─── PRODUCTS TABLE ──────────────────────────────────
    product_header = Table(
        [[Paragraph("  DETALLE DE PRODUCTOS", section_style)]],
        colWidths=[18 * cm], rowHeights=[0.7 * cm]
    )
    product_header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PURPLE_DARK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(product_header)

    col_header_style = ParagraphStyle(
        "ColHeader", fontName="Helvetica-Bold", fontSize=7, textColor=PURPLE_DARK, alignment=TA_CENTER
    )
    cell_right = ParagraphStyle(
        "CellRight", fontName="Helvetica", fontSize=7.5, textColor=DARK_TEXT, alignment=TA_RIGHT
    )
    cell_center = ParagraphStyle(
        "CellCenter", fontName="Helvetica", fontSize=7.5, textColor=DARK_TEXT, alignment=TA_CENTER
    )
    cell_left = ParagraphStyle(
        "CellLeft", fontName="Helvetica", fontSize=7.5, textColor=DARK_TEXT, alignment=TA_LEFT
    )

    prod_headers = [
        Paragraph("PRODUCTO", col_header_style),
        Paragraph("PRECIO BASE", col_header_style),
        Paragraph("TAX %", col_header_style),
        Paragraph("TAX USD", col_header_style),
        Paragraph("COM. %", col_header_style),
        Paragraph("COM. USD", col_header_style),
        Paragraph("CANT.", col_header_style),
        Paragraph("TOTAL USD", col_header_style),
    ]

    prod_data = [prod_headers]
    for item in items:
        prod_data.append([
            Paragraph(item.name, cell_left),
            Paragraph(format_usd(item.base_price_usd), cell_right),
            Paragraph(f"{item.tax_percent:.1f}%", cell_center),
            Paragraph(format_usd(item.tax_amount_usd), cell_right),
            Paragraph(f"{item.commission_percent:.1f}%", cell_center),
            Paragraph(format_usd(item.commission_amount_usd), cell_right),
            Paragraph(str(item.quantity), cell_center),
            Paragraph(format_usd(item.final_price_usd), cell_right),
        ])

    # Column widths must sum to 18cm (A4 width minus margins)
    # 3.8 + 2.2 + 1.3 + 2.0 + 1.3 + 2.0 + 1.2 + 4.2 = 18.0cm
    prod_table = Table(
        prod_data,
        colWidths=[3.8 * cm, 2.2 * cm, 1.3 * cm, 2.0 * cm, 1.3 * cm, 2.0 * cm, 1.2 * cm, 4.2 * cm],
        repeatRows=1
    )
    prod_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), CREAM_DARK),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, CREAM]),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_LINE),
        ("PADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, 0), 1, CORAL),
    ]))
    elements.append(prod_table)
    elements.append(Spacer(1, 0.6 * cm))

    # ─── TOTALS ──────────────────────────────────────────
    total_label_style = ParagraphStyle(
        "TotalLabel", fontName="Helvetica", fontSize=10, textColor=GRAY_TEXT, alignment=TA_RIGHT
    )
    total_value_style = ParagraphStyle(
        "TotalValue", fontName="Helvetica-Bold", fontSize=10, textColor=DARK_TEXT, alignment=TA_RIGHT
    )
    final_label_style = ParagraphStyle(
        "FinalLabel", fontName="Helvetica-Bold", fontSize=14, textColor=WHITE, alignment=TA_RIGHT
    )
    final_value_style = ParagraphStyle(
        "FinalValue", fontName="Helvetica-Bold", fontSize=14, textColor=WHITE, alignment=TA_RIGHT
    )

    totals_data = [
        [Paragraph("Total Tax USD:", total_label_style),
         Paragraph(format_usd(order.total_tax_usd), total_value_style)],
        [Paragraph("Total Comisión USD:", total_label_style),
         Paragraph(format_usd(order.total_commission_usd), total_value_style)],
        [Paragraph("TOTAL USD:", final_label_style),
         Paragraph(format_usd(order.total_usd), final_value_style)],
    ]

    totals_table = Table(totals_data, colWidths=[12 * cm, 6 * cm])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("PADDING", (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 0), (-1, 1), [CREAM, WHITE]),
        ("BACKGROUND", (0, 2), (-1, 2), PURPLE_DARK),
        ("LINEABOVE", (0, 2), (-1, 2), 1.5, CORAL),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, 1), 0.5, GRAY_LINE),
    ]))
    elements.append(totals_table)

    # ─── NOTES ───────────────────────────────────────────
    if order.notes:
        elements.append(Spacer(1, 0.5 * cm))
        notes_header = Table(
            [[Paragraph("  OBSERVACIONES", section_style)]],
            colWidths=[18 * cm], rowHeights=[0.7 * cm]
        )
        notes_header.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PURPLE_DARK),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        elements.append(notes_header)
        notes_box = Table(
            [[Paragraph(order.notes, info_style)]],
            colWidths=[18 * cm]
        )
        notes_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), CREAM),
            ("PADDING", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, GRAY_LINE),
        ]))
        elements.append(notes_box)

    # ─── FOOTER ──────────────────────────────────────────
    elements.append(Spacer(1, 1 * cm))

    # Footer divider
    elements.append(HRFlowable(
        width="100%", thickness=1, color=CORAL,
        spaceAfter=0.3 * cm
    ))

    footer_style = ParagraphStyle(
        "KebFooter", fontName="Helvetica", fontSize=8, textColor=GRAY_TEXT, alignment=TA_CENTER,
        leading=12,
    )
    footer_bold = ParagraphStyle(
        "KebFooterBold", fontName="Helvetica-Bold", fontSize=8, textColor=PURPLE_DARK, alignment=TA_CENTER,
    )

    elements.append(Paragraph(f"{business_name}", footer_bold))
    elements.append(Paragraph(
        f"Documento generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} | Importaciones USA → Chile",
        footer_style
    ))
    elements.append(Paragraph("Gracias por su preferencia ✦", footer_style))

    # Bottom accent bar
    elements.append(Spacer(1, 0.3 * cm))
    bottom_bar = Table(
        [[""]], colWidths=[18 * cm], rowHeights=[0.2 * cm]
    )
    bottom_bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CORAL),
    ]))
    elements.append(bottom_bar)

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
