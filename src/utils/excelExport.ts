import { db, collection, getDocs, query, where, doc, getDoc, setDoc, addDoc, serverTimestamp } from '../services/firebase';
import { formatDateVN } from './dateUtils';

const TECHNICAL_FIELDS = ['ownerId', 'ownerEmail', 'updatedBy', 'updatedAt', 'sync_status', 'is_deleted', 'data_json', 'composite_key', '_key'];

function stripTechnicalFields(item: any) {
	if (!item || typeof item !== 'object') return item;
	const cleaned: Record<string, any> = {};
	for (const [key, val] of Object.entries(item)) {
		if (TECHNICAL_FIELDS.includes(key)) continue;
		cleaned[key] = val;
	}
	return cleaned;
}

function filterByDate(data: any[], startTS: Date | null, endTS: Date | null) {
	if (!Array.isArray(data)) return [];
	if (!startTS && !endTS) return data;
	return data.filter((item) => {
		if (!item.createdAt && !item.orderDate && !item.date) return true;
		const rawDate = item.orderDate || item.date || item.createdAt;
		let d: Date | null = null;
		if (rawDate instanceof Date) {
			d = rawDate;
		} else if (typeof rawDate === 'string' || typeof rawDate === 'number') {
			d = new Date(rawDate);
		} else if (rawDate && typeof rawDate === 'object' && rawDate.seconds) {
			d = new Date(rawDate.seconds * 1000);
		}
		if (!d || isNaN(d.getTime())) return true;
		if (startTS && d < startTS) return false;
		if (endTS && d > endTS) return false;
		return true;
	});
}

/**
 * Universal Native & Web Excel Saver
 */
export async function saveWorkbookToFile(workbook: any, fileName: string): Promise<string> {
	let savedLocation = 'Thư mục Tải về (Downloads)';
	const XLSX = await import('xlsx');

	try {
		const { Capacitor } = await import('@capacitor/core');
		if (Capacitor.isNativePlatform()) {
			const { Filesystem, Directory } = await import('@capacitor/filesystem');
			const base64Data = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
			
			// Save in Documents directory
			await Filesystem.writeFile({
				path: fileName,
				data: base64Data,
				directory: Directory.Documents,
				recursive: true
			});
			savedLocation = 'Thư mục Documents & Tải về';

			// Also trigger virtual download so Android WebView download listener captures it
			const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
			const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			setTimeout(() => {
				try {
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
				} catch {}
			}, 2000);
		} else {
			// Web / Desktop Browser
			const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
			const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = fileName;
			document.body.appendChild(a);
			a.click();
			setTimeout(() => {
				try {
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
				} catch {}
			}, 2000);
		}
	} catch (writeErr) {
		console.warn('[ExcelExport] Native write fallback to XLSX.writeFile:', writeErr);
		XLSX.writeFile(workbook, fileName);
	}

	return savedLocation;
}

export interface ExportDataOptions {
	ownerId: string;
	startDate?: string;
	endDate?: string;
	isEmployee?: boolean;
	role?: string;
	exportCount?: number;
	userEmail?: string;
	displayName?: string;
	uid?: string;
}

