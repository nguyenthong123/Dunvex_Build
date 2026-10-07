import { useEffect, useRef, useCallback } from 'react';
import { printTicket, type TicketPrintPaper } from './printTicket';
import { generateTicketPng, formatImageError, dataURLtoBlob } from './ticketImage';
import { getTicketImageFilename } from './ticketUtils';
import { isNativeApp } from '../../utils/platform';

interface UseTicketActionsParams {
	layoutMode: 'a4' | 'receipt';
	order: any;
	capturedImage: string | null;
	setCapturedImage: (url: string | null) => void;
	setIsSavingImage: (v: boolean) => void;
	setShowCopySuccess: (v: boolean) => void;
	setCopySuccessMessage: (message: string) => void;
	companyInfo?: any;
	products?: any[];
	paperSize?: TicketPrintPaper;
}

import { copyOrShareImage } from '../../utils/imageSharing';

export const useTicketActions = ({
	layoutMode,
	order,
	capturedImage,
	setCapturedImage,
	setIsSavingImage,
	setShowCopySuccess,
	setCopySuccessMessage,
	companyInfo,
	products,
	paperSize,
}: UseTicketActionsParams) => {
	const nativeApp = isNativeApp();
	// Cache the pre-generated PNG so clipboard copy can be near-instant
	const cachedPngRef = useRef<string | null>(null);
	const cachedBlobRef = useRef<Blob | null>(null);
	const pngGenerationPromiseRef = useRef<Promise<string> | null>(null);
	const pngGenerationIdRef = useRef(0);

	const getTicketPng = useCallback((node: HTMLElement, isReceipt: boolean): Promise<string> => {
		if (cachedPngRef.current) return Promise.resolve(cachedPngRef.current);
		if (pngGenerationPromiseRef.current) return pngGenerationPromiseRef.current;

		const generationId = nativeApp ? pngGenerationIdRef.current : 0;
		const generation = generateTicketPng(node, isReceipt).then((dataUrl) => {
			if (!nativeApp || generationId === pngGenerationIdRef.current) {
				cachedPngRef.current = dataUrl;
				cachedBlobRef.current = dataURLtoBlob(dataUrl);
			}
			return dataUrl;
		}).finally(() => {
			if ((!nativeApp || generationId === pngGenerationIdRef.current) && pngGenerationPromiseRef.current === generation) {
				pngGenerationPromiseRef.current = null;
			}
		});
		pngGenerationPromiseRef.current = generation;
		return generation;
	}, [nativeApp]);

	/** Pre-generate ticket PNG in background when component mounts / layout / data changes */
	const preGeneratePng = useCallback(async () => {
		const isReceipt = layoutMode === 'receipt';
		const activeId = isReceipt ? 'order-ticket-bill' : 'order-ticket-paper';
		const node = document.getElementById(activeId);
		if (!node) return;

		try {
			await getTicketPng(node, isReceipt);
		} catch (e) {
			console.warn('Pre-generate ticket PNG failed:', e);
		}
	}, [getTicketPng, layoutMode]);

	// Auto pre-generate after a short delay to let the DOM render fully
	useEffect(() => {
		if (nativeApp) {
			pngGenerationIdRef.current += 1;
			pngGenerationPromiseRef.current = null;
		}
		cachedPngRef.current = null;
		cachedBlobRef.current = null;
		const timer = setTimeout(() => {
			preGeneratePng();
		}, 600);
		return () => clearTimeout(timer);
	}, [layoutMode, order, companyInfo, products, preGeneratePng, nativeApp]);

	const handlePrint = async () => {
		await printTicket(layoutMode, order, cachedPngRef.current, paperSize);
	};

	const handleSaveImage = async () => {
		const isReceipt = layoutMode === 'receipt';
		const activeId = isReceipt ? 'order-ticket-bill' : 'order-ticket-paper';
		const node = document.getElementById(activeId);
		if (!node) return;

		setIsSavingImage(true);
		try {
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
			alert("Không thể tạo hình ảnh phiếu giao hàng: " + formatImageError(error));
		} finally {
			setIsSavingImage(false);
		}
	};

	const handleCopyImage = async () => {
		if (!capturedImage) return;
		try {
			const result = await copyOrShareImage({
				dataUrl: capturedImage,
				fileName: getTicketImageFilename(layoutMode, order),
				title: 'Phiếu giao hàng Dunvex',
				text: `Phiếu giao hàng đơn ${order?.order_code || ''}`,
			});
			setCopySuccessMessage(result.message);
			setShowCopySuccess(true);
			setTimeout(() => setShowCopySuccess(false), 2500);
		} catch (error) {
			console.error("Lỗi sao chép hình ảnh:", error);
		}
	};

	const handleDirectCopyImage = async () => {
		const isReceipt = layoutMode === 'receipt';
		const activeId = isReceipt ? 'order-ticket-bill' : 'order-ticket-paper';
		const node = document.getElementById(activeId);
		if (!node) return;

		setIsSavingImage(true);
		try {
			const generationId = pngGenerationIdRef.current;
			const dataUrlPromise = getTicketPng(node, isReceipt).then((dataUrl) => {
				if (nativeApp && generationId !== pngGenerationIdRef.current) {
					throw new Error('Nội dung phiếu vừa thay đổi. Vui lòng bấm sao chép lại.');
				}
				return dataUrl;
			});
			const result = await copyOrShareImage({
				dataUrl: dataUrlPromise,
				fileName: getTicketImageFilename(layoutMode, order),
				title: 'Phiếu giao hàng Dunvex',
				text: `Phiếu giao hàng đơn ${order?.order_code || ''}`,
			});

			setCopySuccessMessage(result.message);
			setShowCopySuccess(true);
			setTimeout(() => setShowCopySuccess(false), 2500);
			setTimeout(() => preGeneratePng(), 400);
		} catch (error: any) {
			console.error("Lỗi sao chép hình ảnh:", error);
			window.alert(error?.message || 'Không thể sao chép ảnh vào bộ nhớ tạm.');
		} finally {
			setIsSavingImage(false);
		}
	};

	return { handlePrint, handleSaveImage, handleCopyImage, handleDirectCopyImage };
};
