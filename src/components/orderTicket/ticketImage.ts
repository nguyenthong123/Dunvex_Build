import html2canvas from 'html2canvas-pro';
import { getRemoteOrigin } from '../../utils/validation';

/** Synchronously convert a base64 Data URL to a Blob (bypasses iOS Safari fetch restrictions for data: scheme) */
export const dataURLtoBlob = (dataUrl: string): Blob => {
	const parts = dataUrl.split(',');
	const mimeMatch = parts[0].match(/:(.*?);/);
	const mime = mimeMatch ? mimeMatch[1] : 'image/png';
	const bstr = atob(parts[1] || '');
	let n = bstr.length;
	const u8arr = new Uint8Array(n);
	while (n--) {
		u8arr[n] = bstr.charCodeAt(n);
	}
	return new Blob([u8arr], { type: mime });
};

import { offlineImageCache } from '../../services/offlineImageCache';

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
	const reader = new FileReader();
	reader.onload = () => resolve(reader.result as string);
	reader.onerror = () => reject(reader.error || new Error('Không đọc được dữ liệu ảnh.'));
	reader.readAsDataURL(blob);
});

/** Convert any image URL to a clean Base64 Data URL (checks offline local cache first, falls back to server if online) */
export const fetchImageBase64FromServer = async (url: string): Promise<string> => {
	if (!url) return '';
	if (url.startsWith('data:')) return url;

	const isLocalUrl = url.startsWith('blob:') ||
		url.startsWith('file:') ||
		url.startsWith('capacitor:') ||
		url.startsWith('/') ||
		url.includes('127.0.0.1') ||
		url.includes('localhost');
	if (isLocalUrl) {
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return await blobToDataUrl(await response.blob());
		} catch (error) {
			console.warn('Failed to read local image for ticket export:', url, error);
		}
	}

	// 1. Try local offline cache first (0ms, 100% offline-ready)
	try {
		const cachedDataUrl = await offlineImageCache.getDataUrl(url);
		if (cachedDataUrl && cachedDataUrl.startsWith('data:image')) {
			return cachedDataUrl;
		}
	} catch (e) {
		// fallback to network
	}

	// 2. If online and not cached, request from server proxy
	if (typeof navigator !== 'undefined' && navigator.onLine) {
		try {
			const base = getRemoteOrigin();
			const apiUrl = `${base}/api/image-base64?url=${encodeURIComponent(url)}`;
			const res = await fetch(apiUrl);
			if (res.ok) {
				const data = await res.json();
				if (data.dataUrl && data.dataUrl.startsWith('data:image')) {
					return data.dataUrl;
				}
			}
		} catch (e) {
			console.warn('Failed to fetch image base64 from server:', url, e);
		}
	}
	return url;
};

export const copyComputedStyles = (sourceRoot: HTMLElement, targetRoot: HTMLElement): void => {
	const sourceElements = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll<HTMLElement>('*'))];
	const targetElements = [targetRoot, ...Array.from(targetRoot.querySelectorAll<HTMLElement>('*'))];

	sourceElements.forEach((source, index) => {
		const target = targetElements[index];
		if (!target || source.tagName !== target.tagName) return;

		const computed = getComputedStyle(source);
		for (let propertyIndex = 0; propertyIndex < computed.length; propertyIndex += 1) {
			const property = computed.item(propertyIndex);
			const value = computed.getPropertyValue(property);
			if (value) target.style.setProperty(property, value, computed.getPropertyPriority(property));
		}
	});
};

const hasNativeDesktopClipboardBridge = (): boolean => {
	if (typeof window === 'undefined') return false;
	const nativeWindow = window as any;
	return nativeWindow.webkit?.messageHandlers?.fileBridge !== undefined ||
		nativeWindow.chrome?.webview !== undefined;
};

/**
 * Render node thành PNG data URL qua html2canvas.
 * Chờ fonts hoàn chỉnh để tránh icon font render thành text code (như 'payments', 'print', 'content_copy').
 * Chuyển trước tất cả ảnh sang Base64 để chống lỗi CORS.
 */
export const generateTicketPng = async (
	originalNode: HTMLElement,
	isReceipt: boolean = true,
	customWidth?: number
): Promise<string> => {
	const targetWidth = customWidth || (isReceipt ? 420 : 1000);

	// 0. Ensure fonts are fully ready before rendering to canvas (critical for icon ligatures)
	if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
		try {
			await document.fonts.ready;
		} catch (e) {
			console.warn('Font loading check skipped:', e);
		}
	}

	// 1. Clone node to avoid modifying live DOM
	const clonedNode = originalNode.cloneNode(true) as HTMLElement;
	const isNativeDesktop = hasNativeDesktopClipboardBridge();
	if (isNativeDesktop) {
		copyComputedStyles(originalNode, clonedNode);
	}

	// 2. Offscreen container
	const container = document.createElement('div');
	container.style.position = 'fixed';
	container.style.left = '-9999px';
	container.style.top = '0';
	container.style.width = `${targetWidth}px`;
	container.style.zIndex = '-9999';
	container.appendChild(clonedNode);
	document.body.appendChild(container);

	try {
		// 3. Pre-convert all images to base64 Data URLs so html2canvas can read them without CORS issues
		const images = Array.from(clonedNode.querySelectorAll('img'));
		await Promise.all(
			images.map(async (img) => {
				const src = img.currentSrc || img.getAttribute('src');
				if (!src) return;
				img.loading = 'eager';
				img.crossOrigin = 'anonymous';
				if (!src.startsWith('data:')) {
					const b64 = await fetchImageBase64FromServer(src);
					if (b64 && b64.startsWith('data:image')) {
						img.src = b64;
					}
				}

				// Wait for decoding as well as network completion before rendering the canvas.
				try {
					await img.decode();
				} catch (e) {
					if (isNativeDesktop) {
						throw new Error(`Không thể tải ảnh trong phiếu để sao chép: ${src}`);
					}
					console.warn('Image load/decode failed:', src, e);
				}
			})
		);

		// 4. Render to canvas via html2canvas (pixel-based, no SVG foreignObject)
		const canvas = await html2canvas(clonedNode, {
			backgroundColor: '#ffffff',
			width: targetWidth,
			scale: 2, // Retina quality
			useCORS: true,
			allowTaint: false,
			logging: false,
		});

		return canvas.toDataURL('image/png');
	} finally {
		// 5. Clean up
		if (document.body.contains(container)) {
			document.body.removeChild(container);
		}
	}
};

/** Copy a PNG blob directly into system clipboard with robust support */
export const copyImageBlobToClipboard = async (blob: Blob): Promise<void> => {
	if (!navigator.clipboard || !window.ClipboardItem) {
		throw new Error("Trình duyệt không hỗ trợ Clipboard API hoặc kết nối không bảo mật");
	}
	await navigator.clipboard.write([
		new ClipboardItem({
			'image/png': blob
		})
	]);
};

/** Chuẩn hoá lỗi export ảnh thành chuỗi hiển thị cho người dùng. */
export const formatImageError = (error: any): string => {
	if (error && error instanceof Event) {
		let msg = `Image load error (${(error as any).type})`;
		try { msg += ` - ${((error as any).target && (error as any).target.src) || ''}`; } catch (e) {}
		return msg;
	}
	return error && (error.message || error.name) ? (error.message || error.name) : String(error);
};