export async function exportLocalDataToExcel(options: ExportDataOptions): Promise<{ totalRows: number; fileName: string; savedLocation: string }> {
	const { ownerId, startDate, endDate, isEmployee, role, exportCount = 0, userEmail = '', displayName = '', uid = '' } = options;
	if (!ownerId) throw new Error('Không tìm thấy mã cửa hàng (ownerId).');

	const startTS = startDate ? new Date(startDate + 'T00:00:00') : null;
	const endTS = endDate ? new Date(endDate + 'T23:59:59') : null;

	const targetCollections = [
		'customers',
		'products',
		'orders',
		'debts',
		'payments',
		'inventory_logs',
		'checkins',
		'attendance_logs',
		'supplier_debts',
		'purchase_orders'
	];

	const localData: Record<string, any[]> = {};

	// 1. Đọc dữ liệu từ SQLite / RAM Store cục bộ (0ms)
	for (const colName of targetCollections) {
		try {
			const snap = await getDocs(query(collection(db, colName), where('ownerId', '==', ownerId)));
			const items: any[] = [];
			snap.forEach((d: any) => {
				items.push({ id: d.id, ...d.data() });
			});

			const filtered = filterByDate(items, startTS, endTS);
			localData[colName] = filtered;
		} catch (err) {
			console.warn(`[LocalExport] Failed querying ${colName}:`, err);
			localData[colName] = [];
		}
	}

	// 2. Chuyển đổi dữ liệu sang định dạng tiếng Việt rõ ràng, đầy đủ 100% thông tin

	// KHÁCH HÀNG (Giữ trọn vẹn Tên cơ sở / Cửa hàng, SĐT, Địa chỉ, MST...)
	const customersFormatted = (localData.customers || []).map((c, idx) => ({
		'STT': idx + 1,
		'Mã khách hàng': c.id ? c.id.slice(0, 8).toUpperCase() : '',
		'Tên khách hàng': c.name || '',
		'Tên cơ sở / Cửa hàng': c.businessName || '',
		'Số điện thoại': c.phone || '',
		'Email': c.email || '',
		'Địa chỉ': c.address || '',
		'Tuyến đường / Khu vực': c.route || '',
		'Phân loại': c.type || 'Chưa phân loại',
		'Hạn mức công nợ (đ)': Number(c.creditLimit || 0),
		'Mã số thuế': c.taxCode || '',
		'Tên xuất HĐ': c.taxName || '',
		'Địa chỉ xuất HĐ': c.taxAddress || '',
		'SĐT xuất HĐ': c.taxPhone || '',
		'Trạng thái': c.status || 'Hoạt động',
		'Ghi chú': c.note || '',
		'Ngày tạo': c.createdAt ? formatDateVN(c.createdAt) : ''
	}));

	// SẢN PHẨM (Đầy đủ SKU, Tên, Danh mục, Quy cách, Giá bán, Giá vốn, Tồn kho...)
	const productsFormatted = (localData.products || []).map((p, idx) => ({
		'STT': idx + 1,
		'Mã SKU': p.sku || p.product_code || (p.id ? p.id.slice(0, 8).toUpperCase() : ''),
		'Số Seri': p.serialNumber || '',
		'Tên sản phẩm': p.name || '',
		'Danh mục': p.category || '',
		'Đơn vị tính': p.unit || '',
		'Quy cách': p.specification || '',
		'Đóng gói': p.packaging || '',
		'Tỷ trọng': p.density || '',
		'Giá bán (đ)': Number(p.priceSell || p.base_price || 0),
		'Giá vốn (đ)': Number(p.priceImport || p.buyPrice || p.costPrice || 0),
		'Tồn kho': Number(p.stock || p.inventory || 0),
		'Trạng thái': p.status || 'Đang kinh doanh',
		'Ghi chú': p.note || ''
	}));

	// ĐƠN HÀNG (Tổng quan đơn hàng)
	const ordersFormatted = (localData.orders || []).map((o, idx) => ({
		'STT': idx + 1,
		'Mã đơn hàng': o.order_code || (o.id ? o.id.slice(0, 8).toUpperCase() : ''),
		'Ngày đặt hàng': o.orderDate || (o.createdAt ? formatDateVN(o.createdAt) : ''),
		'Tên khách hàng': o.customerName || '',
		'Tên cơ sở': o.customerBusinessName || '',
		'Số điện thoại': o.customerPhone || '',
		'Địa chỉ giao': o.shippingAddress || o.customerAddress || '',
		'Tổng tiền hàng (đ)': Number(o.subTotal || o.totalAmount || 0),
		'Giảm giá (đ)': Number(o.discountAmt || o.discountValue || 0),
		'Phí vận chuyển (đ)': Number(o.shippingFee || 0),
		'Tổng thanh toán (đ)': Number(o.finalTotal || o.totalAmount || 0),
		'Đã thanh toán (đ)': Number(o.paidAmount || 0),
		'Còn nợ (đ)': Math.max(0, Number(o.finalTotal || o.totalAmount || 0) - Number(o.paidAmount || 0)),
		'Trạng thái thanh toán': o.isPaid ? 'Đã thanh toán' : (Number(o.paidAmount || 0) > 0 ? 'Thanh toán 1 phần' : 'Chưa thanh toán'),
		'Trạng thái giao hàng': o.deliveryStatus || o.status || 'Đã tạo',
		'Ghi chú': o.note || '',
		'Người lập đơn': o.createdByDisplayName || o.createdByEmail || o.createdBy || 'Admin'
	}));

	// CÔNG NỢ KHÁCH HÀNG
	const debtsFormatted = (localData.debts || []).map((d, idx) => ({
		'STT': idx + 1,
		'Mã khách hàng': d.customerId ? d.customerId.slice(0, 8).toUpperCase() : (d.id ? d.id.slice(0, 8).toUpperCase() : ''),
		'Tên khách hàng': d.customerName || '',
		'Tên cơ sở': d.customerBusinessName || '',
		'Số điện thoại': d.customerPhone || '',
		'Tổng tiền mua (đ)': Number(d.totalOrdersAmount || 0),
		'Tổng đã trả (đ)': Number(d.totalPaymentsAmount || 0),
		'Công nợ hiện tại (đ)': Number(d.totalDebt || d.debt || 0),
		'Hạn mức nợ (đ)': Number(d.creditLimit || 0),
		'Ghi chú': d.note || ''
	}));

	// LỊCH SỬ THU TIỀN
	const paymentsFormatted = (localData.payments || []).map((pay, idx) => ({
		'STT': idx + 1,
		'Mã phiếu thu': pay.id ? pay.id.slice(0, 8).toUpperCase() : '',
		'Ngày thu': pay.date ? formatDateVN(pay.date) : (pay.createdAt ? formatDateVN(pay.createdAt) : ''),
		'Tên khách hàng': pay.customerName || '',
		'Số tiền thu (đ)': Number(pay.amount || 0),
		'Hình thức': pay.method === 'transfer' ? 'Chuyển khoản' : (pay.method === 'cash' ? 'Tiền mặt' : (pay.method || 'Tiền mặt')),
		'Mã đơn liên quan': pay.orderId ? pay.orderId.slice(0, 8).toUpperCase() : '',
		'Người thu': pay.createdByDisplayName || pay.createdByEmail || pay.createdByName || '',
		'Ghi chú': pay.note || ''
	}));

	// XUẤT NHẬP TỒN KHO
	const inventoryLogsFormatted = (localData.inventory_logs || []).map((log, idx) => ({
		'STT': idx + 1,
		'Mã phiếu': log.id ? log.id.slice(0, 8).toUpperCase() : '',
		'Thời gian': log.createdAt ? formatDateVN(log.createdAt) : '',
		'Loại giao dịch': log.type === 'import' ? 'Nhập kho' : (log.type === 'export' ? 'Xuất kho' : log.type),
		'Tên sản phẩm': log.productName || '',
		'Mã SKU': log.sku || '',
		'Số lượng thay đổi': Number(log.qty || 0),
		'Tồn sau biến động': Number(log.newStock !== undefined ? log.newStock : (log.stockAfter || 0)),
		'Lý do / Ghi chú': log.reason || log.note || '',
		'Người thực hiện': log.createdByName || log.createdByEmail || log.createdBy || ''
	}));

	// CHECK-IN NHÂN VIÊN
	const checkinsFormatted = (localData.checkins || []).map((chk, idx) => ({
		'STT': idx + 1,
		'Thời gian': chk.createdAt ? formatDateVN(chk.createdAt) : (chk.checkinTime || ''),
		'Nhân viên': chk.staffName || chk.createdByDisplayName || chk.createdByEmail || '',
		'Khách hàng ghé thăm': chk.customerName || '',
		'Địa chỉ': chk.address || '',
		'Ghi chú / Hiện trường': chk.note || ''
	}));

	// CHẤM CÔNG
	const attendanceFormatted = (localData.attendance_logs || []).map((att, idx) => ({
		'STT': idx + 1,
		'Nhân viên': att.userName || att.userDisplayName || att.userEmail || '',
		'Ngày': att.date ? formatDateVN(att.date) : '',
		'Giờ vào': att.checkInTime || '',
		'Giờ ra': att.checkOutTime || '',
		'Tổng giờ làm': att.workHours || '',
		'Trạng thái': att.status || 'Hợp lệ',
		'Ghi chú': att.note || ''
	}));

	// CÔNG NỢ NHÀ CUNG CẤP
	const supplierDebtsFormatted = (localData.supplier_debts || []).map((sd, idx) => ({
		'STT': idx + 1,
		'Nhà cung cấp': sd.supplierName || '',
		'Số điện thoại': sd.supplierPhone || '',
		'Tổng tiền nhập (đ)': Number(sd.totalPurchases || 0),
		'Đã thanh toán (đ)': Number(sd.totalPaid || 0),
		'Còn nợ NCC (đ)': Number(sd.debt || 0),
		'Ghi chú': sd.note || ''
	}));

	// ĐƠN NHẬP HÀNG
	const purchaseOrdersFormatted = (localData.purchase_orders || []).map((po, idx) => ({
		'STT': idx + 1,
		'Mã đơn nhập': po.po_code || (po.id ? po.id.slice(0, 8).toUpperCase() : ''),
		'Ngày lập': po.orderDate ? formatDateVN(po.orderDate) : (po.createdAt ? formatDateVN(po.createdAt) : ''),
		'Nhà cung cấp': po.supplierName || '',
		'Tổng tiền nhập (đ)': Number(po.totalAmount || 0),
		'Trạng thái': po.status || 'Hoàn tất',
		'Người lập': po.createdByDisplayName || po.createdByEmail || '',
		'Ghi chú': po.note || ''
	}));

	// 3. Tính toán chi tiết từng dòng đơn hàng (chi_tiet_don_hang)
	const orderDetails: any[] = [];
	if (localData.orders && localData.orders.length > 0) {
		let overheadRate = 8.5;
		try {
			const settingsSnap = await getDoc(doc(db, 'settings', ownerId));
			if (settingsSnap.exists() && settingsSnap.data()?.overheadRate !== undefined) {
				overheadRate = Number(settingsSnap.data().overheadRate);
			}
		} catch {}

		const productMapById: Record<string, any> = {};
		const productMapByName: Record<string, any> = {};
		if (localData.products) {
			for (const p of localData.products) {
				if (p.id) productMapById[p.id] = p;
				if (p.name) productMapByName[p.name.trim().toLowerCase()] = p;
			}
		}

		const EXCLUDE_PROFIT_KEYWORDS = ['ứng tiền', 'ung tien', 'ưng tiền', 'ứng trước', 'ung truoc', 'tạm ứng', 'tam ung'];
		const isExcludedFromProfit = (name: string, flag: any) => {
			if (flag) return true;
			if (!name) return false;
			const lower = String(name).toLowerCase();
			return EXCLUDE_PROFIT_KEYWORDS.some((kw) => lower.includes(kw));
		};

		let detailIdx = 1;
		for (const order of localData.orders) {
			if (order.items && Array.isArray(order.items)) {
				for (const item of order.items) {
					const rawItem = typeof item === 'object' ? item : { item };
					const prodId = rawItem.id || rawItem.productId;
					const prodName = rawItem.name || rawItem.productName || '';
					const matchedProd = productMapById[prodId] || productMapByName[prodName.trim().toLowerCase()] || {};

					const excluded = isExcludedFromProfit(prodName, rawItem.excludeProfit || matchedProd.excludeProfit);
					const applyOverhead = rawItem.applyOverheadCost !== undefined
						? Boolean(rawItem.applyOverheadCost)
						: Boolean(matchedProd.applyOverheadCost);

					const qty = Number(rawItem.qty || 0);
					const priceSell = Number(rawItem.price !== undefined ? rawItem.price : (rawItem.priceSell || 0));
					const buyPrice = Number(rawItem.buyPrice !== undefined && rawItem.buyPrice !== null
						? rawItem.buyPrice
						: (matchedProd.priceImport || matchedProd.costPrice || matchedProd.buyPrice || 0));

					let unitProfit = 0;
					let profit = 0;

					if (!excluded) {
						let effectiveCost = buyPrice;
						if (applyOverhead && overheadRate > 0) {
							effectiveCost = buyPrice * (1 + overheadRate / 100);
						}
						unitProfit = priceSell - effectiveCost;
						profit = unitProfit * qty;
					}

					orderDetails.push({
						'STT': detailIdx++,
						'Mã đơn hàng': order.order_code || (order.id ? order.id.slice(0, 8).toUpperCase() : ''),
						'Ngày đặt hàng': order.orderDate || (order.createdAt ? formatDateVN(order.createdAt) : ''),
						'Khách hàng': order.customerName || '',
						'Tên cơ sở': order.customerBusinessName || '',
						'Sản phẩm': prodName,
						'Quy cách': rawItem.specification || matchedProd.specification || '',
						'Số lượng': qty,
						'Đơn vị': rawItem.unit || matchedProd.unit || '',
						'Đơn giá bán (đ)': priceSell,
						'Thành tiền (đ)': priceSell * qty,
						'Giá vốn (đ)': Math.round(buyPrice),
						'Lợi nhuận (đ)': Math.round(profit),
						'Lợi nhuận/ĐV (đ)': Math.round(unitProfit),
						'Người tạo': order.createdByDisplayName || order.createdByEmail || order.createdBy || 'Admin',
						'Ghi chú': rawItem.note || rawItem.notes || ''
					});
				}
			}
		}
	}

	// 4. Khởi tạo Workbook XLSX
	const XLSX = await import('xlsx');
	const workbook = XLSX.utils.book_new();

	const isStaff = isEmployee && role !== 'admin';

	const sheetsToExport: Array<{ name: string; data: any[] }> = isStaff
		? [
			{ name: 'Đơn hàng', data: ordersFormatted },
			{ name: 'Khách hàng', data: customersFormatted },
			{ name: 'Sản phẩm', data: productsFormatted },
			{ name: 'Tồn kho', data: inventoryLogsFormatted },
			{ name: 'Công nợ', data: debtsFormatted },
			{ name: 'Check-in', data: checkinsFormatted },
			{ name: 'Chấm công', data: attendanceFormatted }
		]
		: [
			{ name: 'Khách hàng', data: customersFormatted },
			{ name: 'Sản phẩm', data: productsFormatted },
			{ name: 'Đơn hàng', data: ordersFormatted },
			{ name: 'Chi tiết đơn hàng', data: orderDetails },
			{ name: 'Công nợ', data: debtsFormatted },
			{ name: 'Lịch sử thu tiền', data: paymentsFormatted },
			{ name: 'Tồn kho', data: inventoryLogsFormatted },
			{ name: 'Công nợ NCC', data: supplierDebtsFormatted },
			{ name: 'Đơn nhập hàng', data: purchaseOrdersFormatted },
			{ name: 'Check-in', data: checkinsFormatted },
			{ name: 'Chấm công', data: attendanceFormatted }
		];

	let totalRows = 0;
	for (const sheet of sheetsToExport) {
		if (sheet.data && sheet.data.length > 0) {
			totalRows += sheet.data.length;
			const worksheet = XLSX.utils.json_to_sheet(sheet.data);
			XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
		}
	}

	if (totalRows === 0) {
		const emptySheet = XLSX.utils.json_to_sheet([{ 'Thông báo': 'Không có dữ liệu trong khoảng thời gian đã chọn' }]);
		XLSX.utils.book_append_sheet(workbook, emptySheet, 'Dữ liệu');
	}

	// 5. Xuất và lưu file trực tiếp trên thiết bị (Offline 100%)
	const fileName = `Dunvex_DuLieu_${new Date().toISOString().slice(0, 10)}.xlsx`;
	const savedLocation = await saveWorkbookToFile(workbook, fileName);

	// 6. Ghi nhận nhật ký & giới hạn sử dụng ngầm (nếu có mạng)
	try {
		const currentMonth = new Date().toISOString().slice(0, 7);
		const usageRef = doc(db, 'usage_limits', `${ownerId}_${currentMonth}`);
		setDoc(usageRef, {
			ownerId,
			count: exportCount + 1,
			lastExportAt: serverTimestamp(),
			lastExportBy: displayName || userEmail || 'Người dùng'
		}, { merge: true }).catch(() => {});

		addDoc(collection(db, 'audit_logs'), {
			action: 'Bộ lưu dữ liệu (Export - Cục bộ SQLite)',
			user: displayName || userEmail || 'Người dùng',
			userId: uid,
			ownerId,
			details: `Đã trích xuất ${totalRows} dòng dữ liệu ra Excel trực tiếp từ bộ nhớ máy (Lần thứ ${exportCount + 1} trong tháng)`,
			createdAt: serverTimestamp()
		}).catch(() => {});
	} catch {}

	return { totalRows, fileName, savedLocation };
}
