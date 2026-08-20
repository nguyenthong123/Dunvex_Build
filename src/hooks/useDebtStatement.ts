/**
 * Hook quản lý modal bảng kê chi tiết công nợ (statement)
 * 🔧 REFACTOR: Extract from Debts.tsx (statement modal state, query, print)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, getDoc, doc } from '../services/firebase';

export interface UseDebtStatementParams {
  ownerId: string;
  fromDate: string;
  toDate: string;
  showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export function useDebtStatement({
  ownerId,
  fromDate,
  toDate,
  showToast,
}: UseDebtStatementParams) {
  const navigate = useNavigate();
  const [showStatement, setShowStatement] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState('');
  const [statementScale, setStatementScale] = useState(1);
  const [statementZoom, setStatementZoom] = useState(1);
  const [statementTx, setStatementTx] = useState<any[]>([]);
  const [loadingStatementTx, setLoadingStatementTx] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', ownerId));
        if (settingsSnap.exists()) {
          setCompanyInfo(settingsSnap.data());
        }
      } catch (err) {
        console.warn('Error fetching settings for printing:', err);
      }
    };
    if (ownerId) {
      fetchSettings();
    }
  }, [ownerId]);

  // ── Resize listener for statement scale ──────────────────
  useEffect(() => {
    const handlePopState = () => { setShowStatement(false); };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (showStatement) {
      const handleResize = () => {
        if (window.innerWidth < 840) {
          setStatementScale((window.innerWidth - 32) / 800);
        } else {
          setStatementScale(1);
        }
      };
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [showStatement]);

  // ── Open statement: fetch orders + payments for customer ─
  const openStatement = async (customer: any) => {
    setSelectedCustomer(customer);
    setStatementFromDate(fromDate || '');
    setStatementToDate(toDate || '');
    setShowStatement(true);
    navigate(window.location.pathname + window.location.search, { state: { modalOpen: true } });
    setStatementTx([]);
    setLoadingStatementTx(true);
    try {
      let oQuery, pQuery;
      if (customer.isGuest) {
        oQuery = query(
          collection(db, 'orders'),
          where('ownerId', '==', ownerId),
          where('customerName', '==', customer.name),
          where('status', '==', 'Đơn chốt'),
        );
        pQuery = query(
          collection(db, 'payments'),
          where('ownerId', '==', ownerId),
          where('customerName', '==', customer.name),
        );
      } else {
        oQuery = query(
          collection(db, 'orders'),
          where('ownerId', '==', ownerId),
          where('customerId', '==', customer.id),
          where('status', '==', 'Đơn chốt'),
        );
        pQuery = query(
          collection(db, 'payments'),
          where('ownerId', '==', ownerId),
          where('customerId', '==', customer.id),
        );
      }
      const [oSnap, pSnap] = await Promise.all([getDocs(oQuery), getDocs(pQuery)]);
      const loadedOrders = oSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        txType: 'order',
      }));
      const loadedPayments = pSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        txType: 'payment',
      }));
      setStatementTx([...loadedOrders, ...loadedPayments]);
    } catch (err) {
      console.error('Error loading statement transactions:', err);
      showToast('Không thể tải chi tiết công nợ', 'error');
    } finally {
      setLoadingStatementTx(false);
    }
  };

  // ── Print statement ──────────────────────────────────────
  const handlePrintStatement = () => {
    if (!selectedCustomer) return;
    const printWindow = window.open('', '_blank', 'width=1200,height=1000');
    if (!printWindow) {
      alert('Vui lòng cho phép trình duyệt mở popup để in!');
      return;
    }

    // Compile active CSS rules directly to prevent black & white styling due to lazy-loaded CSS
    let styles = '';
    try {
      for (const sheet of document.styleSheets) {
        try {
          if (sheet.cssRules) {
            for (const rule of sheet.cssRules) {
              styles += rule.cssText + '\n';
            }
          }
        } catch (e) {
          // Fallback for cross-origin styles
          if (sheet.href) {
            styles += `@import url("${sheet.href}");\n`;
          }
        }
      }
    } catch (err) {
      console.warn('Could not inline all styles directly', err);
    }

    // Also collect current HTML style/link nodes as a fallback
    let fallbackTags = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      fallbackTags += (node as HTMLElement).outerHTML;
    });

    const getNormDate = (tx: any) => {
      if (tx.orderDate && typeof tx.orderDate === 'string') return tx.orderDate;
      if (tx.date && typeof tx.date === 'string') return tx.date;
      let d;
      if (tx.orderDate?.seconds) d = new Date(tx.orderDate.seconds * 1000);
      else if (tx.date?.seconds) d = new Date(tx.date.seconds * 1000);
      else if (tx.createdAt?.seconds) d = new Date(tx.createdAt.seconds * 1000);
      else if (tx.createdAt) d = new Date(tx.createdAt);
      else return '';
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const sortedTx = [...statementTx].sort((a, b) => {
      const da = getNormDate(a);
      const db = getNormDate(b);
      if (da !== db) return da.localeCompare(db);
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });

    let openingBalance = 0;
    if (statementFromDate) {
      const beforeOrders = sortedTx
        .filter((t) => t.txType === 'order' && getNormDate(t) && getNormDate(t) < statementFromDate)
        .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const beforePayments = sortedTx
        .filter((t) => t.txType === 'payment' && getNormDate(t) && getNormDate(t) < statementFromDate)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      openingBalance = beforeOrders - beforePayments;
    }

    const cycleTx = sortedTx.filter((t) => {
      const dateStr = getNormDate(t);
      if ((statementFromDate || statementToDate) && !dateStr) return false;

      if (statementFromDate && dateStr < statementFromDate) return false;
      if (statementToDate && dateStr > statementToDate) return false;
      return true;
    });

    const totalOrders = cycleTx
      .filter((t) => t.txType === 'order')
      .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const totalPayments = cycleTx
      .filter((t) => t.txType === 'payment')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const closingBalance = openingBalance + totalOrders - totalPayments;

    const formatPriceLocal = (val: number) => new Intl.NumberFormat('vi-VN').format(val || 0);
    const formatDateLocal = (dateStr: any) => {
      if (!dateStr) return '';
      const d = new Date(dateStr.seconds ? dateStr.seconds * 1000 : dateStr);
      if (isNaN(d.getTime())) return '';
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    const ordersTx = cycleTx.filter((t) => t.txType === 'order');
    let ordersRows = '';
    ordersTx.forEach((tx, idx) => {
      const txDate = formatDateLocal(tx.orderDate || tx.createdAt);
      const txName = `Mua đơn #${tx.id?.slice(0, 8).toUpperCase()}`;
      const txAmount = `+${formatPriceLocal(tx.totalAmount)}`;
      ordersRows += `
        <div class="py-2.5 space-y-1 border-b border-dashed border-slate-200">
          <div class="flex items-start gap-2.5 font-extrabold text-black uppercase leading-tight text-sm">
            <span class="shrink-0 pt-0.5">${idx + 1}.</span>
            <span class="min-w-0 break-words pt-0.5">${txName}</span>
          </div>
          <div class="flex justify-between items-center text-xs font-bold text-slate-700">
            <span class="whitespace-nowrap">Ngày: ${txDate}</span>
            <span class="text-black text-sm font-black whitespace-nowrap">${txAmount} đ</span>
          </div>
        </div>
      `;
    });
    if (ordersTx.length === 0) {
      ordersRows = `<div class="py-3 text-center text-xs text-slate-400 italic">Không có đơn mua hàng nào</div>`;
    }

    const paymentsTx = cycleTx.filter((t) => t.txType === 'payment');
    let paymentsRows = '';
    paymentsTx.forEach((tx, idx) => {
      const txDate = formatDateLocal(tx.date || tx.createdAt);
      const txName = `Trả nợ [${tx.paymentMethod || 'Chuyển khoản'}]`;
      const txAmount = `-${formatPriceLocal(tx.amount)}`;
      paymentsRows += `
        <div class="py-2.5 space-y-1 border-b border-dashed border-slate-200">
          <div class="flex items-start gap-2.5 font-extrabold text-black uppercase leading-tight text-sm">
            <span class="shrink-0 pt-0.5">${idx + 1}.</span>
            <span class="min-w-0 break-words pt-0.5">${txName}</span>
          </div>
          <div class="flex justify-between items-center text-xs font-bold text-slate-700">
            <span class="whitespace-nowrap">Ngày: ${txDate}</span>
            <span class="text-emerald-600 text-sm font-black whitespace-nowrap">${txAmount} đ</span>
          </div>
        </div>
      `;
    });
    if (paymentsTx.length === 0) {
      paymentsRows = `<div class="py-3 text-center text-xs text-slate-400 italic">Chưa có giao dịch thanh toán nào</div>`;
    }

    const getTicketImageUrl = (url: string) => {
      if (!url) return '';
      if (url.startsWith('data:') || url.startsWith('http')) return url;
      return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const companyLogoHtml = companyInfo?.logoUrl 
      ? `<div class="w-16 h-16 rounded-full border border-slate-200 overflow-hidden bg-white shrink-0 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
          <img src="${getTicketImageUrl(companyInfo.logoUrl)}" alt="Logo" class="w-full h-full object-cover" crossorigin="anonymous" />
         </div>`
      : `<div class="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-white shrink-0 font-bold text-xl">
          ${(companyInfo?.name || 'D').slice(0, 1).toUpperCase()}
         </div>`;

    printWindow.document.write(`
      <html>
        <head>
          <base href="${window.location.origin}/">
          <title>In Công Nợ - ${selectedCustomer?.name || ''}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
          <style>${styles}</style>
          ${fallbackTags}
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              width: 80mm !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: white !important;
              font-family: 'Inter', 'Manrope', sans-serif !important;
            }
            #debt-statement-print-bill {
              width: 80mm !important;
              max-width: 80mm !important;
              padding: 10px 14px !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              visibility: visible !important;
              display: block !important;
              box-sizing: border-box !important;
            }
            #debt-statement-print-bill .border-slate-950 span {
              font-size: 14px !important;
            }
            #debt-statement-print-bill .border-slate-950 .text-lg {
              font-size: 16px !important;
            }
            * {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          </style>
        </head>
        <body>
          <div id="debt-statement-print-bill">
            <main class="bg-white text-black text-sm">
              <!-- Company Header -->
              <div class="flex items-center gap-4 mb-4">
                ${companyLogoHtml}
                <div class="text-left min-w-0">
                  <h2 class="text-xl font-black uppercase leading-tight tracking-tight text-black break-words">
                    ${companyInfo?.name || 'DUNVEX'}
                  </h2>
                  <div class="text-[11px] text-slate-600 font-semibold space-y-0.5 mt-1 leading-snug">
                    <p class="truncate">${companyInfo?.address || 'XÃ KIẾN ĐỨC , LÂM ĐỒNG'}</p>
                    <p>SĐT: ${companyInfo?.phone || '0988765444'}</p>
                  </div>
                </div>
              </div>

              <!-- Bill Title -->
              <div class="text-center border-t border-b border-dashed border-slate-400 py-2 my-3">
                <h1 class="text-base font-black uppercase tracking-wider">CHI TIẾT CÔNG NỢ</h1>
                <p class="text-[10px] text-slate-500 font-bold mt-0.5">#${selectedCustomer.id?.slice(-6).toUpperCase()}</p>
              </div>

              <!-- Bill Metadata -->
              <div class="space-y-1.5 text-xs text-slate-800 font-semibold mb-4 leading-normal">
                <div class="flex justify-between items-start gap-3">
                  <span class="shrink-0 text-slate-500">Khách hàng:</span>
                  <span class="font-bold text-black uppercase text-right">${selectedCustomer.name}</span>
                </div>
                ${(statementFromDate || statementToDate) ? `
                <div class="flex justify-between items-start gap-3">
                  <span class="shrink-0 text-slate-500">Kỳ lọc:</span>
                  <span class="text-right font-bold text-slate-800">
                    ${statementFromDate ? `Từ ${formatDateLocal(statementFromDate)}` : ''} 
                    ${statementToDate ? `đến ${formatDateLocal(statementToDate)}` : ''}
                  </span>
                </div>
                ` : ''}
                <div class="flex justify-between items-start gap-3">
                  <span class="shrink-0 text-slate-500">Tổng tiền nhập hàng:</span>
                  <span class="text-right font-bold">${formatPriceLocal(totalOrders)} đ</span>
                </div>
                <div class="flex justify-between items-start gap-3">
                  <span class="shrink-0 text-slate-500">Tổng tiền trả:</span>
                  <span class="text-right font-bold text-emerald-600">-${formatPriceLocal(totalPayments)} đ</span>
                </div>
                <div class="flex justify-between items-start gap-3">
                  <span class="shrink-0 text-slate-500">Số tiền công nợ còn lại:</span>
                  <span class="text-right font-black text-red-600">${formatPriceLocal(closingBalance)} đ</span>
                </div>
              </div>

              <!-- Purchases Section -->
              <div class="mt-4">
                <div class="border-t border-dashed border-slate-400 pt-2 font-bold text-xs text-slate-500 flex justify-between uppercase">
                  <span>DANH SÁCH ĐƠN MUA</span>
                  <span>Số tiền</span>
                </div>
                <div class="divide-y divide-dashed divide-slate-200 mt-1">
                  ${ordersRows}
                </div>
              </div>

              <!-- Payments Section -->
              <div class="mt-4">
                <div class="border-t border-dashed border-slate-400 pt-2 font-bold text-xs text-slate-500 flex justify-between uppercase">
                  <span>ĐÃ THANH TOÁN</span>
                  <span>Số tiền</span>
                </div>
                <div class="divide-y divide-dashed divide-slate-200 mt-1">
                  ${paymentsRows}
                </div>
              </div>

              <!-- Totals Section -->
              <div class="border-t border-dashed border-slate-400 pt-3 space-y-2 text-xs font-bold text-slate-700">
                ${(statementFromDate && openingBalance !== 0) ? `
                <div class="flex justify-between items-center gap-4">
                  <span class="shrink-0">Dư nợ đầu kỳ:</span>
                  <span class="text-black whitespace-nowrap">${formatPriceLocal(openingBalance)} đ</span>
                </div>
                ` : ''}
                <div class="flex justify-between items-center gap-4">
                  <span class="shrink-0">Tổng mua trong kỳ (+):</span>
                  <span class="text-black whitespace-nowrap">${formatPriceLocal(totalOrders)} đ</span>
                </div>
                <div class="flex justify-between items-center gap-4">
                  <span class="shrink-0">Đã thanh toán trong kỳ (-):</span>
                  <span class="text-emerald-600 whitespace-nowrap">-${formatPriceLocal(totalPayments)} đ</span>
                </div>

                <div class="border-t border-slate-950 pt-2 flex justify-between items-center font-black text-base text-black uppercase gap-4 border-t border-slate-950 border-double">
                  <span class="shrink-0">Dư nợ cuối kỳ:</span>
                  <span class="text-lg whitespace-nowrap">${formatPriceLocal(closingBalance)} đ</span>
                </div>
              </div>

              <!-- Signatures -->
              <div class="border-t border-dashed border-slate-400 mt-6 pt-4 grid grid-cols-2 gap-4 text-center text-[10px] font-bold text-slate-500 uppercase leading-normal">
                <div>
                  <p class="mb-10">Đại diện khách hàng</p>
                  <div class="mx-auto h-px w-16 bg-slate-300"></div>
                </div>
                <div>
                  <p class="mb-10">Người lập phiếu</p>
                  <span class="text-black font-extrabold">${auth.currentUser?.displayName || 'Nhân viên'}</span>
                </div>
              </div>

              <div class="text-center text-[10px] text-slate-400 font-bold mt-8 italic leading-snug">
                Cảm ơn quý khách đã tin tưởng và hợp tác cùng Dunvex Build!
              </div>
            </main>
          </div>
          <script>
            function checkStylesAndPrint() {
              const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
              let loadedCount = 0;

              const printAndClose = () => {
                if (window.hasPrinted) return;
                window.hasPrinted = true;

                if (document.fonts && document.fonts.ready) {
                  document.fonts.ready.then(() => {
                    setTimeout(() => {
                      window.print();
                      if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                        window.close();
                      }
                    }, 250);
                  }).catch(() => {
                    setTimeout(() => {
                      window.print();
                      if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                        window.close();
                      }
                    }, 250);
                  });
                } else {
                  setTimeout(() => {
                    window.print();
                    if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                      window.close();
                    }
                  }, 250);
                }
              };

              if (links.length === 0) {
                printAndClose();
                return;
              }

              links.forEach(link => {
                if (link.sheet) {
                  loadedCount++;
                  if (loadedCount === links.length) {
                    printAndClose();
                  }
                } else {
                  link.onload = () => {
                    loadedCount++;
                    if (loadedCount === links.length) {
                      printAndClose();
                    }
                  };
                  link.onerror = () => {
                    loadedCount++;
                    if (loadedCount === links.length) {
                      printAndClose();
                    }
                  };
                }
              });

              setTimeout(printAndClose, 1200);
            }

            if (document.readyState === 'complete') {
              checkStylesAndPrint();
            } else {
              window.onload = checkStylesAndPrint;
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return {
    showStatement,
    setShowStatement,
    selectedCustomer,
    setSelectedCustomer,
    statementFromDate,
    setStatementFromDate,
    statementToDate,
    setStatementToDate,
    statementScale,
    setStatementScale,
    statementZoom,
    setStatementZoom,
    statementTx,
    loadingStatementTx,
    openStatement,
    handlePrintStatement,
    companyInfo,
  };
}
