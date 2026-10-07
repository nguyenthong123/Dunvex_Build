/**
 * Hook quản lý bộ lọc & tìm kiếm trong trang Công Nợ
 * 🔧 REFACTOR: Extract from Debts.tsx (search, date filters, pagination, notifications)
 * 🚀 UPGRADE: Hỗ trợ DebtStatusFilter, TimePresets, Sorting, và chuẩn hóa Timestamp cho History
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { auth, db } from '../services/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  writeBatch,
} from '../services/firebase';
import { getPaymentTimestamp, getTxDateString, getTimeRangeForPreset } from '../utils/orderFilter';
import type { DebtStatusFilter, DebtSortOption } from './useDebtCalculations';

export type TimePresetOption = 'all' | 'this_month' | '2_months' | '3_months' | 'custom';

export interface UseDebtFiltersParams {
  /** Payments đã được enhance với displayCustomerName */
  enhancedPayments: any[];
}

export function useDebtFilters({ enhancedPayments }: UseDebtFiltersParams) {
  // ── Search ───────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Date filters & Presets ───────────────────────────────
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [timePreset, setTimePreset] = useState<TimePresetOption>('all');
  const [showFilterOptions, setShowFilterOptions] = useState(false);

  // ── Status & Sorting filters ─────────────────────────────
  const [statusFilter, setStatusFilter] = useState('Đơn chốt');
  const [debtStatusFilter, setDebtStatusFilter] = useState<DebtStatusFilter>('all');
  const [sortBy, setSortBy] = useState<DebtSortOption>('recent_tx');

  // ── Pagination ───────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ── Notifications ────────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Preset handler ───────────────────────────────────────
  const handleSetTimePreset = (preset: TimePresetOption) => {
    setTimePreset(preset);
    if (preset !== 'custom') {
      const { fromDate: f, toDate: t } = getTimeRangeForPreset(preset);
      setFromDate(f);
      setToDate(t);
    }
  };

  // ── Mobile search listener ──────────────────────────────
  useEffect(() => {
    const handleOpenSearch = () => {
      setShowMobileSearch(true);
      setTimeout(() => searchRef.current?.focus(), 200);
    };
    window.addEventListener('open-mobile-search', handleOpenSearch);
    return () => window.removeEventListener('open-mobile-search', handleOpenSearch);
  }, []);

  // ── Text helpers ─────────────────────────────────────────
  const normalizeText = (text: any) =>
    text
      ? String(text)
          .normalize('NFC')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()
      : '';

  const removeAccents = (str: any) => {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  };

  const isMatch = (target: string, q: string) => {
    if (!q) return true;
    const t = normalizeText(target);
    const queryStr = normalizeText(q);
    return t.includes(queryStr) || removeAccents(t).includes(removeAccents(queryStr));
  };

  // ── Notification listener (Firestore realtime) ──────────
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const unread = snapshot.docs.filter((d) => !d.data().read).length;
      setUnreadCount(unread);
    });
    return () => unsubscribe();
  }, []);

  // ── Reset page when filters change ──────────────────────
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, debtStatusFilter, sortBy, fromDate, toDate]);

  // ── Mark all notifications read ─────────────────────────
  const markAllAsRead = async () => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => {
      if (!d.data().read) {
        batch.update(d.ref, { read: true });
      }
    });
    await batch.commit();
  };

  // ── Filtered history (for history tab) ──────────────────
  const filteredHistory = useMemo(() => {
    return [...enhancedPayments]
      .sort((a, b) => {
        const da = getPaymentTimestamp(a);
        const db = getPaymentTimestamp(b);
        return db - da;
      })
      .filter((p) => {
        const matchesName =
          !searchTerm ||
          isMatch(p.displayCustomerName, searchTerm) ||
          isMatch(p.customerName, searchTerm) ||
          isMatch(p.note, searchTerm);

        if (fromDate || toDate) {
          const start = fromDate || '0000-00-00';
          const end = toDate || '9999-99-99';
          const pDate = getTxDateString(p);
          return matchesName && pDate >= start && pDate <= end;
        }
        return matchesName;
      });
  }, [enhancedPayments, searchTerm, fromDate, toDate]);

  const historyTotalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = useMemo(
    () =>
      filteredHistory.slice(
        (historyCurrentPage - 1) * ITEMS_PER_PAGE,
        historyCurrentPage * ITEMS_PER_PAGE,
      ),
    [filteredHistory, historyCurrentPage, ITEMS_PER_PAGE],
  );

  const getHistoryPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const radius = 1;

    for (let i = 1; i <= historyTotalPages; i++) {
      if (
        i === 1 ||
        i === historyTotalPages ||
        (i >= historyCurrentPage - radius && i <= historyCurrentPage + radius) ||
        i <= 3 ||
        i >= historyTotalPages - 2
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
    // Search
    searchTerm,
    setSearchTerm,
    showMobileSearch,
    setShowMobileSearch,
    searchRef,
    // Date filters & Presets
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    timePreset,
    setTimePreset,
    handleSetTimePreset,
    showFilterOptions,
    setShowFilterOptions,
    // Status & Sorting
    statusFilter,
    setStatusFilter,
    debtStatusFilter,
    setDebtStatusFilter,
    sortBy,
    setSortBy,
    // Pagination
    currentPage,
    setCurrentPage,
    historyCurrentPage,
    setHistoryCurrentPage,
    ITEMS_PER_PAGE,
    // Helpers
    normalizeText,
    removeAccents,
    isMatch,
    // Notifications
    unreadCount,
    markAllAsRead,
    // History tab
    filteredHistory,
    historyTotalPages,
    paginatedHistory,
    getHistoryPageNumbers,
  };
}
