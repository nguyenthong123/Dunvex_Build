/**
 * Hook tính toán công nợ — aggregate orders + payments + customers thành bảng công nợ
 * 🔧 REFACTOR: Extract from Debts.tsx (state, helpers, guest entities, KPI totals)
 * 🚀 UPGRADE: Hỗ trợ lọc trạng thái nợ (Còn nợ, Đã hết, Tất cả), sắp xếp đa tiêu chí, chuẩn hóa Timestamp
 */

import { useState, useEffect, useMemo } from 'react';
import { getOrderTimestamp, getPaymentTimestamp, getTxDateString, formatOrderDateOnly } from '../utils/orderFilter';
import { smartSearchMatch } from '../utils/searchUtils';

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
  lastTxTimestamp: number;
  lastTxDate: string;
  debtHealth: 'healthy' | 'slow' | 'risk' | 'critical';
  turnoverDays: number;
  hasStatusOrders: boolean;
  periodOrdersCount: number;
  periodPaymentsCount: number;
  initials: string;
  [key: string]: any;
}

export type DebtStatusFilter = 'unpaid' | 'paid' | 'all';
export type DebtSortOption = 'debt_desc' | 'recent_tx' | 'name_asc' | 'debt_asc';

export interface UseDebtCalculationsParams {
  orders: any[];
  payments: any[];
  customers: any[];
  searchTerm: string;
  fromDate: string;
  toDate: string;
  statusFilter?: string;
  debtStatusFilter?: DebtStatusFilter;
  sortBy?: DebtSortOption;
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
  debtStatusFilter = 'all',
  sortBy = 'recent_tx',
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
    return formatOrderDateOnly(date);
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
  const allEntitiesWithDebt: AggregatedRow[] = useMemo(() => {
    return allEntities.map((c: any) => {
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
          const txDate = getTxDateString(o);
          return txDate >= start && txDate <= end;
        });
        periodPayments = customerPayments.filter((p) => {
          const txDate = getTxDateString(p);
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

      // 🔧 Tính nợ trực tiếp từ payments/orders realtime
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
          .map((o: any) => ({
            timestamp: getOrderTimestamp(o),
            dateStr: getTxDateString(o),
            raw: o.orderDate || o.createdAt,
            type: 'order' as const,
          })),
        ...customerPayments.map((p: any) => ({
          timestamp: getPaymentTimestamp(p),
          dateStr: getTxDateString(p),
          raw: p.date || p.createdAt,
          type: 'payment' as const,
        })),
      ]
        .filter((tx) => tx.timestamp > 0)
        .sort((a, b) => b.timestamp - a.timestamp);

      const turnoverDays = allTx[0]?.timestamp
        ? Math.max(0, Math.floor((Date.now() - allTx[0].timestamp) / (1000 * 60 * 60 * 24)))
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
        lastTx: allTx[0]?.raw || null,
        lastTxTimestamp: allTx[0]?.timestamp || 0,
        lastTxDate: allTx[0]?.dateStr ? formatOrderDateOnly(null, allTx[0].dateStr) : '',
        debtHealth,
        turnoverDays,
        periodOrdersCount: periodOrders.length,
        periodPaymentsCount: periodPayments.length,
        hasStatusOrders:
          customerOrders.some((o) => o.status === 'Đơn chốt') ||
          customerPayments.length > 0 ||
          currentDebt !== 0,
        initials:
          String(c.name || '')
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'KH',
      };
    });
  }, [allEntities, orders, payments, registeredMap, fromDate, toDate]);

  // ── Helper search matching ───────────────────────────────
  const matchesSearch = (item: AggregatedRow, term: string) => {
    if (!term) return true;
    return smartSearchMatch([item.name || '', item.phone || '', item.id || ''], term);
  };

  // ── Filtered data ────────────────────────────────────────
  const filteredData = useMemo(() => {
    return allEntitiesWithDebt.filter((item: AggregatedRow) => {
      // 1. Search term match
      if (!matchesSearch(item, searchTerm)) return false;

      // 2. Date range filter
      if (fromDate || toDate) {
        const hasTxInRange = item.periodOrdersCount > 0 || item.periodPaymentsCount > 0;
        if (!hasTxInRange) return false;
      }

      // 3. Debt status filter
      if (debtStatusFilter === 'unpaid') {
        return item.currentDebt > 0;
      }
      if (debtStatusFilter === 'paid') {
        return item.currentDebt <= 0 && (item.totalOrdersAmount > 0 || item.totalPaymentsAmount > 0);
      }

      // 'all': Chỉ lấy các đối tác có lịch sử đơn hàng hoặc thu nợ
      return item.hasStatusOrders;
    });
  }, [allEntitiesWithDebt, searchTerm, fromDate, toDate, debtStatusFilter]);

  // ── Sorted data ──────────────────────────────────────────
  const aggregatedData: AggregatedRow[] = useMemo(() => {
    return [...filteredData].sort((a: AggregatedRow, b: AggregatedRow) => {
      switch (sortBy) {
        case 'recent_tx':
          return (b.lastTxTimestamp || 0) - (a.lastTxTimestamp || 0);
        case 'name_asc':
          return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
        case 'debt_asc':
          return a.currentDebt - b.currentDebt;
        case 'debt_desc':
        default:
          return b.currentDebt - a.currentDebt;
      }
    });
  }, [filteredData, sortBy]);

  // ── Summary Counts for Tabs ──────────────────────────────
  const debtCounts = useMemo(() => {
    let unpaid = 0;
    let paid = 0;
    let all = 0;

    allEntitiesWithDebt.forEach((item) => {
      if (item.hasStatusOrders) {
        all++;
        if (item.currentDebt > 0) unpaid++;
        else if (item.totalOrdersAmount > 0 || item.totalPaymentsAmount > 0) paid++;
      }
    });

    return { unpaid, paid, all };
  }, [allEntitiesWithDebt]);

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
      allEntitiesWithDebt.reduce(
        (sum: number, item: AggregatedRow) => sum + (Number(item.totalOrdersAmount) || 0),
        0,
      ),
    [allEntitiesWithDebt],
  );

  const totalPaidAll = useMemo(
    () =>
      allEntitiesWithDebt.reduce(
        (sum: number, item: AggregatedRow) => sum + (Number(item.totalPaymentsAmount) || 0),
        0,
      ),
    [allEntitiesWithDebt],
  );

  const totalUnpaidAll = useMemo(
    () =>
      allEntitiesWithDebt.reduce(
        (sum: number, item: AggregatedRow) =>
          sum + ((Number(item.currentDebt) || 0) > 0 ? Number(item.currentDebt) : 0),
        0,
      ),
    [allEntitiesWithDebt],
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
    allEntitiesWithDebt,
    aggregatedData,
    paginatedData,
    totalPages,
    totalWaitedAll,
    totalPaidAll,
    totalUnpaidAll,
    debtCounts,
    getPageNumbers,
  };
}
