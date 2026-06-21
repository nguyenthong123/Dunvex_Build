import React, { useState } from 'react';
import { updateDoc, doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { useToast } from '../shared/Toast';

interface InventoryActionModalProps {
	show: boolean;
	onClose: () => void;
	products: any[];
	owner: any;
	initialProduct?: any;
}

const InventoryActionModal: React.FC<InventoryActionModalProps> = ({ show, onClose, products, owner, initialProduct }) => {
	const { showToast } = useToast();
	const [type, setType] = useState<'import' | 'export'>('import');
	const [selectedItems, setSelectedItems] = useState<{product: any, quantity: number}[]>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [note, setNote] = useState('');
	const [loading, setLoading] = useState(false);

	React.useEffect(() => {
		if (show) {
			if (initialProduct) {
				setSelectedItems([{ product: initialProduct, quantity: 1 }]);
			} else {
				setSelectedItems([]);
			}
			setSearchQuery('');
			setNote('');
			setType('import');
		}
	}, [show, initialProduct]);

	if (!show) return null;

	const filteredProducts = products.filter(p => 
		p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
		(p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	const handleSelect = (product: any) => {
		if (!selectedItems.find(i => i.product.id === product.id)) {
			setSelectedItems([...selectedItems, { product, quantity: 1 }]);
		}
		setSearchQuery('');
	};

	const handleQuantityChange = (id: string, qty: number) => {
		setSelectedItems(selectedItems.map(i => i.product.id === id ? { ...i, quantity: qty } : i));
	};

	const handleRemove = (id: string) => {
		setSelectedItems(selectedItems.filter(i => i.product.id !== id));
	};

	const handleSubmit = async () => {
		if (selectedItems.length === 0) {
			showToast('Vui lòng chọn ít nhất 1 sản phẩm', 'warning');
			return;
		}
		if (!owner?.ownerId) {
			showToast('Lỗi: Không xác định được chủ cửa hàng', 'error');
			return;
		}
		setLoading(true);
		try {
			// Validate all items have required fields
			for (const item of selectedItems) {
				if (!item.product?.id) {
					throw new Error('Sản phẩm không hợp lệ: thiếu ID');
				}
				if (typeof item.product.stock !== 'number') {
					throw new Error(`Sản phẩm "${item.product.name || '?'}" không có số lượng tồn kho`);
				}
			}

			const actionLabel = type === 'import' ? 'Nhập kho' : 'Xuất kho';
			const userName = auth?.currentUser?.displayName || auth?.currentUser?.email || 'Unknown';

			// Create log first
			const logData = {
				action: actionLabel,
				type: type,
				items: selectedItems.map(i => ({
					productId: i.product.id,
					name: i.product.name,
					sku: i.product.sku || '',
					quantity: i.quantity,
					previousStock: i.product.stock,
					newStock: type === 'import' ? i.product.stock + i.quantity : i.product.stock - i.quantity
				})),
				note,
				createdAt: serverTimestamp(),
				ownerId: owner.ownerId,
				user: userName
			};

			console.log('[InventoryAction] Saving log:', { actionLabel, itemCount: selectedItems.length, ownerId: owner.ownerId });
			await addDoc(collection(db, 'inventory_logs'), logData);
			console.log('[InventoryAction] Log saved OK');

			// Update product stocks
			for (const item of selectedItems) {
				const newStock = type === 'import' ? item.product.stock + item.quantity : item.product.stock - item.quantity;
				console.log(`[InventoryAction] Updating ${item.product.id}: ${item.product.stock} → ${newStock}`);
				await updateDoc(doc(db, 'products', item.product.id), {
					stock: newStock
				});
				console.log(`[InventoryAction] Updated ${item.product.id} OK`);
			}

			showToast(`Đã lưu phiếu ${actionLabel.toLowerCase()} thành công!`, 'success');
			onClose();
			setSelectedItems([]);
			setNote('');
		} catch (error: any) {
			console.error('[InventoryAction] Error:', error);
			showToast('Lỗi khi lưu: ' + (error?.message || 'Không xác định'), 'error');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
				<div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-[2rem]">
					<div>
						<h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Tạo Phiếu Kho</h2>
						<p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Nhập / Xuất hàng hóa</p>
					</div>
					<button onClick={onClose} className="size-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors shadow-sm">
						<span className="material-symbols-outlined font-bold">close</span>
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-6 space-y-6">
					<div className="flex gap-4">
						<button 
							onClick={() => setType('import')}
							className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${type === 'import' ? 'border-[#1A237E] bg-[#1A237E]/5 text-[#1A237E] dark:border-indigo-500 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-700 text-slate-400'}`}
						>
							Phiếu Nhập Kho
						</button>
						<button 
							onClick={() => setType('export')}
							className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${type === 'export' ? 'border-[#FF6D00] bg-orange-50 text-[#FF6D00] dark:border-orange-500 dark:text-orange-400' : 'border-slate-200 dark:border-slate-700 text-slate-400'}`}
						>
							Phiếu Xuất Kho
						</button>
					</div>

					<div className="relative">
						<span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
						<input 
							type="text" 
							placeholder="Tìm và chọn sản phẩm..."
							className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-slate-900 dark:text-white font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
						/>
						{searchQuery && (
							<div className="absolute top-full mt-2 w-full max-h-60 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-10 p-2 space-y-1">
								{filteredProducts.slice(0, 10).map(p => (
									<div key={p.id} onClick={() => handleSelect(p)} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer flex justify-between items-center">
										<div>
											<p className="font-bold text-sm text-slate-900 dark:text-white">{p.name}</p>
											<p className="text-[10px] text-slate-500 font-bold uppercase">{p.sku || 'N/A'} • Tồn: {p.stock}</p>
										</div>
										<span className="material-symbols-outlined text-indigo-500">add_circle</span>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="space-y-3">
						<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh sách sản phẩm ({selectedItems.length})</label>
						{selectedItems.length === 0 ? (
							<div className="py-8 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-widest">Chưa chọn sản phẩm nào</div>
						) : (
							selectedItems.map(item => (
								<div key={item.product.id} className="flex items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
									<div className="flex-1">
										<p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{item.product.name}</p>
										<p className="text-[10px] text-slate-500 font-bold uppercase">Tồn hiện tại: {item.product.stock}</p>
									</div>
									<div className="flex items-center gap-2">
										<input 
											type="number" 
											min="1"
											value={item.quantity}
											onChange={(e) => handleQuantityChange(item.product.id, Number(e.target.value))}
											className="w-20 text-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 font-black text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-500"
										/>
										<button onClick={() => handleRemove(item.product.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors">
											<span className="material-symbols-outlined text-lg">delete</span>
										</button>
									</div>
								</div>
							))
						)}
					</div>

					<div>
						<label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Ghi chú / Lý do</label>
						<textarea
							rows={3}
							className="w-full bg-slate-100/50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none resize-none"
							placeholder="Nhập lý do nhập/xuất kho..."
							value={note}
							onChange={e => setNote(e.target.value)}
						></textarea>
					</div>
				</div>

				<div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-b-[2rem] flex justify-end gap-3">
					<button 
						onClick={onClose}
						className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
					>
						Hủy bỏ
					</button>
					<button 
						onClick={handleSubmit}
						disabled={selectedItems.length === 0 || loading}
						className="px-6 py-2.5 rounded-xl font-bold bg-[#1A237E] text-white disabled:opacity-50 hover:bg-indigo-700 transition-colors flex items-center gap-2"
					>
						{loading ? <span className="material-symbols-outlined animate-spin">sync</span> : null}
						Lưu Phiếu {type === 'import' ? 'Nhập' : 'Xuất'}
					</button>
				</div>
			</div>
		</div>
	);
};

export default InventoryActionModal;
