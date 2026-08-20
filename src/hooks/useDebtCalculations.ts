/**
 * Hook tính toán công nợ — aggregate orders + payments + customers thành bảng công nợ
 * 🔧 REFACTOR: Extract from Debts.tsx (state, helpers, guest entities, KPI totals)
 */

import { useState, useEffect, useMemo } from 'react';

export interface AggregatedRow {
  id: string;
  name: string;
  isGuest?: boolean;
  address?: string;
  phone?: string;
  totalOrdersAmount: number;
  totalPaymentsAmount: number;
  currentDebt: number;
  lastTx: any;
  debtHealth: 'healthy' | 'slow' | 'risk' | 'critical';
  turnoverDays: number;
  hasStatusOrders: boolean;
  initials: string;
  [key: string]: any;
}

export interface UseDebtCalculationsParams {
  orders: any[];
  payments: any[];
  customers: any[];
  searchTerm: string;
  fromDate: string;
  toDate: string;
  statusFilter: string;
  currentPage: number;
  itemsPerPage: number;
}

export function useDebtCalculations({
  orders,
  payments,
  customers,
  searchTerm,
  fromDate,
  toDate,
  statusFilter,
  currentPage,
  itemsPerPage,
}: UseDebtCalculationsParams) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [resolvedDebts, setResolvedDebts] = useState<
    Record<string, { totalOrdersAmount: number; totalPaymentsAmount: number; currentDebt: number }>
  >({});

  // Real-time clock update every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // ── Helpers ──────────────────────────────────────────────
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price || 0) + ' đ';
  };

  const formatDate = (date: any) => {
    if (!date) return '---';
    if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString('vi-VN');
    return new Date(date).toLocaleDateString('vi-VN');
  };

  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      const match = url.match(/[-\w]{25,}/);
      if (match) {
        return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w1000`;
      }
    }
    return url;
  };

  // ── Guest entity collection ──────────────────────────────
  const registeredMap = useMemo(() => {
    const map = new Map<string, any>();
    customers.forEach((c) => map.set(c.id, c));
    return map;
  }, [customers]);

  const guestEntities = useMemo(() => {
    const entities: any[] = [];
    const seen = new Set<string>();

    orders.forEach((o) => {
      if (!o.customerId || !registeredMap.has(o.customerId)) {
        const gName = o.customerName || 'Khách vãng lai';
        if (!seen.has(gName)) {
          seen.add(gName);
          entities.push({
            id: `guest_${gName}`,
            name: gName,
            isGuest: true,
            address: o.deliveryAddress || '',
            phone: o.customerPhone || '',
          });
        }
      }
    });

    payments.forEach((p) => {
      if (!p.customerId || !registeredMap.has(p.customerId)) {
        const gName = p.customerName || 'Khách vãng lai';
        if (!seen.has(gName)) {
          seen.add(gName);
          entities.push({
            id: `guest_${gName}`,
            name: gName,
            isGuest: true,
            address: '',
            phone: '',
          });
        }
      }
    });

    return entities;
  }, [orders, payments, registeredMap]);

  const allEntities = useMemo(
    () => [...customers, ...guestEntities],
    [customers, guestEntities],
  );

  // ── Aggregate data by entity ─────────────────────────────
  const aggregatedData: AggregatedRow[] = useMemo(() => {
    return allEntities
      .map((c: any) => {
        const customerOrders = orders.filter((o: any) => {
          if (c.isGuest) {
            return (
              (!o.customerId || !registeredMap.has(o.customerId)) &&
              (o.customerName === c.name || (!o.customerName && c.name === 'Khách vãng lai'))
            );
          }
          return o.customerId === c.id;
        });

        const customerPayments = payments.filter((p: any) => {
          if (c.isGuest) {
            return (
              (!p.customerId || !registeredMap.has(p.customerId)) &&
              (p.customerName === c.name || (!p.customerName && c.name === 'Khách vãng lai'))
            );
          }
          return p.customerId === c.id;
        });

        const hasDateFilter = !!(fromDate || toDate);
        let periodOrders = customerOrders;
        let periodPayments = customerPayments;

        if (hasDateFilter) {
          const start = fromDate || '0000-00-00';
          const end = toDate || '9999-99-99';
          periodOrders = customerOrders.filter((o) => {
            const txDate =
              o.orderDate ||
              (o.createdAt?.seconds
                ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0]
                : '');
            return txDate >= start && txDate <= end;
          });
          periodPayments = customerPayments.filter((p) => {
            const txDate =
              p.date ||
              (p.createdAt?.seconds
                ? new Date(p.createdAt.seconds * 1000).toISOString().split('T')[0]
                : '');
            return txDate >= start && txDate <= end;
          });
        }

        // Chỉ tính đơn đã chốt — đơn nháp/chưa chốt không phải nợ thật
        const confirmedStatuses = ['Đơn chốt'];
        const debtOrders = customerOrders.filter((o) =>
          confirmedStatuses.includes(o.status),
        );
        const lifetimeTotalWaited = debtOrders.reduce(
          (sum: any, o: any) => sum + (o.totalAmount || 0),
          0,
        );
        const lifetimeTotalPaid = customerPayments.reduce(
          (sum: any, p: any) => sum + (p.amount || 0),
          0,
        );

        // 🔧 Tính nợ trực tiếp từ payments/orders realtime (không phụ thuộc cron 1 tiếng)
        const calcDebt = lifetimeTotalWaited - lifetimeTotalPaid;

        const hasRealtimeData =
          lifetimeTotalWaited > 0 ||
          lifetimeTotalPaid > 0 ||
          customerOrders.length > 0 ||
          customerPayments.length > 0;
        const currentDebt = hasRealtimeData
          ? calcDebt
          : (c.totalDebt ?? c.debt ?? 0);

        const displayTotalOrders = hasRealtimeData
          ? lifetimeTotalWaited
          : (c.totalOrdersAmount ?? 0);

        const totalPaid = hasDateFilter
          ? periodPayments.reduce((sum: any, p: any) => sum + (p.amount || 0), 0)
          : hasRealtimeData
            ? lifetimeTotalPaid
            : (c.totalPaymentsAmount ?? 0);

        // Last transaction (unfiltered for accurate sorting and health)
        const allTx = [
          ...customerOrders
            .filter((o: any) => o.status === 'Đơn chốt')
            .map((o: any) => ({ date: o.orderDate || o.createdAt, type: 'order' })),
          ...customerPayments.map((p: any) => ({
            date: p.date || p.createdAt,
            type: 'payment',
          })),
        ].sort((a: any, b: any) => {
          const da = a.date?.seconds
            ? a.date.seconds * 1000
            : a.date
              ? new Date(a.date).getTime()
              : 0;
          const db = b.date?.seconds
            ? b.date.seconds * 1000
            : b.date
              ? new Date(b.date).getTime()
              : 0;
          return db - da;
        });

        const turnoverDays = allTx[0]?.date
          ? Math.floor(
              (new Date().getTime() -
                (allTx[0].date?.seconds
                  ? allTx[0].date.seconds * 1000
                  : new Date(allTx[0].date).getTime())) /
                (1000 * 60 * 60 * 24),
            )
          : 999;

        let debtHealth: 'healthy' | 'slow' | 'risk' | 'critical' = 'healthy';
        if (currentDebt > 200000000 || (currentDebt > 50000000 && turnoverDays > 60))
          debtHealth = 'critical';
        else if (currentDebt > 100000000 || turnoverDays > 30) debtHealth = 'risk';
        else if (currentDebt > 10000000 || turnoverDays > 15) debtHealth = 'slow';

        return {
          ...c,
          totalOrdersAmount: displayTotalOrders,
          totalPaymentsAmount: totalPaid,
          currentDebt,
          lastTx: allTx[0]?.date || null,
          debtHealth,
          turnoverDays,
          hasStatusOrders:
            periodOrders.some((o) => o.status === 'Đơn chốt') ||
            periodPayments.length > 0 ||
            currentDebt > 0,
          initials:
            String(c.name || '')
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'KH',
        };
      })
      .filter((item: any) => {
        const matchesName =
          !searchTerm ||
          String(item.name || '').toLowerCase().includes(searchTerm.toLowerCase());

        if (fromDate || toDate) {
          const hasTxInRange = item.totalOrdersAmount > 0 || item.totalPaymentsAmount > 0;
          return matchesName && hasTxInRange;
        }

        const matchesStatus = item.hasStatusOrders;
        return matchesName && matchesStatus;
      })
      .sort((a: any, b: any) => b.currentDebt - a.currentDebt);
  }, [allEntities, orders, payments, registeredMap, fromDate, toDate, searchTerm, statusFilter]);

  // ── Pagination ───────────────────────────────────────────
  const totalPages = Math.ceil(aggregatedData.length / itemsPerPage);
  const paginatedData = useMemo(
    () =>
      aggregatedData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      ),
    [aggregatedData, currentPage, itemsPerPage],
  );

  // ── KPI Totals ───────────────────────────────────────────
  const totalWaitedAll = useMemo(
    () =>
      customers.reduce(
        (sum: any, c: any) =>
          sum +
          (c.totalOrdersAmount ??
            aggregatedData.find((a: any) => a.id === c.id)?.totalOrdersAmount ??
            0),
        0,
      ),
    [customers, aggregatedData],
  );

  const totalPaidAll = useMemo(
    () =>
      customers.reduce(
        (sum: any, c: any) =>
          sum +
          (c.totalPaymentsAmount ??
            aggregatedData.find((a: any) => a.id === c.id)?.totalPaymentsAmount ??
            0),
        0,
      ),
    [customers, aggregatedData],
  );

  const totalUnpaidAll = useMemo(
    () =>
      customers.reduce(
        (sum: any, c: any) =>
          sum +
          (c.totalDebt ??
            ((aggregatedData.find((a: any) => a.id === c.id)?.currentDebt ?? 0) > 0
              ? aggregatedData.find((a: any) => a.id === c.id)?.currentDebt
              : 0)),
        0,
      ),
    [customers, aggregatedData],
  );

  // ── Pagination helpers ───────────────────────────────────
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const radius = 1;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - radius && i <= currentPage + radius) ||
        i <= 3 ||
        i >= totalPages - 2
      ) {
        pages.push(i);
      }
    }

    const uniquePages = [...new Set(pages)].sort((a, b) => (a as number) - (b as number));
    const withEllipsis: (number | string)[] = [];

    for (let i = 0; i < uniquePages.length; i++) {
      if (i > 0 && (uniquePages[i] as number) - (uniquePages[i - 1] as number) > 1) {
        withEllipsis.push('...');
      }
      withEllipsis.push(uniquePages[i]);
    }
    return withEllipsis;
  };

  return {
    resolvedDebts,
    setResolvedDebts,
    currentTime,
    formatPrice,
    formatDate,
    getImageUrl,
    aggregatedData,
    paginatedData,
    totalPages,
    totalWaitedAll,
    totalPaidAll,
    totalUnpaidAll,
    getPageNumbers,
  };
}
