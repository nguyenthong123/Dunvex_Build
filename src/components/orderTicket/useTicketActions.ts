import { useEffect, useRef, useCallback } from 'react';
import { printTicket } from './printTicket';
import { generateTicketPng, formatImageError } from './ticketImage';
import { getTicketImageFilename } from './ticketUtils';

interface UseTicketActionsParams {
	layoutMode: 'a4' | 'receipt';
	order: any;
	capturedImage: string | null;
	setCapturedImage: (url: string | null) => void;
	setIsSavingImage: (v: boolean) => void;
	setShowCopySuccess: (v: boolean) => void;
	companyInfo?: any;
	products?: any[];
}

/** Synchronously convert a base64 Data URL to a Blob (bypasses iOS Safari fetch restrictions for data: scheme) */
const dataURLtoBlob = (dataUrl: string): Blob => {
	const arr = dataUrl.split(',');
	const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
	const bstr = atob(arr[1]);
	let n = bstr.length;
	const u8arr = new Uint8Array(n);
	while (n--) {
		u8arr[n] = bstr.charCodeAt(n);
	}
	return new Blob([u8arr], { type: mime });
};

export const useTicketActions = ({
	layoutMode,
	order,
	capturedImage,
	setCapturedImage,
	setIsSavingImage,
	setShowCopySuccess,
	companyInfo,
	products,
}: UseTicketActionsParams) => {
	// Cache the pre-generated PNG so clipboard copy can be near-instant
	const cachedPngRef = useRef<string | null>(null);
	const cachedBlobRef = useRef<Blob | null>(null);
	const isGeneratingRef = useRef(false);

	/** Pre-generate ticket PNG in background when component mounts / layout / data changes */
	const preGeneratePng = useCallback(async () => {
		if (isGeneratingRef.current) return;
		const isReceipt = layoutMode === 'receipt';
		const activeId = isReceipt ? 'order-ticket-bill' : 'order-ticket-paper';
		const node = document.getElementById(activeId);
		if (!node) return;

		isGeneratingRef.current = true;
		try {
			const dataUrl = await generateTicketPng(node, isReceipt);
			cachedPngRef.current = dataUrl;
			// Convert to Blob synchronously to avoid Safari fetch() blocks
			cachedBlobRef.current = dataURLtoBlob(dataUrl);
		} catch (e) {
			console.warn('Pre-generate ticket PNG failed:', e);
			cachedPngRef.current = null;
			cachedBlobRef.current = null;
		} finally {
			isGeneratingRef.current = false;
		}
	}, [layoutMode]);

	// Auto pre-generate after a short delay to let the DOM render fully
	useEffect(() => {
		cachedPngRef.current = null;
		cachedBlobRef.current = null;
		const timer = setTimeout(() => {
			preGeneratePng();
		}, 800); // 800ms is perfect for React layout to stabilize
		return () => clearTimeout(timer);
	}, [layoutMode, order?.id, companyInfo, products, preGeneratePng]);

	const handlePrint = () => {
		printTicket(layoutMode, order);
	};

	const handleSaveImage = async () => {
		const isReceipt = layoutMode === 'receipt';
		const activeId = isReceipt ? 'order-ticket-bill' : 'order-ticket-paper';
		const node = document.getElementById(activeId);
		if (!node) return;

		setIsSavingImage(true);
		try {
			// Use cached PNG if available, otherwise generate fresh
			let dataUrl = cachedPngRef.current;
			if (!dataUrl) {
				dataUrl = await generateTicketPng(node, isReceipt);
				cachedPngRef.current = dataUrl;
			}

			const link = document.createElement('a');
			link.download = getTicketImageFilename(layoutMode, order);
			link.href = dataUrl;
			link.click();
		} catch (error: any) {
			console.error("Lỗi tạo hình ảnh:", error);
			alert("Không thể tạo hình ảnh phiếu giao hàng: " + formatImageError(error) + "\nGợi ý: thử 'Lưu ảnh' rồi gửi ảnh qua Zalo.");
		} finally {
			setIsSavingImage(false);
		}
	};

	const handleCopyImage = async () => {
		if (!capturedImage) return;
		try {
			const blob = dataURLtoBlob(capturedImage);
			await navigator.clipboard.write([
				new ClipboardItem({
					[blob.type]: blob
				})
			]);
			setShowCopySuccess(true);
			setTimeout(() => setShowCopySuccess(false), 2500);
		} catch (error) {
			console.error("Lỗi sao chép hình ảnh:", error);
			alert("Thiết bị hoặc trình duyệt không hỗ trợ sao chép trực tiếp. Bạn vui lòng nhấn giữ hình ảnh để Sao chép!");
		}
	};

	const handleDirectCopyImage = async () => {
		const isReceipt = layoutMode === 'receipt';
		const activeId = isReceipt ? 'order-ticket-bill' : 'order-ticket-paper';
		const node = document.getElementById(activeId);
		if (!node) return;

		setIsSavingImage(true);
		let generatedUrl = '';
		try {
			if (!navigator.clipboard || !window.ClipboardItem) {
				throw new Error("Trình duyệt không hỗ trợ Clipboard API hoặc kết nối HTTP không bảo mật");
			}

			// Strategy: If we have a pre-cached blob, use it IMMEDIATELY (synchronous within user gesture).
			// This is critical for iOS Safari which requires clipboard.write() to be synchronous with the click.
			if (cachedBlobRef.current && cachedPngRef.current) {
				generatedUrl = cachedPngRef.current;
				const blob = cachedBlobRef.current;
				await navigator.clipboard.write([
					new ClipboardItem({
						'image/png': blob
					})
				]);
				setShowCopySuccess(true);
				setTimeout(() => setShowCopySuccess(false), 2500);
			} else {
				// Fallback: generate fresh and use Promise-based ClipboardItem (works on Chrome/desktop)
				const blobPromise = (async () => {
					const dataUrl = await generateTicketPng(node, isReceipt);
					generatedUrl = dataUrl;
					cachedPngRef.current = dataUrl;
					const blob = dataURLtoBlob(dataUrl);
					cachedBlobRef.current = blob;
					return blob;
				})();

				await navigator.clipboard.write([
					new ClipboardItem({
						'image/png': blobPromise
					})
				]);
				setShowCopySuccess(true);
				setTimeout(() => setShowCopySuccess(false), 2500);
			}

			// Re-generate in background for next copy (in case content changed)
			setTimeout(() => preGeneratePng(), 500);
		} catch (error: any) {
			console.error("Lỗi sao chép hình ảnh:", error);
			// If cached PNG is available, use it to open the sharing modal directly without any annoying browser alert
			const fallbackUrl = generatedUrl || cachedPngRef.current;
			if (fallbackUrl) {
				setCapturedImage(fallbackUrl);
			} else {
				// On iOS Safari, if even the cached approach fails, try to trigger a direct download fallback
				try {
					const dataUrl = await generateTicketPng(node, isReceipt);
					const link = document.createElement('a');
					link.download = getTicketImageFilename(layoutMode, order);
					link.href = dataUrl;
					link.click();
					setShowCopySuccess(true);
					setTimeout(() => setShowCopySuccess(false), 2500);
				} catch (fallbackError) {
					alert("Không thể tạo hình ảnh phiếu giao hàng: " + formatImageError(error) + "\nGợi ý: thử 'Lưu ảnh' rồi gửi ảnh qua Zalo.");
				}
			}
		} finally {
			setIsSavingImage(false);
		}
	};

	return { handlePrint, handleSaveImage, handleCopyImage, handleDirectCopyImage };
};
