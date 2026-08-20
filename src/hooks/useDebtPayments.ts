/**
 * Hook quản lý form thanh toán (ghi nhận thu nợ)
 * 🔧 REFACTOR: Extract from Debts.tsx (payment form state, CRUD, image upload)
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  writeBatch,
  increment,
  Timestamp,
} from '../services/firebase';

export interface PaymentData {
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  note: string;
  paymentMethod: string;
  proofImage: string;
}

export interface UseDebtPaymentsParams {
  ownerId: string;
  ownerEmail: string;
  payments: any[];
  customers: any[];
  showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
  setHistoryCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

export function useDebtPayments({
  ownerId,
  ownerEmail,
  payments,
  customers,
  showToast,
  setHistoryCurrentPage,
}: UseDebtPaymentsParams) {
  // ── Modal visibility ─────────────────────────────────────
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showPaymentCustomerResults, setShowPaymentCustomerResults] = useState(false);
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);

  // ── Form state ───────────────────────────────────────────
  const [paymentData, setPaymentData] = useState<PaymentData>({
    customerId: '',
    customerName: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    note: '',
    paymentMethod: 'Tiền mặt',
    proofImage: '',
  });

  const [uploadingPaymentImage, setUploadingPaymentImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Customer search in form ──────────────────────────────
  const [paymentCustomerSearchQuery, setPaymentCustomerSearchQuery] = useState('');
  const paymentCustomerRef = useRef<HTMLDivElement>(null!);

  // ── Edit / detail ────────────────────────────────────────
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const location = useLocation();

  // ── Click-outside listener for customer search dropdown ──
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        paymentCustomerRef.current &&
        !paymentCustomerRef.current.contains(event.target as Node)
      ) {
        setShowPaymentCustomerResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── URL param: ?payment=true ─────────────────────────────
  useEffect(() => {
    const { search, state } = location;
    const params = new URLSearchParams(search);
    if (params.get('payment') === 'true' || state?.payment) {
      setShowPaymentForm(true);
      if (state?.prefillData) {
        setPaymentData((prev) => ({
          ...prev,
          ...state.prefillData,
        }));
      }
      // Xóa state để tránh mở lại modal khi reload
      if (state) {
        window.history.replaceState({}, document.title);
      }
    }
  }, [location]);

  // ── Image upload handler ─────────────────────────────────
  const handlePaymentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPaymentImage(true);
    try {
      const { uploadImageToVPS } = await import('../utils/vpsUpload');
      const url = await uploadImageToVPS(file);
      if (url) {
        setPaymentData((prev) => ({ ...prev, proofImage: url }));
      }
    } catch (error: any) {
      showToast(`Lỗi xử lý tệp: ${error.message}`, 'error');
    } finally {
      setUploadingPaymentImage(false);
    }
  };

  // ── Record / Edit payment ────────────────────────────────
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentData.customerId || !paymentData.amount) {
      showToast('Vui lòng nhập đầy đủ thông tin', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const diffAmount = editingPaymentId
        ? Number(paymentData.amount) -
          (Number(payments.find((p) => p.id === editingPaymentId)?.amount) || 0)
        : Number(paymentData.amount);

      let newPaymentId = editingPaymentId;

      if (editingPaymentId) {
        batch.update(doc(db, 'payments', editingPaymentId), {
          ...paymentData,
          updatedAt: Timestamp.now(),
        });

        // Log Update Payment
        const auditRef = doc(collection(db, 'audit_logs'));
        batch.set(auditRef, {
          action: 'Cập nhật phiếu thu',
          user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
          userId: auth.currentUser?.uid || '',
          ownerId: ownerId,
          details: `Đã cập nhật thu ${paymentData.amount.toLocaleString('vi-VN')} đ từ ${paymentData.customerName}`,
          createdAt: serverTimestamp(),
        });
      } else {
        const paymentRef = doc(collection(db, 'payments'));
        newPaymentId = paymentRef.id;
        batch.set(paymentRef, {
          ...paymentData,
          createdAt: Timestamp.now(),
          ownerId: ownerId,
          ownerEmail: ownerEmail,
          createdBy: auth.currentUser?.uid,
          createdByEmail: auth.currentUser?.email,
        });

        // Log New Payment
        const auditRef = doc(collection(db, 'audit_logs'));
        batch.set(auditRef, {
          action: 'Ghi nhận thu nợ',
          user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
          userId: auth.currentUser?.uid || '',
          ownerId: ownerId,
          details: `Đã thu ${paymentData.amount.toLocaleString('vi-VN')} đ từ ${paymentData.customerName}`,
          createdAt: serverTimestamp(),
        });
      }

      // Update Debt (chỉ cho khách có thật, bỏ qua "Khách vãng lai")
      if (paymentData.customerId && diffAmount !== 0 && !paymentData.customerId.startsWith('guest_')) {
        batch.update(doc(db, 'customers', paymentData.customerId), {
          debt: increment(-diffAmount),
        });
        // 📊 Ghi vào debts collection (single source of truth)
        const debtRef = doc(collection(db, 'debts'));
        batch.set(debtRef, {
          customerId: paymentData.customerId,
          customerName: paymentData.customerName,
          type: 'payment',
          amount: diffAmount,
          paymentId: newPaymentId || '',
          method: paymentData.paymentMethod || 'Chuyển khoản',
          note: paymentData.note || 'Ghi nhận thu nợ',
          ownerId: ownerId || '',
          createdBy: auth.currentUser?.uid || '',
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();

      showToast(
        editingPaymentId ? 'Cập nhật phiếu thu thành công' : 'Ghi nhận thu nợ thành công',
        'success',
      );
      setShowPaymentForm(false);
      setEditingPaymentId(null);
      setHistoryCurrentPage(1);
      setPaymentData({
        customerId: '',
        customerName: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        note: '',
        paymentMethod: 'Tiền mặt',
        proofImage: '',
      });
    } catch (error) {
      showToast('Lỗi khi lưu phiếu thu', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete payment ───────────────────────────────────────
  const handleDeletePayment = async (id: string) => {
    if (
      !window.confirm(
        'Bạn có chắc chắn muốn xóa phiếu thu này? Hành động này sẽ cập nhật lại dư nợ của khách hàng.',
      )
    )
      return;
    try {
      const paymentToDelete = payments.find((p) => p.id === id);
      const targetCustomerId = paymentToDelete?.customerId;
      const customerExists =
        targetCustomerId && customers.some((c) => c.id === targetCustomerId);

      if (
        paymentToDelete &&
        customerExists &&
        !String(targetCustomerId).startsWith('guest_')
      ) {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'payments', id));
        batch.update(doc(db, 'customers', targetCustomerId), {
          debt: increment(paymentToDelete.amount || 0),
        });
        const auditRef = doc(collection(db, 'audit_logs'));
        batch.set(auditRef, {
          action: 'Xóa phiếu thu',
          user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
          userId: auth.currentUser?.uid || '',
          ownerId: ownerId,
          details: `Đã xóa phiếu thu ${(paymentToDelete.amount || 0).toLocaleString('vi-VN')} đ của ${paymentToDelete.customerName || 'Khách hàng'}`,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
      } else {
        await deleteDoc(doc(db, 'payments', id));
        if (paymentToDelete) {
          try {
            await addDoc(collection(db, 'audit_logs'), {
              action: 'Xóa phiếu thu',
              user: auth.currentUser?.displayName || auth.currentUser?.email || 'Nhân viên',
              userId: auth.currentUser?.uid || '',
              ownerId: ownerId,
              details: `Đã xóa phiếu thu ${(paymentToDelete.amount || 0).toLocaleString('vi-VN')} đ của ${paymentToDelete.customerName || 'Khách hàng'}`,
              createdAt: serverTimestamp(),
            });
          } catch (logErr) {
            console.warn('Audit log error:', logErr);
          }
        }
      }

      showToast('Đã xóa phiếu thu thành công', 'success');
    } catch (error: any) {
      console.error('Delete payment error:', error);
      showToast('Lỗi khi xóa phiếu thu: ' + (error.message || ''), 'error');
    }
  };

  return {
    // Modal visibility
    showPaymentForm,
    setShowPaymentForm,
    showPaymentDetail,
    setShowPaymentDetail,
    // Form state
    paymentData,
    setPaymentData,
    isSubmitting,
    uploadingPaymentImage,
    // Customer search
    showPaymentCustomerResults,
    setShowPaymentCustomerResults,
    paymentCustomerSearchQuery,
    setPaymentCustomerSearchQuery,
    paymentCustomerRef,
    // Edit / detail
    editingPaymentId,
    setEditingPaymentId,
    selectedPayment,
    setSelectedPayment,
    // Handlers
    handleRecordPayment,
    handleDeletePayment,
    handlePaymentImageUpload,
  };
}
