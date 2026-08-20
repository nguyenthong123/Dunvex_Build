/**
 * Hook quản lý bộ lọc & tìm kiếm trong trang Công Nợ
 * 🔧 REFACTOR: Extract from Debts.tsx (search, date filters, pagination, notifications)
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

export interface UseDebtFiltersParams {
  /** Payments đã được enhance với displayCustomerName */
  enhancedPayments: any[];
}

export function useDebtFilters({ enhancedPayments }: UseDebtFiltersParams) {
  // ── Search ───────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Date filters ─────────────────────────────────────────
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('Đơn chốt');
  const [showFilterOptions, setShowFilterOptions] = useState(false);

  // ── Pagination ───────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // ── Notifications ────────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);

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

  const isMatch = (target: string, query: string) => {
    if (!query) return true;
    const t = normalizeText(target);
    const q = normalizeText(query);
    return t.includes(q) || removeAccents(t).includes(removeAccents(q));
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
  }, [searchTerm, statusFilter, fromDate, toDate]);

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
        const da = a.date
          ? new Date(a.date).getTime()
          : a.createdAt?.seconds
            ? a.createdAt.seconds * 1000
            : 0;
        const db = b.date
          ? new Date(b.date).getTime()
          : b.createdAt?.seconds
            ? b.createdAt.seconds * 1000
            : 0;
        if (db === da) {
          const ca = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
          const cb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
          return cb - ca;
        }
        return db - da;
      })
      .filter((p) => {
        const matchesName =
          !searchTerm ||
          String(p.displayCustomerName || '')
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          String(p.customerName || '')
            .toLowerCase()
            .includes(searchTerm.toLowerCase());

        if (fromDate || toDate) {
          const start = fromDate || '0000-00-00';
          const end = toDate || '9999-99-99';
          const pDate =
            p.date ||
            (p.createdAt?.seconds
              ? new Date(p.createdAt.seconds * 1000).toISOString().split('T')[0]
              : '');
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
    // Date filters
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    statusFilter,
    setStatusFilter,
    showFilterOptions,
    setShowFilterOptions,
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
