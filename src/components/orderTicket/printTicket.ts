import { printService, type PaperSize } from '../../services/printService';
import { generateTicketPng } from './ticketImage';

export type TicketPrintPaper = PaperSize;

export const printTicket = async (
  layoutMode: 'a4' | 'receipt',
  order: any,
  cachedDataUrl?: string | null,
  paperSizeOverride?: TicketPrintPaper
): Promise<void> => {
	const resolvedPaperSize = paperSizeOverride || (layoutMode === 'receipt' ? 'k80' : 'a4');
	const isReceipt = resolvedPaperSize === 'k80' || resolvedPaperSize === 'k57';
	const activeId = layoutMode === 'receipt' ? 'order-ticket-bill' : 'order-ticket-paper';
	const printContent = document.getElementById(activeId);
	if (!printContent && !cachedDataUrl) {
		console.warn(`[printTicket] Element #${activeId} not found`);
		return;
	}

	let dataUrl = cachedDataUrl;
	if (!dataUrl && printContent) {
		try {
			dataUrl = await generateTicketPng(printContent, isReceipt, isReceipt ? 480 : 1000);
		} catch (e) {
			console.warn('[printTicket] Error generating high-res PNG for print:', e);
		}
	}

	const orderCode = order.orderId || order.order_code || order.id?.slice(0, 8).toUpperCase() || '';
	const pageSize = resolvedPaperSize === 'k57'
		? '57mm auto'
		: resolvedPaperSize === 'k80'
			? '80mm auto'
			: resolvedPaperSize === 'a5'
				? 'A5 portrait'
				: 'A4 portrait';

	let fullHtml = '';
	if (dataUrl) {
		if (isReceipt) {
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
								width: ${resolvedPaperSize === 'k57' ? '57mm' : '80mm'};
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
		} else {
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
								width: 100%;
								height: 100%;
								margin: 0;
								padding: 0;
								background: #ffffff;
								-webkit-print-color-adjust: exact !important;
								print-color-adjust: exact !important;
								overflow: hidden;
							}
							.page-container {
								width: 100%;
								height: 100%;
								display: flex;
								justify-content: center;
								align-items: flex-start;
								padding: 0;
								margin: 0;
								page-break-inside: avoid !important;
								page-break-after: avoid !important;
							}
							img {
								width: 100%;
								max-width: ${resolvedPaperSize === 'a5' ? '148mm' : '210mm'};
								max-height: ${resolvedPaperSize === 'a5' ? '210mm' : '297mm'};
								height: auto;
								display: block;
								margin: 0 auto;
								page-break-inside: avoid !important;
								page-break-after: avoid !important;
							}
						</style>
					</head>
					<body>
						<div class="page-container">
							<img src="${dataUrl}" alt="Phiếu Giao Hàng" />
						</div>
					</body>
				</html>
			`;
		}
	} else if (printContent) {
		fullHtml = `
			<!DOCTYPE html>
			<html>
				<head>
					<meta charset="utf-8">
					<title>Phiếu Giao Hàng - ${orderCode}</title>
					<style>
						@page { size: ${pageSize}; margin: 0; }
						body { margin: 0; padding: 10px; background: white; font-family: sans-serif; }
					</style>
				</head>
				<body>
					${printContent.outerHTML}
				</body>
			</html>
		`;
	}

	printService.printHtml(fullHtml, {
		isReceipt,
		title: `In Phiếu - ${orderCode}`,
		paperSize: resolvedPaperSize,
	});
};
