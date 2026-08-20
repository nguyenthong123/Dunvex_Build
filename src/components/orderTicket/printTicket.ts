export const printTicket = (layoutMode: 'a4' | 'receipt', order: any): void => {
		const isReceipt = layoutMode === 'receipt';
		const activeId = isReceipt ? 'order-ticket-bill' : 'order-ticket-paper';
		const printContent = document.getElementById(activeId);
		if (!printContent) return;

		const printWindow = window.open('', '_blank', 'width=1200,height=1000');
		if (!printWindow) {
			alert("Vui lòng cho phép trình duyệt mở popup để in!");
			return;
		}

		// Compile active CSS rules directly to prevent black & white styling due to lazy-loaded CSS
		let styles = '';
		try {
			for (const sheet of document.styleSheets) {
				try {
					if (sheet.cssRules) {
						for (const rule of sheet.cssRules) {
							styles += rule.cssText + '\n';
						}
					}
				} catch (e) {
					// Fallback for cross-origin styles
					if (sheet.href) {
						styles += `@import url("${sheet.href}");\n`;
					}
				}
			}
		} catch (err) {
			console.warn("Could not inline all styles directly", err);
		}

		// Also collect current HTML style/link nodes as a fallback
		let fallbackTags = '';
		document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
			fallbackTags += node.outerHTML;
		});

		const pageStyle = isReceipt 
			? `@page { size: 80mm auto; margin: 0; }` 
			: `@page { size: A4; margin: 8mm 10mm 10mm 10mm; }`;

		const receiptSpecificPrintStyles = isReceipt ? `
			body {
				width: 80mm !important;
				margin: 0 auto !important;
				padding: 0 !important;
				background: white !important;
			}
			#order-ticket-bill {
				width: 80mm !important;
				max-width: 80mm !important;
				padding: 10px !important;
				box-shadow: none !important;
				border: none !important;
			}
		` : '';

		printWindow.document.write(`
			<html>
				<head>
					<base href="${window.location.origin}/">
					<title>In Phiếu - ${order.orderId || ''}</title>
					<link rel="preconnect" href="https://fonts.googleapis.com">
					<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
					<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
					<style>${styles}</style>
					${fallbackTags}
					<style>
						body { 
							background: white !important; 
							padding: 0 !important; margin: 0 !important; 
							display: flex !important; justify-content: center !important;
							font-family: 'Inter', 'Manrope', sans-serif !important;
							color: #000000 !important;
						}
						#order-ticket-paper {
							margin: 0 !important;
							box-shadow: none !important;
							border: none !important;
							width: 100% !important;
							max-width: 100% !important;
							background: white !important;
							visibility: visible !important;
							display: block !important;
							padding: 0 !important;
						}
						
						/* Table formatting for A4 crisp printing */
						table {
							width: 100% !important;
							border-collapse: collapse !important;
							margin-top: 15px !important;
							page-break-inside: auto !important;
						}
						tr {
							page-break-inside: avoid !important;
							page-break-after: auto !important;
						}
						thead {
							display: table-header-group !important;
						}
						thead tr {
							background-color: #000000 !important;
							color: #ffffff !important;
						}
						th {
							background-color: #000000 !important;
							color: #ffffff !important;
							border: 1px solid #000000 !important;
							font-weight: 900 !important;
							font-size: 13px !important;
							text-transform: uppercase !important;
							padding: 12px 10px !important;
						}
						td {
							border: 1px solid #cbd5e1 !important;
							font-size: 13px !important;
							padding: 12px 10px !important;
							color: #000000 !important;
						}
						
						/* Force high fidelity colors */
						* {
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
						}
						.text-black {
							color: #000000 !important;
						}
						
						${pageStyle}
						${receiptSpecificPrintStyles}

						@media print {
							body { 
								background: white !important; 
								-webkit-print-color-adjust: exact !important;
								print-color-adjust: exact !important;
							}
							
							/* Hide the right-side banner in A4 header to save space */
							#order-ticket-paper header .text-right {
								display: none !important;
							}
							#order-ticket-paper header.p-8 {
								padding: 12px 16px !important;
							}
							#order-ticket-paper img {
								height: 48px !important;
							}
							#order-ticket-paper .size-14, #order-ticket-paper .size-16 {
								width: 48px !important;
								height: 48px !important;
							}
							#order-ticket-paper h2.text-3xl {
								font-size: 24px !important;
							}
							#order-ticket-paper h1.text-4xl {
								font-size: 24px !important;
								letter-spacing: 4px !important;
								margin-bottom: 12px !important;
								padding-top: 6px !important;
								padding-bottom: 6px !important;
								border-top-width: 2px !important;
								border-bottom-width: 2px !important;
							}
							#order-ticket-paper header > div.flex.justify-center.gap-10 {
								padding-top: 10px !important;
								padding-bottom: 10px !important;
								gap: 24px !important;
								font-size: 13px !important;
							}
							#order-ticket-paper section.px-8.py-6 {
								padding: 10px 16px !important;
								gap: 16px !important;
							}
							#order-ticket-paper section.px-8.py-6 span.text-xl {
								font-size: 18px !important;
							}
							#order-ticket-paper section.px-8.pb-6 {
								padding-left: 16px !important;
								padding-right: 16px !important;
								padding-bottom: 10px !important;
							}
							#order-ticket-paper th {
								background-color: #000000 !important;
								color: #ffffff !important;
								padding: 10px 8px !important;
								font-size: 12px !important;
							}
							#order-ticket-paper td {
								padding: 10px 8px !important;
								font-size: 13px !important;
								border: 1px solid #000000 !important;
							}
							#order-ticket-paper td .size-12 {
								width: 32px !important;
								height: 32px !important;
							}
							#order-ticket-paper section.px-8.pb-8 {
								padding-left: 16px !important;
								padding-right: 16px !important;
								padding-bottom: 10px !important;
							}
							#order-ticket-paper section.px-8.pb-8 .text-4xl {
								font-size: 26px !important;
							}
							#order-ticket-paper section.px-8.pb-8 .p-5 {
								padding: 12px 16px !important;
								border-radius: 12px !important;
							}
						}
					</style>
				</head>
				<body>
					<div class="print-container">
						${printContent.outerHTML}
					</div>
					<script>
						function checkStylesAndPrint() {
							const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
							let loadedCount = 0;
							
							const printAndClose = () => {
								if (window.hasPrinted) return;
								window.hasPrinted = true;
								
								if (document.fonts && document.fonts.ready) {
									document.fonts.ready.then(() => {
										setTimeout(() => {
											window.print();
											if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
												window.close();
											}
										}, 250);
									}).catch(() => {
										setTimeout(() => {
											window.print();
											if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
												window.close();
											}
										}, 250);
									});
								} else {
									setTimeout(() => {
										window.print();
										if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
											window.close();
										}
									}, 250);
								}
							};

							if (links.length === 0) {
								printAndClose();
								return;
							}
							
							links.forEach(link => {
								if (link.sheet) {
									loadedCount++;
									if (loadedCount === links.length) {
										printAndClose();
									}
								} else {
									link.onload = () => {
										loadedCount++;
										if (loadedCount === links.length) {
											printAndClose();
										}
									};
									link.onerror = () => {
										loadedCount++;
										if (loadedCount === links.length) {
											printAndClose();
										}
									};
								}
							});
							
							// Backup timeout to make sure it prints even if a resource is blocked
							setTimeout(printAndClose, 1200);
						}
						
						if (document.readyState === 'complete') {
							checkStylesAndPrint();
						} else {
							window.onload = checkStylesAndPrint;
						}
					</script>
				</body>
			</html>
		`);
		printWindow.document.close();

};
