import React, { useState, useEffect, useCallback } from 'react';

export interface LightboxImage {
    url: string;
    title?: string;
}

export interface ImageLightboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: LightboxImage[] | string[];
    initialIndex?: number;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
    isOpen,
    onClose,
    images,
    initialIndex = 0,
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [rotation, setRotation] = useState(0);

    // Normalize images to LightboxImage[]
    const normalizedImages: LightboxImage[] = (images || []).map((img) =>
        typeof img === 'string' ? { url: img } : img
    );

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            setZoomLevel(1);
            setRotation(0);
        }
    }, [isOpen, initialIndex]);

    const handleNext = useCallback(() => {
        if (normalizedImages.length <= 1) return;
        setCurrentIndex((prev) => (prev + 1) % normalizedImages.length);
        setZoomLevel(1);
        setRotation(0);
    }, [normalizedImages.length]);

    const handlePrev = useCallback(() => {
        if (normalizedImages.length <= 1) return;
        setCurrentIndex((prev) => (prev - 1 + normalizedImages.length) % normalizedImages.length);
        setZoomLevel(1);
        setRotation(0);
    }, [normalizedImages.length]);

    const handleZoomIn = () => {
        setZoomLevel((prev) => Math.min(prev + 0.5, 3.5));
    };

    const handleZoomOut = () => {
        setZoomLevel((prev) => Math.max(prev - 0.5, 0.5));
    };

    const handleResetZoom = () => {
        setZoomLevel(1);
        setRotation(0);
    };

    const handleRotate = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowRight') {
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleNext, handlePrev, onClose]);

    if (!isOpen || normalizedImages.length === 0) return null;

    const currentImage = normalizedImages[currentIndex] || normalizedImages[0];

    return (
        <div 
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col select-none animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
        >
            {/* Header controls */}
            <div 
                className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/10 z-10"
                style={{
                    paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))'
                }}
            >
                {/* Title & Counter */}
                <div className="flex items-center gap-3 min-w-0 pr-2">
                    <span className="text-white/90 text-sm font-black uppercase tracking-wider truncate">
                        {currentImage.title || `Hình ảnh (${currentIndex + 1}/${normalizedImages.length})`}
                    </span>
                    {normalizedImages.length > 1 && (
                        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-white/15 text-white text-[11px] font-bold">
                            {currentIndex + 1} / {normalizedImages.length}
                        </span>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {/* Zoom In */}
                    <button
                        type="button"
                        onClick={handleZoomIn}
                        title="Phóng to"
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-lg">zoom_in</span>
                    </button>

                    {/* Zoom Out */}
                    <button
                        type="button"
                        onClick={handleZoomOut}
                        title="Thu nhỏ"
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-lg">zoom_out</span>
                    </button>

                    {/* Rotate */}
                    <button
                        type="button"
                        onClick={handleRotate}
                        title="Xoay hình"
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-lg">rotate_right</span>
                    </button>

                    {/* Reset Zoom if changed */}
                    {(zoomLevel !== 1 || rotation !== 0) && (
                        <button
                            type="button"
                            onClick={handleResetZoom}
                            title="Đặt lại kích thước"
                            className="px-2.5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-sm">restart_alt</span>
                            <span className="hidden sm:inline">1x</span>
                        </button>
                    )}

                    {/* Open in new tab (original link) */}
                    <a
                        href={currentImage.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Mở ảnh gốc trong tab mới"
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-lg">open_in_new</span>
                    </a>

                    {/* Close Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        title="Đóng (Esc)"
                        className="p-2 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white transition-all active:scale-95 flex items-center justify-center ml-1"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>
            </div>

            {/* Main Image Stage */}
            <div 
                className="flex-1 relative flex items-center justify-center overflow-hidden p-2 sm:p-6"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        onClose();
                    }
                }}
            >
                {/* Left navigation arrow */}
                {normalizedImages.length > 1 && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handlePrev();
                        }}
                        title="Ảnh trước (Mũi tên trái)"
                        className="absolute left-2 sm:left-4 z-20 size-11 sm:size-12 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center transition-all active:scale-95 shadow-xl"
                    >
                        <span className="material-symbols-outlined text-2xl sm:text-3xl">chevron_left</span>
                    </button>
                )}

                {/* The Image */}
                <div 
                    className="max-w-full max-h-full flex items-center justify-center overflow-auto transition-transform duration-200"
                    style={{
                        transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                        transformOrigin: 'center center',
                    }}
                >
                    <img
                        src={currentImage.url}
                        alt={currentImage.title || 'Phóng to ảnh'}
                        className="max-h-[82vh] max-w-[92vw] object-contain rounded-lg shadow-2xl pointer-events-auto"
                        onClick={(e) => {
                            e.stopPropagation();
                            // Toggle zoom between 1x and 2x on click
                            setZoomLevel((prev) => (prev === 1 ? 2 : 1));
                        }}
                        style={{ cursor: zoomLevel === 1 ? 'zoom-in' : 'zoom-out' }}
                    />
                </div>

                {/* Right navigation arrow */}
                {normalizedImages.length > 1 && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleNext();
                        }}
                        title="Ảnh tiếp theo (Mũi tên phải)"
                        className="absolute right-2 sm:right-4 z-20 size-11 sm:size-12 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center transition-all active:scale-95 shadow-xl"
                    >
                        <span className="material-symbols-outlined text-2xl sm:text-3xl">chevron_right</span>
                    </button>
                )}
            </div>

            {/* Bottom thumbnail strip if multiple */}
            {normalizedImages.length > 1 && (
                <div 
                    className="flex-none flex items-center justify-center gap-2 py-3 px-4 bg-black/50 border-t border-white/10 overflow-x-auto custom-scrollbar"
                    style={{
                        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))'
                    }}
                >
                    {normalizedImages.map((item, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => {
                                setCurrentIndex(idx);
                                setZoomLevel(1);
                                setRotation(0);
                            }}
                            className={`size-14 sm:size-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                                idx === currentIndex
                                    ? 'border-indigo-500 scale-105 shadow-lg'
                                    : 'border-white/20 opacity-60 hover:opacity-100'
                            }`}
                        >
                            <img
                                src={item.url}
                                alt={`Thumb ${idx + 1}`}
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
