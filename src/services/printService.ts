import { localDb } from './localDb';
import type { OrderEntity, OrderItemEntity, CustomerEntity } from './localDb/types';

export type PaperSize = 'k80' | 'k57' | 'a4' | 'a5';

export interface ShopInfo {
  name: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  note?: string;
}

export interface PrintOptions {
  paperSize?: PaperSize;
  silent?: boolean;
  shopInfo?: ShopInfo;
  copies?: number;
}

class PrintService {
  private isTauriApp(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  }

  /**
   * Universal print method that works across Android Native, macOS App, and Web browsers
   */
  public printHtml(html: string, options: { isReceipt?: boolean; title?: string; paperSize?: PaperSize } = {}): void {
    const isReceipt = !!options.isReceipt;
    const paperSize = options.paperSize || (isReceipt ? 'k80' : 'a4');

    // 1. Android Native App Bridge
    if (typeof window !== 'undefined' && (window as any).AndroidPrint?.printHtml) {
      try {
        (window as any).AndroidPrint.printHtml(
          html,
          options.title || (isReceipt ? 'HoaDon_Dunvex' : 'ChungTu_Dunvex'),
          paperSize
        );
        return;
      } catch (e) {
        console.warn('[PrintService] Android native printHtml failed, falling back to iframe/window:', e);
      }
    } else if (typeof window !== 'undefined' && (window as any).AndroidPrint?.print) {
      try {
        (window as any).AndroidPrint.print();
        return;
      } catch (e) {
        console.warn('[PrintService] Android native print failed, falling back to iframe/window:', e);
      }
    }

    // 2. macOS Native App Bridge
    if (typeof window !== 'undefined' && (window as any).webkit?.messageHandlers?.printHandler) {
      try {
        (window as any).webkit.messageHandlers.printHandler.postMessage({
          html,
          isReceipt,
          paperSize,
        });
        return;
      } catch (e) {
        console.warn('[PrintService] macOS native print failed, falling back to iframe:', e);
      }
    }

    // 3. Web & Mobile Browser (Invisible Iframe + print fallback)
    const iframeId = 'dunvex_universal_print_frame';
    let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }

    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.position = 'fixed';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn('[PrintService] Iframe print failed, falling back to window.print()', e);
        window.print();
      }
    };

    // Execute print on iframe load or immediately with timeout
    if (iframe.contentWindow) {
      setTimeout(triggerPrint, 350);
    } else {
      iframe.onload = () => setTimeout(triggerPrint, 350);
    }
  }

  /**
   * Print an order directly using specified paper format and optional silent mode
   */
  async printOrder(
    order: OrderEntity,
    customer?: CustomerEntity | null,
    options: PrintOptions = {}
  ): Promise<boolean> {
    const paperSize = options.paperSize || 'k80';
    const shopInfo: ShopInfo = options.shopInfo || {
      name: 'DUNVEX BUILD',
      phone: '0901.234.567',
      address: 'Hệ thống Quản lý Bán hàng & Sản xuất',
      note: 'Cảm ơn quý khách và hẹn gặp lại!',
    };

    const html = this.generateInvoiceHtml(order, customer, shopInfo, paperSize);

    // 1. Native Tauri Silent Print (if in Desktop app)
    if (this.isTauriApp() && options.silent) {
      try {
        const tauri = (window as any).__TAURI__;
        if (tauri?.core?.invoke) {
          await tauri.core.invoke('silent_print', {
            htmlContent: html,
            paperSize,
          });
          await this.markOrderPrinted(order.id);
          return true;
        }
      } catch (tauriErr) {
        console.warn('[PrintService] Tauri silent print fallback to browser print:', tauriErr);
      }
    }

    this.printHtml(html, { isReceipt: paperSize === 'k80' || paperSize === 'k57', title: `Hóa đơn ${order.order_code}` });
    await this.markOrderPrinted(order.id);
    return true;
  }

  private async markOrderPrinted(orderId: string) {
    try {
      const existing = await localDb.getOrderWithItems(orderId);
      if (existing) {
        existing.is_printed = 1;
        existing.updated_at = Date.now();
        existing.sync_status = 0; // mark for next push
        await localDb.createOrder(existing, existing.items || []);
      }
    } catch (err) {
      console.warn('[PrintService] Error marking order as printed:', err);
    }
  }

  /**
   * Generate highly optimized HTML for thermal receipt / standard paper
   */
  public generateInvoiceHtml(
    order: OrderEntity,
    customer?: CustomerEntity | null,
    shopInfo?: ShopInfo,
    paperSize: PaperSize = 'k80'
  ): string {
    const isThermal = paperSize === 'k80' || paperSize === 'k57';
    const width = paperSize === 'k57' ? '57mm' : paperSize === 'k80' ? '80mm' : paperSize === 'a5' ? '148mm' : '210mm';
    const fontSize = paperSize === 'k57' ? '11px' : paperSize === 'k80' ? '12px' : '14px';

    const items: OrderItemEntity[] = order.items || [];
    const formattedDate = new Date(order.created_at || Date.now()).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Hóa đơn ${order.order_code}</title>
  <style>
    @page {
      size: ${isThermal ? `${width} auto` : paperSize.toUpperCase()};
      margin: ${isThermal ? '0' : '10mm'};
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      width: ${width};
      margin: 0 auto;
      padding: ${isThermal ? '6px 8px' : '20px'};
      font-size: ${fontSize};
      color: #000;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .divider-solid { border-top: 1px solid #000; margin: 8px 0; }
    .header-title { font-size: 1.25em; font-weight: bold; text-transform: uppercase; }
    .order-code { font-size: 1.1em; font-weight: bold; margin: 4px 0; }
    
    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    th { border-bottom: 1px solid #000; padding: 4px 2px; font-size: 0.95em; }
    td { padding: 4px 2px; vertical-align: top; }
    
    .total-row { font-size: 1.1em; font-weight: bold; }
    .footer { text-align: center; margin-top: 12px; font-size: 0.9em; }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="text-center">
    <div class="header-title">${shopInfo?.name || 'CỬA HÀNG DUNVEX'}</div>
    ${shopInfo?.address ? `<div>${shopInfo.address}</div>` : ''}
    ${shopInfo?.phone ? `<div>Hotline: ${shopInfo.phone}</div>` : ''}
    <div class="divider-solid"></div>
    <div class="order-code">PHIẾU BÁN HÀNG</div>
    <div>Số phiếu: <strong>${order.order_code}</strong></div>
    <div>Ngày: ${formattedDate}</div>
  </div>

  <div class="divider"></div>

  <!-- Customer Info -->
  <div>
    <div>Khách hàng: <strong>${customer?.name || order.customer_name || 'Khách lẻ'}</strong></div>
    ${customer?.phone ? `<div>Điện thoại: ${customer.phone}</div>` : ''}
    ${customer?.address ? `<div>Địa chỉ: ${customer.address}</div>` : ''}
    ${order.note ? `<div>Ghi chú: ${order.note}</div>` : ''}
  </div>

  <div class="divider"></div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th align="left" style="width: 45%;">Tên hàng</th>
        <th align="center" style="width: 15%;">SL</th>
        <th align="right" style="width: 20%;">Đ.Giá</th>
        <th align="right" style="width: 20%;">T.Tiền</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item, idx) => `
        <tr>
          <td>${item.product_name || `Sản phẩm ${idx + 1}`}</td>
          <td align="center">${item.quantity} ${item.unit || ''}</td>
          <td align="right">${(item.unit_price || 0).toLocaleString('vi-VN')}</td>
          <td align="right" class="font-bold">${(item.amount || item.quantity * item.unit_price).toLocaleString('vi-VN')}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="divider-solid"></div>

  <!-- Total Summary -->
  <table>
    <tr class="total-row">
      <td>TỔNG THANH TOÁN:</td>
      <td align="right">${(order.total_amount || 0).toLocaleString('vi-VN')} đ</td>
    </tr>
  </table>

  <div class="divider"></div>

  <!-- Footer -->
  <div class="footer">
    <div>${shopInfo?.note || 'Cảm ơn Quý khách & Hẹn gặp lại!'}</div>
    <div style="margin-top: 6px; font-size: 0.8em; color: #555;">In từ hệ thống Dunvex Build Offline-First</div>
  </div>
</body>
</html>
    `.trim();
  }
}

export const printService = new PrintService();
