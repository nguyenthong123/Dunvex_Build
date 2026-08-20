import html2canvas from 'html2canvas-pro';
import { getRemoteOrigin } from '../../utils/validation';

/** Convert any image URL to a clean Base64 Data URL via backend server endpoint */
export const fetchImageBase64FromServer = async (url: string): Promise<string> => {
	if (!url) return '';
	if (url.startsWith('data:')) return url;
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
	return url;
};

/**
 * Render node thành PNG data URL qua html2canvas.
 * html2canvas vẽ trực tiếp pixel-by-pixel lên Canvas 2D API,
 * KHÔNG dùng SVG foreignObject nên hoạt động 100% ổn định trên iOS Safari.
 */
export const generateTicketPng = async (originalNode: HTMLElement, isReceipt: boolean): Promise<string> => {
	const targetWidth = isReceipt ? 420 : 1000;

	// 1. Clone node to avoid modifying live DOM
	const clonedNode = originalNode.cloneNode(true) as HTMLElement;

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
				const src = img.getAttribute('src');
				if (!src || src.startsWith('data:')) return;

				img.crossOrigin = 'anonymous';
				const b64 = await fetchImageBase64FromServer(src);
				if (b64 && b64.startsWith('data:image')) {
					img.src = b64;
				}

				// Wait for the image to fully load + decode
				try {
					await new Promise<void>((resolve, reject) => {
						if (img.complete && img.naturalWidth > 0) {
							resolve();
							return;
						}
						img.onload = () => resolve();
						img.onerror = () => reject(new Error('img load failed'));
					});
				} catch (e) {
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
			// Use a proxy to handle external images that fail CORS
			proxy: `${getRemoteOrigin()}/api/image-base64`,
		});

		return canvas.toDataURL('image/png');
	} finally {
		// 5. Clean up
		if (document.body.contains(container)) {
			document.body.removeChild(container);
		}
	}
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
