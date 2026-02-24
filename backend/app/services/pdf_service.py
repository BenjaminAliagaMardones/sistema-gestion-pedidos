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

# Colores corporativos
PRIMARY_COLOR = colors.HexColor("#6C63FF")
SECONDARY_COLOR = colors.HexColor("#2D2D44")
LIGHT_GRAY = colors.HexColor("#F5F5F5")
MEDIUM_GRAY = colors.HexColor("#888888")
WHITE = colors.white
DARK = colors.HexColor("#1A1A2E")


def format_clp(value: float) -> str:
    return f"$ {int(value):,}".replace(",", ".")


def format_usd(value: float) -> str:
    return f"USD {value:.2f}"


def generate_invoice_pdf(order, client, items, business_config) -> bytes:
    """Genera el PDF de la boleta y retorna los bytes."""
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # --- ENCABEZADO ---
    header_data = []
    
    # Logo
    logo_cell = ""
    if business_config and business_config.logo_path and os.path.exists(business_config.logo_path):
        try:
            img = Image(business_config.logo_path, width=3*cm, height=3*cm, kind='proportional')
            logo_cell = img
        except Exception:
            logo_cell = ""

    business_name = business_config.business_name if business_config else "Mi Negocio"

    title_style = ParagraphStyle(
        "Title",
        fontName="Helvetica-Bold",
        fontSize=22,
        textColor=PRIMARY_COLOR,
        alignment=TA_LEFT,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        fontName="Helvetica",
        fontSize=10,
        textColor=MEDIUM_GRAY,
        alignment=TA_LEFT,
    )
    header_right_style = ParagraphStyle(
        "HeaderRight",
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=SECONDARY_COLOR,
        alignment=TA_RIGHT,
    )
    header_right_sub = ParagraphStyle(
        "HeaderRightSub",
        fontName="Helvetica",
        fontSize=9,
        textColor=MEDIUM_GRAY,
        alignment=TA_RIGHT,
    )

    left_content = [
        [logo_cell if logo_cell else Spacer(1, 0.1*cm)],
        [Paragraph(business_name, title_style)],
        [Paragraph("Sistema de Gestión de Pedidos", subtitle_style)],
    ]

    right_content = [
        [Paragraph("BOLETA DE PEDIDO", header_right_style)],
        [Paragraph(f"Fecha: {order.order_date.strftime('%d/%m/%Y') if order.order_date else datetime.now().strftime('%d/%m/%Y')}", header_right_sub)],
        [Paragraph(f"N° Pedido: {str(order.id)[:8].upper()}", header_right_sub)],
        [Paragraph(f"Estado: {order.status.value}", header_right_sub)],
    ]

    header_table = Table(
        [[
            Table(left_content, colWidths=[10*cm]),
            Table(right_content, colWidths=[8*cm])
        ]],
        colWidths=[10*cm, 8*cm]
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=2, color=PRIMARY_COLOR, spaceAfter=0.5*cm, spaceBefore=0.5*cm))

    # --- INFORMACIÓN DEL CLIENTE ---
    section_style = ParagraphStyle(
        "Section",
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=PRIMARY_COLOR,
        spaceBefore=0.3*cm,
        spaceAfter=0.2*cm,
    )
    info_style = ParagraphStyle(
        "Info",
        fontName="Helvetica",
        fontSize=9,
        textColor=SECONDARY_COLOR,
        leading=14,
    )
    bold_style = ParagraphStyle(
        "Bold",
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=DARK,
    )

    elements.append(Paragraph("INFORMACIÓN DEL CLIENTE", section_style))
    client_data = [
        [Paragraph("Nombre:", bold_style), Paragraph(client.name, info_style),
         Paragraph("Banco:", bold_style), Paragraph(order.payment_bank or "—", info_style)],
        [Paragraph("Teléfono:", bold_style), Paragraph(client.phone, info_style),
         Paragraph("Método de Pago:", bold_style), Paragraph(order.payment_method or "—", info_style)],
        [Paragraph("Email:", bold_style), Paragraph(client.email or "—", info_style),
         Paragraph("Tasa USD→CLP:", bold_style), Paragraph(f"{order.exchange_rate:,.0f}", info_style)],
        [Paragraph("Dirección:", bold_style), Paragraph(client.address or "—", info_style),
         Paragraph("", info_style), Paragraph("", info_style)],
    ]

    client_table = Table(client_data, colWidths=[3*cm, 6*cm, 4*cm, 5*cm])
    client_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GRAY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT_GRAY]),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(client_table)
    elements.append(Spacer(1, 0.5*cm))

    # --- TABLA DE PRODUCTOS ---
    elements.append(Paragraph("DETALLE DE PRODUCTOS", section_style))

    col_header_style = ParagraphStyle(
        "ColHeader", fontName="Helvetica-Bold", fontSize=8, textColor=WHITE, alignment=TA_CENTER
    )
    cell_right = ParagraphStyle(
        "CellRight", fontName="Helvetica", fontSize=8, textColor=SECONDARY_COLOR, alignment=TA_RIGHT
    )
    cell_center = ParagraphStyle(
        "CellCenter", fontName="Helvetica", fontSize=8, textColor=SECONDARY_COLOR, alignment=TA_CENTER
    )
    cell_left = ParagraphStyle(
        "CellLeft", fontName="Helvetica", fontSize=8, textColor=SECONDARY_COLOR, alignment=TA_LEFT
    )

    prod_headers = [
        Paragraph("PRODUCTO", col_header_style),
        Paragraph("PRECIO BASE", col_header_style),
        Paragraph("TAX %", col_header_style),
        Paragraph("TAX USD", col_header_style),
        Paragraph("COMIS. %", col_header_style),
        Paragraph("COMIS. USD", col_header_style),
        Paragraph("CANT.", col_header_style),
        Paragraph("TOTAL USD", col_header_style),
        Paragraph("TOTAL CLP", col_header_style),
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
            Paragraph(format_clp(item.final_price_clp), cell_right),
        ])

    prod_table = Table(
        prod_data,
        colWidths=[4.5*cm, 2.3*cm, 1.5*cm, 2*cm, 1.7*cm, 2*cm, 1.3*cm, 2.2*cm, 2.5*cm],
        repeatRows=1
    )
    prod_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    elements.append(prod_table)
    elements.append(Spacer(1, 0.5*cm))

    # --- TOTALES ---
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#DDDDDD"), spaceAfter=0.3*cm))

    total_label_style = ParagraphStyle(
        "TotalLabel", fontName="Helvetica", fontSize=10, textColor=SECONDARY_COLOR, alignment=TA_RIGHT
    )
    total_value_style = ParagraphStyle(
        "TotalValue", fontName="Helvetica-Bold", fontSize=10, textColor=DARK, alignment=TA_RIGHT
    )
    grand_total_style = ParagraphStyle(
        "GrandTotal", fontName="Helvetica-Bold", fontSize=13, textColor=WHITE, alignment=TA_RIGHT
    )

    totals_data = [
        [Paragraph("Total Tax USD:", total_label_style), Paragraph(format_usd(order.total_tax_usd), total_value_style)],
        [Paragraph("Total Comisión USD:", total_label_style), Paragraph(format_usd(order.total_commission_usd), total_value_style)],
        [Paragraph("Total Ganancia USD:", total_label_style), Paragraph(format_usd(order.total_profit_usd), total_value_style)],
        [Paragraph("TOTAL USD:", ParagraphStyle("TG1", fontName="Helvetica-Bold", fontSize=11, textColor=PRIMARY_COLOR, alignment=TA_RIGHT)),
         Paragraph(format_usd(order.total_usd), ParagraphStyle("TG2", fontName="Helvetica-Bold", fontSize=11, textColor=PRIMARY_COLOR, alignment=TA_RIGHT))],
        [Paragraph("TOTAL CLP:", ParagraphStyle("TG3", fontName="Helvetica-Bold", fontSize=13, textColor=WHITE, alignment=TA_RIGHT)),
         Paragraph(format_clp(order.total_clp), ParagraphStyle("TG4", fontName="Helvetica-Bold", fontSize=13, textColor=WHITE, alignment=TA_RIGHT))],
    ]

    totals_table = Table(totals_data, colWidths=[12*cm, 6*cm])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 4), (-1, 4), PRIMARY_COLOR),
        ("ROWBACKGROUNDS", (0, 0), (-1, 3), [WHITE, LIGHT_GRAY, WHITE, LIGHT_GRAY]),
        ("LINEABOVE", (0, 3), (-1, 3), 1, PRIMARY_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(totals_table)

    # --- OBSERVACIONES ---
    if order.notes:
        elements.append(Spacer(1, 0.5*cm))
        elements.append(Paragraph("OBSERVACIONES", section_style))
        elements.append(Paragraph(order.notes, info_style))

    # --- PIE DE PÁGINA ---
    elements.append(Spacer(1, 1*cm))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#DDDDDD"), spaceAfter=0.3*cm))
    footer_style = ParagraphStyle(
        "Footer", fontName="Helvetica", fontSize=8, textColor=MEDIUM_GRAY, alignment=TA_CENTER
    )
    elements.append(Paragraph(f"Documento generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} | {business_name}", footer_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
