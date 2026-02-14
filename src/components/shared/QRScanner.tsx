import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScannerState } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

interface QRScannerProps {
	onScan: (decodedText: string) => void;
	onClose: () => void;
	title?: string;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, title = "Quét mã QR Sản phẩm" }) => {
	const scannerRef = useRef<Html5QrcodeScanner | null>(null);

	useEffect(() => {
		// Initialize scanner
		scannerRef.current = new Html5QrcodeScanner(
			"qr-reader",
			{
				fps: 10,
				qrbox: { width: 250, height: 250 },
				aspectRatio: 1.0
			},
			/* verbose= */ false
		);

		scannerRef.current.render(
			(decodedText) => {
				// Success callback
				onScan(decodedText);
				// Stop scanner and close
				if (scannerRef.current) {
					scannerRef.current.clear().then(() => {
						onClose();
					}).catch(err => {
						console.error("Failed to clear scanner", err);
						onClose();
					});
				}
			},
			(errorMessage) => {
				// Error callback (usually frame errors, too verbose to log)
			}
		);

		return () => {
			if (scannerRef.current) {
				const state = scannerRef.current.getState();
				if (state !== Html5QrcodeScannerState.NOT_STARTED && state !== Html5QrcodeScannerState.UNKNOWN) {
					scannerRef.current.clear().catch(err => console.error("Cleanup error", err));
				}
			}
		};
	}, [onScan, onClose]);

	return (
		<div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
			<div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 dark:border-slate-800 animate-in zoom-in-95 duration-300">
				{/* Header */}
				<div className="px-8 py-6 bg-[#1A237E] dark:bg-slate-900 border-b border-white/10 flex items-center justify-between text-white">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-white/10 rounded-xl">
							<Camera size={24} />
						</div>
						<div>
							<h3 className="text-xl font-black uppercase tracking-tight">{title}</h3>
							<p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Quét mã SKU để chọn nhanh</p>
						</div>
					</div>
					<button
						onClick={() => {
							if (scannerRef.current) {
								scannerRef.current.clear().then(onClose).catch(onClose);
							} else {
								onClose();
							}
						}}
						className="size-10 rounded-full bg-white/10 hover:bg-rose-500 flex items-center justify-center transition-all group"
					>
						<X size={20} className="group-hover:rotate-90 transition-transform" />
					</button>
				</div>

				{/* Body */}
				<div className="p-6 flex flex-col items-center">
					<div id="qr-reader" className="w-full overflow-hidden rounded-2xl border-4 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"></div>
					<div className="mt-6 text-center">
						<p className="text-sm font-bold text-slate-500 dark:text-slate-400">
							Di chuyển camera đến vùng chứa mã QR của sản phẩm
						</p>
						<p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-2 px-4 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full inline-block">
							Hệ thống sẽ tự nhận diện theo SKU
						</p>
					</div>
				</div>

				{/* Footer */}
				<div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 flex justify-center">
					<button
						onClick={onClose}
						className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest"
					>
						Đóng lại
					</button>
				</div>
			</div>

			<style dangerouslySetInnerHTML={{
				__html: `
				#qr-reader {
					border: none !important;
				}
				#qr-reader img {
					display: none !important;
				}
				#qr-reader__dashboard {
					padding: 20px !important;
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 15px;
				}
				#qr-reader__status_span {
					font-size: 10px !important;
					font-weight: 800 !important;
					text-transform: uppercase !important;
					color: #64748b !important;
				}
				#qr-reader__camera_selection {
					padding: 8px 12px !important;
					border-radius: 12px !important;
					border: 1px solid #e2e8f0 !important;
					font-size: 12px !important;
					font-weight: 600 !important;
					color: #1e293b !important;
					background: white !important;
					width: 100% !important;
					max-width: 250px !important;
				}
				#qr-reader__dashboard_section_csr button {
					padding: 10px 20px !important;
					border-radius: 12px !important;
					border: none !important;
					background: #1A237E !important;
					color: white !important;
					font-size: 12px !important;
					font-weight: 800 !important;
					text-transform: uppercase !important;
					letter-spacing: 1px !important;
					cursor: pointer !important;
					transition: all 0.2s !important;
				}
				#qr-reader__dashboard_section_csr button:hover {
					opacity: 0.9 !important;
					transform: scale(1.05) !important;
				}
				div#qr-reader__scan_region video {
					border-radius: 16px !important;
					object-fit: cover !important;
				}
			`}} />
		</div>
	);
};

export default QRScanner;
