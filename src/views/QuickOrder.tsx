import React, { useEffect } from 'react';
import { ArrowLeft, ShoppingCart, RotateCcw, Lock, Crown } from 'lucide-react';
import QRScanner from '../components/shared/QRScanner';
import OrderFormHeader from '../components/orders/OrderFormHeader';
import { OrderProductLines } from '../components/orders/OrderProductLines';
import OrderSummary from '../components/orders/OrderSummary';
import { OrderFooter } from '../components/orders/OrderFooter';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useOwner } from '../hooks/useOwner';
import { useToast } from '../components/shared/Toast';
import { useOrderForm } from '../hooks/useOrderForm';

const QuickOrder = () => {
	const navigate = useNavigate();
	const { id } = useParams();
	const location = useLocation();
	const owner = useOwner();
	const { showToast } = useToast();

	const form = useOrderForm({ owner, showToast, editId: id, location });

	// 🚀 Auto-navigate về danh sách đơn sau 1.2s, không cần nhấn nút
	useEffect(() => {
		if (form.showSuccessModal) {
			const timer = setTimeout(() => navigate('/orders'), 1200);
			return () => clearTimeout(timer);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [form.showSuccessModal]);

	if (owner.loading) return null;

	if (!form.hasOrderPermission) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 items-center justify-center text-center p-8 min-h-screen">
				<div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-full text-red-500 mb-4">
					<ShoppingCart size={48} />
				</div>
				<h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">Quyền hạn hạn chế</h2>
				<p className="text-slate-500 dark:text-slate-400 max-w-md">
					Bạn không có quyền thực hiện thao tác Lên đơn hàng / Cập nhật đơn hàng. Vui lòng liên hệ Admin.
				</p>
				<button onClick={() => navigate(-1)} className="mt-6 bg-[#1A237E] text-white px-6 py-2 rounded-xl font-bold">Quay lại</button>
			</div>
		);
	}

	if (owner.manualLockOrders) {
		return (
			<div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 items-center justify-center p-8 min-h-screen">
				<div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-6 border border-red-500/20">
					<Lock size={64} />
				</div>
				<h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mb-4 text-[#1A237E] dark:text-indigo-400 text-center">Tính Năng Bị Khóa</h1>
				<p className="text-slate-500 dark:text-slate-400 text-center max-w-md font-medium text-sm md:text-base leading-relaxed mb-8">
					Tài khoản của bạn đã bị khóa tính năng Lên Đơn. Vui lòng nâng cấp gói hoặc liên hệ Quản trị viên để mở khóa.
				</p>
				<button onClick={() => navigate('/pricing')} className="bg-[#1A237E] dark:bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest shadow-xl shadow-blue-900/20 md:hover:bg-blue-800 transition-all flex items-center gap-2">
					<Crown size={20} />
					Nâng Cấp Ngay
				</button>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 p-4 md:p-8 font-sans pb-32 md:pb-8 transition-colors duration-300">
			{/* TOP HEADER */}
			<div className="max-w-[1000px] mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
				<div className="flex items-center gap-4">
					<button
						onClick={() => navigate('/')}
						className="size-12 shrink-0 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-[#1A237E] dark:hover:text-indigo-400 hover:border-[#1A237E]/20 dark:hover:border-indigo-400/20 transition-all active:scale-90"
						title="Về Trang Chủ"
					>
						<RotateCcw size={20} />
					</button>
					<div>
						<h1 className="text-xl md:text-2xl font-black text-[#1c130d] dark:text-white flex items-center gap-2 uppercase tracking-tight leading-tight">
							📝 {id ? 'Chỉnh Sửa Đơn' : 'Lên Đơn Hàng Mới'}
						</h1>
						<p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-sm font-medium mt-1">Hoàn tất thông tin đơn hàng mới</p>
					</div>
				</div>
				<div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none pt-4 md:pt-0 border-slate-100 dark:border-slate-800">
					<button
						onClick={() => navigate('/orders')}
						className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-[#1c130d] dark:hover:text-white font-bold text-[11px] md:text-sm transition-colors group"
					>
						<ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
						Quay lại
					</button>
				</div>
			</div>

			<div className="max-w-[1000px] mx-auto space-y-6">

				{/* SECTION 1: CUSTOMER & STATUS */}
				<OrderFormHeader
					selectedCustomer={form.selectedCustomer}
					setSelectedCustomer={form.setSelectedCustomer}
					searchCustomerQuery={form.searchCustomerQuery}
					setSearchCustomerQuery={form.setSearchCustomerQuery}
					showCustomerResults={form.showCustomerResults}
					setShowCustomerResults={form.setShowCustomerResults}
					filteredCustomers={form.filteredCustomers}
					debtMap={form.debtMap}
					customerSearchRef={form.customerSearchRef}
					formatPrice={form.formatPrice}
					showToast={showToast}
					orderStatus={form.orderStatus}
					setOrderStatus={form.setOrderStatus}
					orderDate={form.orderDate}
					setOrderDate={form.setOrderDate}
					orderNote={form.orderNote}
					setOrderNote={form.setOrderNote}
					deliveryLocation={form.deliveryLocation}
					setDeliveryLocation={form.setDeliveryLocation}
					parsedLocation={form.parsedLocation}
					setParsedLocation={form.setParsedLocation}
					normalizeSmart={form.normalizeSmart}
				/>

				{/* SECTION 2: PRODUCT LIST */}
				<OrderProductLines
					lineItems={form.lineItems}
					updateLineItem={form.updateLineItem}
					removeLineItem={form.removeLineItem}
					addLineItem={form.addLineItem}
					activeRow={form.activeRow}
					setActiveRow={form.setActiveRow}
					activeField={form.activeField}
					setActiveField={form.setActiveField as any}
					dropdownRef={form.dropdownRef}
					lineSearchQuery={form.lineSearchQuery}
					setLineSearchQuery={form.setLineSearchQuery}
					categories={form.categories}
					products={form.products}
					getEffectiveStock={form.getEffectiveStock}
					copyToClipboard={form.copyToClipboard}
					setShowScanner={form.setShowScanner}
					normalizeText={form.normalizeText}
					isMatch={form.isMatch}
				/>

				{/* SECTION 3: ADJUSTMENTS & SUMMARY */}
				<OrderSummary
					couponCode={form.couponCode}
					setCouponCode={form.setCouponCode}
					handleApplyCoupon={form.handleApplyCoupon}
					shippingFee={form.shippingFee}
					setShippingFee={form.setShippingFee as any}
					discountAmt={form.discountAmt}
					setDiscountAmt={form.setDiscountAmt as any}
					subTotal={form.subTotal}
					finalTotal={form.finalTotal}
					totalWeight={form.totalWeight}
					totalCostActual={form.totalCostActual}
					totalProfitActual={form.totalProfitActual}
					overheadRate={form.overheadRate}
					hasOverheadItems={form.hasOverheadItems}
					isAdmin={form.isAdmin}
					showProfitPreview={form.showProfitPreview}
					setShowProfitPreview={form.setShowProfitPreview}
					handleConfirmOrder={form.handleConfirmOrder}
					isSubmitting={form.isSubmitting}
				/>
			</div>

			{/* STICKY BOTTOM BAR + SUCCESS MODAL */}
			<OrderFooter
				finalTotal={form.finalTotal}
				editId={id}
				handleConfirmOrder={form.handleConfirmOrder}
				isSubmitting={form.isSubmitting}
				showSuccessModal={form.showSuccessModal}
				setShowSuccessModal={form.setShowSuccessModal}
				onNavigateOrders={() => navigate('/orders')}
			/>

			<style dangerouslySetInnerHTML={{
				__html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                select { background-image: none !important; }
            `}} />

			{form.showScanner && (
				<QRScanner
					onScan={form.handleQRScan}
					onClose={() => form.setShowScanner(false)}
				/>
			)}
		</div>
	);
};

export default QuickOrder;
