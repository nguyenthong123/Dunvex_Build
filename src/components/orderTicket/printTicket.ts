import { printService, type PaperSize } from '../../services/printService';
import { generateTicketPng } from './ticketImage';
import { formatDate, formatPrice, computeTotalPackages, groupOrderItems } from './ticketUtils';
import { normalizePhoneDisplay } from '../../utils/validation';

export type TicketPrintPaper = PaperSize;

export interface PrintTicketOptions {
  companyInfo?: any;
  products?: any[];
  creatorName?: string;
}

/**
 * Tạo tài liệu HTML chuyên dụng cho in ấn A4/A5:
 * - Hỗ trợ phân trang tự nhiên (multi-page pagination) không bị co/thu nhỏ chữ khi đơn nhiều dòng.
 * - Table header lặp lại tự động ở đầu mỗi trang (thead display: table-header-group).
 * - Từng dòng sản phẩm và khối tổng tiền / chữ ký không bị cắt ngang qua ranh giới trang (page-break-inside: avoid).
 * - Kích thước ô ảnh và chữ cố định, hình ảnh không làm xô lệch các cột số lượng, đơn giá, thành tiền.
 */
export function generateA4PrintHtml(
  order: any,
  companyInfo: any = {},
  products: any[] = [],
  creatorName: string = '',
  paperSize: 'a4' | 'a5' = 'a4'
): string {
  const isA5 = paperSize === 'a5';
  const orderCode = order.orderId || order.order_code || order.id?.slice(0, 8).toUpperCase() || '';
  const orderDate = formatDate(order.orderDate || order.createdAt);
  const totalPkgs = computeTotalPackages(order);
  const totalWeight = order.totalWeight ? formatPrice(order.totalWeight) : 0;
  const customerName = order.customerBusinessName || order.customerName || 'Khách vãng lai';
  const customerPhone = normalizePhoneDisplay(order.customerPhone) || '---';
  const creator = creatorName || order.createdByDisplayName || order.createdByEmail || order.createdBy || 'Admin';
  const status = order.status || 'Đã tạo';

  const groupedItems = groupOrderItems(order.items || []);
  const hasImages = groupedItems.some((item: any) => !!(item.imageUrl || (products && products.find((p: any) => p.id === item.productId)?.imageUrl)));

  const subTotal = formatPrice(order.subTotal ?? order.totalAmount ?? 0);
  const discount = order.discountValue && Number(order.discountValue) > 0 ? formatPrice(order.discountValue) : null;
  const shipping = order.adjustmentValue && Number(order.adjustmentValue) > 0 ? formatPrice(order.adjustmentValue) : null;
  const totalAmount = formatPrice(order.totalAmount ?? order.finalTotal ?? 0);

  const phoneCreator = order.createdByPhone && order.createdByPhone.trim() ? order.createdByPhone : (companyInfo?.phone || '0988765444');
  const compName = companyInfo?.name || 'DUNVEX';
  const compAddr = companyInfo?.address || 'XÃ KIẾN ĐỨC , LÂM ĐỒNG';
  const compEmail = companyInfo?.email || 'dunvex.green@gmail.com';
  const logoUrl = companyInfo?.logoUrl;

  const rowsHtml = groupedItems.map((item: any) => {
    const itemImageUrl = item.imageUrl || (products && products.find((p: any) => p.id === item.productId)?.imageUrl);
    const itemPrice = formatPrice(item.price ?? item.priceSell ?? 0);
    const itemTotal = formatPrice((item.qty || 1) * (item.price ?? item.priceSell ?? 0));
    const initials = (item.name || 'SP').slice(0, 2).toUpperCase();

    const imgCell = hasImages ? `
      <td style="width: 52px; text-align: center; vertical-align: middle; padding: 6px 4px;">
        <div style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 1px solid #e2e8f0; display: inline-flex; align-items: center; justify-content: center; background: #f8fafc; margin: 0 auto;">
          ${itemImageUrl ? `<img src="${itemImageUrl}" alt="${item.name || ''}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" onerror="this.onerror=null;this.parentElement.innerHTML='<span style=\\'font-size:10px;font-weight:bold;color:#94a3b8;\\'>${initials}</span>';" />` : `<span style="font-size: 10px; font-weight: bold; color: #94a3b8;">${initials}</span>`}
        </div>
      </td>
    ` : '';

    return `
      <tr style="page-break-inside: avoid; break-inside: avoid; border-bottom: 1px solid #e2e8f0;">
        ${imgCell}
        <td style="padding: 8px 6px; vertical-align: middle;">
          <div style="font-weight: 800; font-size: ${isA5 ? '11px' : '13px'}; text-transform: uppercase; color: #000000; word-break: break-word;">${item.name || ''}</div>
          ${item.specification ? `<div style="font-size: ${isA5 ? '9px' : '11px'}; color: #64748b; font-weight: 600; margin-top: 2px;">Quy cách: ${item.specification}</div>` : ''}
          ${item.serialNumber ? `<div style="font-size: ${isA5 ? '8px' : '10px'}; color: #94a3b8; margin-top: 1px;">SN: ${item.serialNumber}</div>` : ''}
        </td>
        <td style="width: 55px; text-align: center; vertical-align: middle; padding: 8px 4px; font-weight: 700; color: #334155; font-size: ${isA5 ? '10px' : '12px'};">${item.unit || '---'}</td>
        <td style="width: 45px; text-align: center; vertical-align: middle; padding: 8px 4px; font-weight: 900; font-size: ${isA5 ? '12px' : '14px'}; color: #000000;">${item.qty || 1}</td>
        <td style="width: 90px; text-align: right; vertical-align: middle; padding: 8px 6px; font-weight: 700; color: #334155; font-size: ${isA5 ? '10px' : '12px'}; white-space: nowrap;">${itemPrice}</td>
        <td style="width: 105px; text-align: right; vertical-align: middle; padding: 8px 6px; font-weight: 900; font-size: ${isA5 ? '11px' : '13px'}; color: #000000; white-space: nowrap;">${itemTotal}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Phiếu Giao Hàng - ${orderCode}</title>
  <style>
    @page {
      size: ${paperSize.toUpperCase()} portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: ${isA5 ? '10px' : '12px'};
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    table.ticket-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    table.ticket-table thead {
      display: table-header-group;
    }
    table.ticket-table thead th {
      background: #0f172a !important;
      color: #ffffff !important;
      font-weight: 900;
      text-transform: uppercase;
      font-size: ${isA5 ? '9px' : '10px'};
      letter-spacing: 0.5px;
      padding: 8px 6px;
      border: 1px solid #0f172a;
    }
    table.ticket-table tbody tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .ticket-summary {
      page-break-inside: avoid;
      break-inside: avoid;
      margin-top: 12px;
    }
    .ticket-signatures {
      page-break-inside: avoid;
      break-inside: avoid;
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #f1f5f9;
    }
  </style>
</head>
<body>
  <div style="width: 100%; padding: 0;">
    <!-- Company & Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        ${logoUrl ? `<div style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; border: 1px solid #e2e8f0;"><img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" /></div>` : ''}
        <div>
          <h2 style="font-size: ${isA5 ? '16px' : '20px'}; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">${compName}</h2>
          <div style="font-size: ${isA5 ? '9px' : '11px'}; color: #334155; font-weight: 700; margin-top: 2px;">${compAddr}</div>
          <div style="font-size: ${isA5 ? '9px' : '11px'}; color: #334155; font-weight: 700; margin-top: 1px;">SĐT: ${phoneCreator} • Email: ${compEmail}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="display: inline-block; padding: 4px 10px; background: #f1f5f9; border-radius: 6px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">Hệ Thống Quản Lý Đơn Hàng</div>
      </div>
    </div>

    <!-- Title Bar -->
    <div style="text-align: center; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 8px 0; margin-bottom: 10px;">
      <h1 style="font-size: ${isA5 ? '18px' : '22px'}; font-weight: 900; letter-spacing: 4px; text-transform: uppercase;">PHIẾU GIAO HÀNG</h1>
    </div>

    <!-- Meta Details Bar -->
    <div style="display: flex; justify-content: space-around; border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 6px 0; font-size: ${isA5 ? '10px' : '12px'}; font-weight: 700;">
      <div><span style="color: #64748b; text-transform: uppercase;">Mã Đơn:</span> <strong>#${orderCode}</strong></div>
      <div><span style="color: #64748b; text-transform: uppercase;">Ngày:</span> <strong>${orderDate}</strong></div>
      <div><span style="color: #64748b; text-transform: uppercase;">Kiện:</span> <strong>${totalPkgs}</strong></div>
      <div><span style="color: #64748b; text-transform: uppercase;">TL tải:</span> <strong>${totalWeight} kg</strong></div>
    </div>

    <!-- Customer & Creator -->
    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
      <div>
        <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Khách hàng</div>
        <div style="font-size: ${isA5 ? '13px' : '16px'}; font-weight: 900; text-transform: uppercase; color: #000; margin-top: 2px;">${customerName}</div>
        <div style="font-size: ${isA5 ? '10px' : '12px'}; font-weight: 800; color: #334155; margin-top: 2px;">SĐT: ${customerPhone}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Người lập phiếu</div>
        <div style="font-size: ${isA5 ? '12px' : '14px'}; font-weight: 900; text-transform: uppercase; color: #000; margin-top: 2px;">${creator}</div>
        <div style="display: inline-block; margin-top: 4px; padding: 2px 8px; background: #000; color: #fff; border-radius: 4px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">${status}</div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="ticket-table">
      <thead>
        <tr>
          ${hasImages ? '<th style="width: 52px; padding: 8px 4px; text-align: center; border: 1px solid #0f172a;">ẢNH</th>' : ''}
          <th style="padding: 8px 6px; text-align: left; border: 1px solid #0f172a;">TÊN HÀNG HÓA / SẢN PHẨM</th>
          <th style="width: 55px; padding: 8px 4px; text-align: center; border: 1px solid #0f172a;">ĐVT</th>
          <th style="width: 45px; padding: 8px 4px; text-align: center; border: 1px solid #0f172a;">SL</th>
          <th style="width: 90px; padding: 8px 6px; text-align: right; border: 1px solid #0f172a;">ĐƠN GIÁ</th>
          <th style="width: 105px; padding: 8px 6px; text-align: right; border: 1px solid #0f172a;">THÀNH TIỀN</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Notes & Totals -->
    <div class="ticket-summary" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
      <div style="flex: 1;">
        ${order.note ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; text-align: left;">
            <div style="font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px;">Ghi chú đơn hàng:</div>
            <div style="font-size: 11px; font-style: italic; color: #0f172a;">"${order.note}"</div>
          </div>
        ` : ''}
      </div>
      <div style="width: 280px; shrink: 0; text-align: right;">
        <div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; font-weight: 700; color: #64748b;">
          <span style="text-transform: uppercase;">Cộng tiền hàng:</span>
          <span style="color: #0f172a; font-size: 13px; font-weight: 800;">${subTotal} ₫</span>
        </div>
        ${discount ? `
          <div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; font-weight: 700; color: #dc2626;">
            <span style="text-transform: uppercase; font-style: italic;">Chiết khấu giảm (-):</span>
            <span style="font-size: 13px; font-weight: 800;">-${discount} ₫</span>
          </div>
        ` : ''}
        ${shipping ? `
          <div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; font-weight: 700; color: #64748b;">
            <span style="text-transform: uppercase; font-style: italic;">Phí vận chuyển (+):</span>
            <span style="color: #0f172a; font-size: 13px; font-weight: 800;">+${shipping} ₫</span>
          </div>
        ` : ''}
        <div style="border-top: 2px solid #0f172a; margin-top: 4px; padding-top: 4px;">
          <div style="font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #0f172a;">TỔNG THANH TOÁN:</div>
          <div style="font-size: 24px; font-weight: 900; color: #000000; letter-spacing: -0.5px; line-height: 1.1; margin-top: 2px;">${totalAmount} ₫</div>
        </div>
      </div>
    </div>

    <!-- Signatures -->
    <div class="ticket-signatures" style="display: flex; justify-content: space-between; text-align: center;">
      <div style="width: 30%;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 45px;">Người Lập Phiếu</div>
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; border-top: 1px dashed #cbd5e1; padding-top: 4px;">${creator}</div>
      </div>
      <div style="width: 30%;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 45px;">Người Giao Hàng</div>
        <div style="width: 80px; height: 1px; background: #e2e8f0; margin: 0 auto;"></div>
      </div>
      <div style="width: 30%;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 45px;">Người Nhận Hàng</div>
        <div style="width: 80px; height: 1px; background: #e2e8f0; margin: 0 auto;"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export const printTicket = async (
  layoutMode: 'a4' | 'receipt',
  order: any,
  cachedDataUrl?: string | null,
  paperSizeOverride?: TicketPrintPaper,
  ticketOptions?: PrintTicketOptions
): Promise<void> => {
	const resolvedPaperSize = paperSizeOverride || (layoutMode === 'receipt' ? 'k80' : 'a4');
	const isReceipt = resolvedPaperSize === 'k80' || resolvedPaperSize === 'k57';
	const orderCode = order.orderId || order.order_code || order.id?.slice(0, 8).toUpperCase() || '';

	let fullHtml = '';

	// 1. In khổ giấy A4 hoặc A5: Tạo tài liệu HTML chuyên dụng để phân trang tự nhiên (WEB-02 & WEB-03)
	if (!isReceipt) {
		fullHtml = generateA4PrintHtml(
			order,
			ticketOptions?.companyInfo,
			ticketOptions?.products,
			ticketOptions?.creatorName,
			resolvedPaperSize as 'a4' | 'a5'
		);
	} else {
		// 2. In mẫu Bill nhiệt K80 / K57
		const activeId = 'order-ticket-bill';
		const printContent = typeof document !== 'undefined' ? document.getElementById(activeId) : null;

		let dataUrl = cachedDataUrl;
		if (!dataUrl && printContent) {
			try {
				dataUrl = await generateTicketPng(printContent, true, 480);
			} catch (e) {
				console.warn('[printTicket] Error generating receipt PNG for print:', e);
			}
		}

		const pageSize = resolvedPaperSize === 'k57' ? '57mm auto' : '80mm auto';
		const rollWidth = resolvedPaperSize === 'k57' ? '57mm' : '80mm';

		if (dataUrl) {
			fullHtml = `
				<!DOCTYPE html>
				<html>
					<head>
						<meta charset="utf-8">
						<title>Phiếu Giao Hàng - ${orderCode}</title>
						<style>
							@page {
								size: ${pageSize};
								margin: 0;
							}
							* { box-sizing: border-box; margin: 0; padding: 0; }
							html, body {
								width: ${rollWidth};
								margin: 0 auto;
								padding: 0;
								background: #ffffff;
								-webkit-print-color-adjust: exact !important;
								print-color-adjust: exact !important;
							}
							img {
								width: 100%;
								height: auto;
								display: block;
							}
						</style>
					</head>
					<body>
						<img src="${dataUrl}" alt="Phiếu Giao Hàng" />
					</body>
				</html>
			`;
		} else if (printContent) {
			fullHtml = `
				<!DOCTYPE html>
				<html>
					<head>
						<meta charset="utf-8">
						<title>Phiếu Giao Hàng - ${orderCode}</title>
						<style>
							@page { size: ${pageSize}; margin: 0; }
							body { margin: 0; padding: 10px; background: white; font-family: sans-serif; width: ${rollWidth}; }
						</style>
					</head>
					<body>
						${printContent.outerHTML}
					</body>
				</html>
			`;
		}
	}

	printService.printHtml(fullHtml, {
		isReceipt,
		title: `In Phiếu - ${orderCode}`,
		paperSize: resolvedPaperSize,
	});
};
