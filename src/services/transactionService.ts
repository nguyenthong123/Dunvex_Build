import { db } from './firebase';
import { collection, query, where, getDocs, doc, writeBatch, increment, getDoc } from 'firebase/firestore';

export const transactionService = {
  /**
   * Huỷ/Xoá Đơn Nhập Hàng an toàn (Atomic Batch)
   * 1. Xoá Purchase Order
   * 2. Hoàn lại số lượng tồn kho (Stock Rollback)
   * 3. Xoá tất cả công nợ (supplier_debts) phát sinh từ đơn này
   * 4. Trừ lại tổng công nợ (totalDebt) của Nhà cung cấp
   */
  async deletePurchaseOrderSafe(poId: string, ownerId: string): Promise<void> {
    if (!poId || !ownerId) throw new Error("Missing required parameters for safe deletion.");

    // Lấy thông tin PO
    const poRef = doc(db, 'purchase_orders', poId);
    const poSnap = await getDoc(poRef);
    if (!poSnap.exists()) {
      throw new Error("Không tìm thấy Đơn nhập hàng này.");
    }
    const poData = poSnap.data();

    // Tìm tất cả các bản ghi công nợ liên quan (dùng index thủ công nếu cần, nhưng where orderId an toàn ở đây nếu quy mô nhỏ)
    const debtsQuery = query(
      collection(db, 'supplier_debts'),
      where('ownerId', '==', ownerId),
      where('orderId', '==', poId)
    );
    const debtsSnap = await getDocs(debtsQuery);

    // Tính toán tổng số tiền thay đổi đối với nhà cung cấp
    // debt_increase (+) -> cần bị huỷ đi (-)
    let netDebtCorrection = 0;
    debtsSnap.docs.forEach(d => {
      const dData = d.data();
      const amount = Number(dData.amount) || 0;
      if (dData.type === 'debt_increase') netDebtCorrection -= amount;
      if (dData.type === 'payment' || dData.type === 'cancellation') netDebtCorrection += amount;
    });

    // Gom tất cả vào 1 batch
    const batch = writeBatch(db);

    // 1. Xoá PO
    batch.delete(poRef);

    // 2. Hoàn tồn kho (dùng increment để tránh race condition)
    const validItems = (poData.items || []).filter((item: any) => item.productId);
    for (const item of validItems) {
      const productRef = doc(db, 'products', item.productId);
      batch.update(productRef, { stock: increment(-Number(item.qty || 0)) });
    }

    // 3. Xoá các bản ghi công nợ
    debtsSnap.docs.forEach(d => {
      batch.delete(d.ref);
    });

    // 4. Cập nhật lại tổng nợ của NCC (dùng increment)
    if (poData.supplierId && netDebtCorrection !== 0) {
      const supplierRef = doc(db, 'suppliers', poData.supplierId);
      batch.update(supplierRef, { totalDebt: increment(netDebtCorrection) });
    }

    // Thực thi Batch (Tất cả hoặc không có gì)
    await batch.commit();
  }
};
