import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, Search, Filter, AlertCircle, Clock, ShoppingBag, Users, Package, Truck, ShieldAlert } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from '../services/fakeFirestore';
import { db } from '../services/firebase';
import { restoreTrashItem, purgeTrashItem } from '../services/apiClient';
import { useToast } from '../components/shared/Toast';

interface TrashDoc {
  id: string;
  originalCollection: string;
  originalId: string;
  doc: any;
  deletedAt: string;
  deletedBy?: {
    uid?: string;
    email?: string;
    displayName?: string;
  };
  ownerId?: string;
}

export default function TrashView() {
  const [trashItems, setTrashItems] = useState<TrashDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCollection, setFilterCollection] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<TrashDoc | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { showToast } = useToast();

    useEffect(() => {
    const trashRef = collection(db, 'trash');
    const q = query(trashRef, orderBy('deletedAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs: TrashDoc[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrashDoc[];

      // 1. Phân loại mục còn hạn và mục đã quá 5 ngày
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const expiredItems: TrashDoc[] = [];
      const validItems: TrashDoc[] = [];

      docs.forEach(item => {
        const dAt = (item as any).deletedAt;
        const timeMs = dAt?.toMillis ? dAt.toMillis() : (dAt?.toDate ? dAt.toDate().getTime() : new Date(dAt).getTime());
        if (timeMs && (now - timeMs) > fiveDaysMs) {
          expiredItems.push(item);
        } else {
          validItems.push(item);
        }
      });

      // 2. Tự động xóa vĩnh viễn và bắn webhook nếu có mục quá hạn
      if (expiredItems.length > 0) {
        try {
          await Promise.all(expiredItems.map(it => purgeTrashItem(it.id)));

          fetch('https://34-133-127-214.nip.io/webhook/dunvex-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventType: 'trash_auto_purge',
              purgedCount: expiredItems.length,
              items: expiredItems.map(it => ({
                id: it.id,
                itemType: (it as any).collectionName || (it as any).type || 'Dữ liệu',
                title: (it as any).title || (it as any).name || it.id
              }))
            })
          }).catch(err => console.error('Lỗi bắn webhook auto purge:', err));
        } catch (purgeErr) {
          console.error('Lỗi khi tự động dọn dẹp thùng rác:', purgeErr);
        }
      }

      // 3. Cập nhật state chỉ hiển thị các mục hợp lệ còn trong hạn
      setTrashItems(validItems);
      setLoading(false);
    }, (err) => {
      console.error('Failed to load trash items:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);


  const handleRestore = async (item: TrashDoc) => {
    try {
      setActionLoading(true);
      await restoreTrashItem(item.id);
      showToast('Đã khôi phục dữ liệu thành công!', 'success');
      setSelectedItem(null);

      // Bắn webhook Telegram sang n8n
      fetch('https://34-133-127-214.nip.io/webhook/dunvex-events', {

        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'trash_restore',
          itemType: (item as any).collectionName || (item as any).type || 'inventory_logs',

          itemId: item.id,
          userName: item.deletedBy?.displayName || item.deletedBy?.email || 'Admin',
          time: new Date().toLocaleString('vi-VN')
        })
      }).catch(err => console.error('Lỗi bắn webhook n8n:', err));

    } catch (err: any) {
      showToast(err.message || 'Lỗi khi khôi phục dữ liệu', 'error');
    } finally {
      setActionLoading(false);
    }
  };


  const handlePurge = async (item: TrashDoc) => {
    if (!window.confirm('Bạn có chắc chắn muốn XOÁ VĨNH VIỄN bản ghi này? Dữ liệu sẽ không thể khôi phục!')) {
      return;
    }
    try {
      setActionLoading(true);
      await purgeTrashItem(item.id);
      showToast('Đã xoá vĩnh viễn khỏi Thùng rác!', 'info');
      setSelectedItem(null);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xoá vĩnh viễn', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getCollectionBadge = (collName: string) => {
    switch (collName) {
      case 'orders':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400"><ShoppingBag size={12} /> Đơn hàng</span>;
      case 'products':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400"><Package size={12} /> Sản phẩm</span>;
      case 'customers':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Users size={12} /> Khách hàng</span>;
      case 'suppliers':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400"><Truck size={12} /> Nhà cung cấp</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400">{collName}</span>;
    }
  };

  const getItemTitle = (item: TrashDoc) => {
    const data = item.doc || {};
    if (item.originalCollection === 'orders') {
      return data.orderCode || data.customerName || `Đơn hàng #${item.originalId.slice(-6)}`;
    }
    if (item.originalCollection === 'products') {
      return data.name || data.productName || `Sản phẩm #${item.originalId.slice(-6)}`;
    }
    if (item.originalCollection === 'customers') {
      return data.name || data.customerName || data.phone || `Khách hàng #${item.originalId.slice(-6)}`;
    }
    if (item.originalCollection === 'suppliers') {
      return data.name || data.supplierName || `Nhà cung cấp #${item.originalId.slice(-6)}`;
    }
    return data.name || data.title || data.id || item.originalId;
  };

  const getItemSubtext = (item: TrashDoc) => {
    const data = item.doc || {};
    if (item.originalCollection === 'orders') {
      const amount = data.totalAmount || data.finalTotal || data.total || 0;
      return `Tổng tiền: ${Number(amount).toLocaleString('vi-VN')}đ • Ngày đặt: ${data.orderDate || 'N/A'}`;
    }
    if (item.originalCollection === 'products') {
      const price = data.priceSell || data.price || 0;
      return `Giá bán: ${Number(price).toLocaleString('vi-VN')}đ • Mã SKU: ${data.articleNo || data.sku || 'N/A'}`;
    }
    if (item.originalCollection === 'customers') {
      return `SĐT: ${data.phone || 'Chưa có'} • Địa chỉ: ${data.address || 'Chưa có'}`;
    }
    return `ID: ${item.originalId}`;
  };

  const getDaysRemaining = (deletedAt: string) => {
    if (!deletedAt) return 5;
    const deletedTime = new Date(deletedAt).getTime();
    if (isNaN(deletedTime)) return 5;
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    const expiresAt = deletedTime + fiveDaysMs;
    const diffMs = expiresAt - Date.now();
    if (diffMs <= 0) return 0;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours >= 24) {
      const days = Math.ceil(hours / 24);
      return `${days} ngày`;
    }
    return `${hours} giờ`;
  };

  const filteredItems = trashItems.filter(item => {
    if (filterCollection !== 'all' && item.originalCollection !== filterCollection) {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const title = getItemTitle(item).toLowerCase();
      const subtext = getItemSubtext(item).toLowerCase();
      const deletedBy = (item.deletedBy?.email || item.deletedBy?.displayName || '').toLowerCase();
      return title.includes(term) || subtext.includes(term) || deletedBy.includes(term);
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-black">
            <Trash2 size={28} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              Thùng Rác
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                {trashItems.length} mục
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Dữ liệu trong thùng rác sẽ tự động được xoá vĩnh viễn sau <strong className="text-rose-500">5 ngày</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 text-amber-700 dark:text-amber-300 text-xs">
        <ShieldAlert size={18} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Lưu ý về khôi phục dữ liệu:</p>
          <p className="mt-0.5 text-amber-600/90 dark:text-amber-400/90">
            Bạn có thể khôi phục lại các đơn hàng, sản phẩm hoặc khách hàng đã xoá nhầm bất cứ lúc nào trước khi thời hạn 5 ngày kết thúc.
          </p>
        </div>
      </div>

      {/* Controls: Search & Filter */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Tìm theo tên, mã, người xoá..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto custom-scrollbar pb-1 md:pb-0">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'orders', label: 'Đơn hàng' },
            { id: 'products', label: 'Sản phẩm' },
            { id: 'customers', label: 'Khách hàng' },
            { id: 'suppliers', label: 'Nhà cung cấp' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterCollection(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterCollection === tab.id
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trash Table / Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center text-slate-400 font-medium text-xs flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            Đang tải dữ liệu thùng rác...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs flex flex-col items-center gap-3">
            <Trash2 size={40} className="text-slate-300 dark:text-slate-700" />
            Thùng rác trống
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getCollectionBadge(item.originalCollection)}
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      {getItemTitle(item)}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    {getItemSubtext(item)}
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400 font-medium flex-wrap pt-1">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Xoá: {new Date(item.deletedAt).toLocaleString('vi-VN')}
                    </span>
                    {item.deletedBy?.displayName || item.deletedBy?.email ? (
                      <span>Bởi: <strong className="text-slate-600 dark:text-slate-300">{item.deletedBy.displayName || item.deletedBy.email}</strong></span>
                    ) : null}
                    <span className="text-rose-500 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full">
                      Tự xoá sau: {getDaysRemaining(item.deletedAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(item)}
                    disabled={actionLoading}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw size={14} />
                    Khôi phục
                  </button>
                  <button
                    onClick={() => handlePurge(item)}
                    disabled={actionLoading}
                    className="flex-1 sm:flex-none px-3 py-2 bg-slate-100 dark:bg-slate-800 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    Xoá hẳn
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
