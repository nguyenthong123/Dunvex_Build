import React, { useState } from 'react';
import { X, QrCode, Download, Copy, Check } from 'lucide-react';
import { generateVietQRUrl, getBankShortName } from '../../data/banks';

interface BankInfo {
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
}

interface SupplierQRModalProps {
  supplier: {
    name: string;
    phone?: string;
    address?: string;
    category?: string;
    bankName?: string;
    bankAccount?: string;
    bankHolder?: string;
    totalDebt?: number;
  };
  onClose: () => void;
}

const SupplierQRModal: React.FC<SupplierQRModalProps> = ({ supplier, onClose }) => {
  const [amount, setAmount] = useState(supplier.totalDebt || 0);
  const [description, setDescription] = useState(`Thanh toan ${supplier.name}`);
  const [copied, setCopied] = useState(false);

  const hasBankInfo = supplier.bankAccount && supplier.bankName;

  const qrUrl = hasBankInfo
    ? generateVietQRUrl(supplier.bankName!, supplier.bankAccount!, supplier.bankHolder || supplier.name, amount, description)
    : null;

  const handleCopyInfo = async () => {
    const text = `NH: ${getBankShortName(supplier.bankName || '')}\nSTK: ${supplier.bankAccount}\nChủ TK: ${supplier.bankHolder || supplier.name}\nSố tiền: ${amount.toLocaleString('vi-VN')}đ`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // fallback
    }
  };

  const handleDownloadPNG = () => {
    const img = document.querySelector('#supplier-qr-code img') as HTMLImageElement;
    if (!img || !img.src) return;
    // Tải trực tiếp từ VietQR
    fetch(img.src)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `QR_${supplier.name.replace(/\s/g, '_')}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        // Fallback: open in new tab
        window.open(img.src, '_blank');
      });
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <QrCode className="text-[#FF6D00]" size={24} />
            QR Chuyển Khoản
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 flex-1 custom-scrollbar">
          {!hasBankInfo ? (
            <div className="text-center py-4 space-y-4">
              {/* Supplier Info even without bank */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm space-y-1.5 text-left">
                <div className="font-bold text-base text-[#FF6D00]">{supplier.name}</div>
                {supplier.category && (
                  <div className="text-slate-500 dark:text-slate-400 text-xs">📦 {supplier.category}</div>
                )}
                {supplier.phone && (
                  <div className="text-slate-600 dark:text-slate-400">📞 {supplier.phone}</div>
                )}
                {supplier.address && (
                  <div className="text-slate-600 dark:text-slate-400">📍 {supplier.address}</div>
                )}
              </div>
              <div className="text-slate-400">
                <QrCode size={40} className="mx-auto mb-2 opacity-30" />
                <p className="font-medium">Chưa có thông tin ngân hàng</p>
                <p className="text-xs mt-1">Nhấn ✏️ để cập nhật thông tin ngân hàng</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Supplier Info */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm space-y-1.5">
                <div className="font-bold text-base text-[#FF6D00]">{supplier.name}</div>
                {supplier.category && (
                  <div className="text-slate-500 dark:text-slate-400 text-xs">
                    📦 {supplier.category}
                  </div>
                )}
                {supplier.phone && (
                  <div className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">📞</span> {supplier.phone}
                  </div>
                )}
                {supplier.address && (
                  <div className="text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                    <span className="text-[10px] text-slate-400 mt-0.5">📍</span>
                    <span className="leading-relaxed">{supplier.address}</span>
                  </div>
                )}
                {supplier.totalDebt != null && supplier.totalDebt > 0 && (
                  <div className="text-red-500 font-bold pt-1 border-t border-slate-200 dark:border-slate-700 mt-1">
                    Công nợ: {supplier.totalDebt.toLocaleString('vi-VN')}đ
                  </div>
                )}
              </div>

              {/* Bank Info */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm space-y-1.5">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">🏦 Thông tin ngân hàng</div>
                <div className="text-slate-600 dark:text-slate-400">
                  <span className="font-medium">NH:</span> {getBankShortName(supplier.bankName || '')}
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  <span className="font-medium">STK:</span> {supplier.bankAccount}
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Chủ TK:</span> {supplier.bankHolder || supplier.name}
                </div>
              </div>

              {/* Amount & Description inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Số tiền (VNĐ)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Nội dung chuyển khoản</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={100}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-[#FF6D00] outline-none transition-all dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div id="supplier-qr-code" className="bg-white p-3 rounded-xl">
                  <img
                    src={qrUrl || ''}
                    alt="QR Chuyển khoản"
                    width={220}
                    height={220}
                    className="rounded-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {hasBankInfo && (
          <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
            <button
              onClick={handleCopyInfo}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 transition-colors"
            >
              {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
              {copied ? 'Đã sao chép' : 'Sao chép TT'}
            </button>
            <button
              onClick={handleDownloadPNG}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF6D00] text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 hover:bg-[#E66000] active:scale-95 transition-all"
            >
              <Download size={18} />
              Tải QR
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierQRModal;
