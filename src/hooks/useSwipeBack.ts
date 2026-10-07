import { useEffect } from 'react';

/**
 * useSwipeBack: Hỗ trợ cử chỉ vuốt 2 ngón tay trên Trackpad Mac (hoặc vuốt chạm mép màn hình),
 * phím tắt điều hướng bàn phím (Cmd + [ / Cmd + Left) và nút Back trên chuột máy tính.
 */
export function useSwipeBack() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let accumulatedDeltaX = 0;
    let lastWheelTime = 0;
    let resetTimer: any = null;
    let lastNavigateTime = 0;

    // Helper: Kiểm tra xem con trỏ chuột có đang nằm trong phần tử có thể cuộn ngang hay không
    const canScrollHorizontally = (target: EventTarget | null, isGoingBack: boolean): boolean => {
      let el = target instanceof HTMLElement ? target : null;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const overflowX = style.overflowX;
        if (/(auto|scroll)/.test(overflowX)) {
          // Vuốt sang phải (Back) -> chỉ chặn nếu vùng cuộn chưa chạm mép trái
          if (isGoingBack && el.scrollLeft > 2) return true;
          // Vuốt sang trái (Forward) -> chỉ chặn nếu vùng cuộn chưa chạm mép phải
          if (!isGoingBack && el.scrollLeft < (el.scrollWidth - el.clientWidth - 2)) return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    // 1. Cử chỉ vuốt 2 ngón trên Trackpad (Mac / Windows Precision Touchpad)
    const handleWheel = (e: WheelEvent) => {
      // Chỉ xử lý khi chuyển động chủ yếu là nằm ngang
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      if (absX < 8 || absX < absY * 1.1) {
        return;
      }

      const isGoingBack = e.deltaX < 0; // Vuốt 2 ngón từ trái sang phải để Back
      if (canScrollHorizontally(e.target, isGoingBack)) {
        accumulatedDeltaX = 0;
        return;
      }

      const now = performance.now();
      if (now - lastWheelTime > 300) {
        accumulatedDeltaX = 0;
      }
      lastWheelTime = now;

      accumulatedDeltaX += e.deltaX;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        accumulatedDeltaX = 0;
      }, 250);

      // Ngưỡng kích hoạt vuốt mượt mà (50px)
      const THRESHOLD = 50;
      const cooldownPassed = Date.now() - lastNavigateTime > 550;

      if (cooldownPassed) {
        if (accumulatedDeltaX <= -THRESHOLD) {
          accumulatedDeltaX = 0;
          lastNavigateTime = Date.now();
          window.history.back();
        } else if (accumulatedDeltaX >= THRESHOLD) {
          accumulatedDeltaX = 0;
          lastNavigateTime = Date.now();
          window.history.forward();
        }
      }
    };

    // 2. Nút Back / Forward trên chuột (Mouse 4 & 5)
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) { // Mouse Back
        e.preventDefault();
        window.history.back();
      } else if (e.button === 4) { // Mouse Forward
        e.preventDefault();
        window.history.forward();
      }
    };

    // 3. Phím tắt bàn phím chuẩn macOS & Windows
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLElement && 
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
      
      if (isInput) return;

      // macOS: Cmd + [ hoặc Cmd + ArrowLeft | Windows: Alt + ArrowLeft
      if ((e.metaKey && e.key === '[') || ((e.metaKey || e.altKey) && e.key === 'ArrowLeft')) {
        e.preventDefault();
        window.history.back();
      } else if ((e.metaKey && e.key === ']') || ((e.metaKey || e.altKey) && e.key === 'ArrowRight')) {
        e.preventDefault();
        window.history.forward();
      }
    };

    // 4. Vuốt chạm trên màn hình cảm ứng / Tablet
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);
        const elapsed = Date.now() - touchStartTime;

        // Vuốt từ mép trái sang phải (startX < 40px)
        if (touchStartX < 40 && deltaX > 70 && deltaY < 50 && elapsed < 400) {
          window.history.back();
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true, capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true } as any);
      window.removeEventListener('mouseup', handleMouseUp, { capture: true } as any);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      clearTimeout(resetTimer);
    };
  }, []);
}
