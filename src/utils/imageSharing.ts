import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { localFileService } from '../services/localFileService';
import { dataURLtoBlob } from '../components/orderTicket/ticketImage';

export interface CopyOrShareOptions {
  dataUrl: string | Promise<string>;
  fileName?: string;
  title?: string;
  text?: string;
  dialogTitle?: string;
}

export interface CopyOrShareResult {
  success: boolean;
  mode: 'desktop_native' | 'mobile_share' | 'web_clipboard' | 'download_fallback';
  message: string;
}

/**
 * Universal cross-platform helper to copy or share any ticket/debt/order image.
 * 
 * Target behavior:
 * 1. macOS & Windows Native Apps: Copies directly to system clipboard via native bridge (0ms, no permission modal).
 * 2. Android & iOS Native App: Saves to local cache and opens Native Share Sheet (Zalo, Messenger, etc.) in 1 tap.
 * 3. Modern Web Browsers: Writes to navigator.clipboard.write([ClipboardItem]).
 * 4. Fallback: Directly triggers browser download of the image without annoying popup modals.
 */
export async function copyOrShareImage({
  dataUrl,
  fileName = 'phieu_dunvex.png',
  title = 'Phiếu giao hàng Dunvex',
  text = 'Phiếu giao hàng từ Dunvex Build',
  dialogTitle = 'Chia sẻ qua Zalo, Messenger...',
}: CopyOrShareOptions): Promise<CopyOrShareResult> {
  if (!dataUrl) {
    throw new Error('Dữ liệu hình ảnh trống.');
  }
  const dataUrlPromise = Promise.resolve(dataUrl);

  // 1. Native Desktop App (macOS NSPasteboard / Windows Clipboard)
  const isDesktopNative =
    typeof window !== 'undefined' &&
    (((window as any).webkit?.messageHandlers?.fileBridge !== undefined) ||
     ((window as any).chrome?.webview !== undefined));

  if (isDesktopNative) {
    const copied = await localFileService.copyImageToClipboard(await dataUrlPromise);
    if (!copied) {
      throw new Error('Windows không xác nhận được thao tác sao chép ảnh vào bộ nhớ tạm.');
    }
    return {
      success: true,
      mode: 'desktop_native',
      message: 'Đã sao chép ảnh vào bộ nhớ tạm! Bạn có thể dán vào Zalo / Messenger bằng phím Cmd+V hoặc Ctrl+V.',
    };
  }

  // 2. Android Native WebView Bridge (AndroidClipboard)
  if (typeof window !== 'undefined' && (window as any).AndroidClipboard?.copyImageBase64) {
    try {
      const resolvedDataUrl = await dataUrlPromise;
      const cleanBase64 = resolvedDataUrl.includes(',') ? resolvedDataUrl.split(',')[1] : resolvedDataUrl;
      const safeFileName = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
      const success = (window as any).AndroidClipboard.copyImageBase64(cleanBase64, safeFileName);
      if (success) {
        return {
          success: true,
          mode: 'mobile_share',
          message: 'Đã lưu ảnh vào bộ nhớ tạm & Thư viện ảnh! Bạn có thể dán (Paste) hoặc chọn ảnh trong Zalo.',
        };
      }
    } catch (androidErr) {
      console.warn('[imageSharing] AndroidClipboard native bridge failed:', androidErr);
    }
  }

  // 3. Mobile Native App (Android / iOS via Capacitor Share)
  if (Capacitor.isNativePlatform()) {
    try {
      // Clean base64 string
      const resolvedDataUrl = await dataUrlPromise;
      const cleanBase64 = resolvedDataUrl.includes(',') ? resolvedDataUrl.split(',')[1] : resolvedDataUrl;
      const safeFileName = fileName.endsWith('.png') ? fileName : `${fileName}.png`;

      // Write image to Cache directory
      const writeResult = await Filesystem.writeFile({
        path: `dunvex_share/${safeFileName}`,
        data: cleanBase64,
        directory: Directory.Cache,
        recursive: true,
      });

      // Launch Native Share Sheet
      await Share.share({
        title,
        text,
        url: writeResult.uri,
        dialogTitle,
      });

      return {
        success: true,
        mode: 'mobile_share',
        message: 'Đã mở bảng chia sẻ để gửi qua Zalo / Messenger!',
      };
    } catch (mobileErr: any) {
      // User might have dismissed the share sheet, which is not a critical failure
      if (mobileErr?.message?.includes('canceled') || mobileErr?.message?.includes('dismissed')) {
        return {
          success: true,
          mode: 'mobile_share',
          message: 'Đã hoàn tất chia sẻ.',
        };
      }
      console.warn('[imageSharing] Native Mobile share failed, falling back:', mobileErr);
    }
  }

  // 3. Web Share API on Mobile Browsers (if supported)
  const isMobileBrowser = typeof navigator !== 'undefined' &&
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
  if (isMobileBrowser && navigator.share && navigator.canShare) {
    try {
      const resolvedDataUrl = await dataUrlPromise;
      const blob = dataURLtoBlob(resolvedDataUrl);
      const safeFileName = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
      const file = new File([blob], safeFileName, { type: 'image/png' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text,
          files: [file],
        });
        return {
          success: true,
          mode: 'mobile_share',
          message: 'Đã mở bảng chia sẻ!',
        };
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        return { success: true, mode: 'mobile_share', message: 'Đã hủy chia sẻ.' };
      }
      console.warn('[imageSharing] Web share failed, trying clipboard:', shareErr);
    }
  }

  // 4. Standard Browser Clipboard API (Desktop Web / Chrome / Edge)
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
    try {
      const blobPromise = dataUrlPromise.then(dataURLtoBlob);
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blobPromise,
        }),
      ]);
      return {
        success: true,
        mode: 'web_clipboard',
        message: 'Đã sao chép ảnh vào bộ nhớ tạm! Bạn có thể dán vào Zalo / Messenger bằng Ctrl+V.',
      };
    } catch (clipErr) {
      console.warn('[imageSharing] Web clipboard.write failed:', clipErr);
    }
  }

  // 5. Graceful Fallback: Direct Download without modal popups
  try {
    const resolvedDataUrl = await dataUrlPromise;
    const link = document.createElement('a');
    link.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`;
    link.href = resolvedDataUrl;
    link.click();
    return {
      success: true,
      mode: 'download_fallback',
      message: 'Đã tải ảnh về thiết bị để gửi qua Zalo / Messenger!',
    };
  } catch (downloadErr) {
    throw new Error('Không thể sao chép hoặc tải ảnh trên thiết bị này.');
  }
}
