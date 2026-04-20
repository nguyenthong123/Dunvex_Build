import React from 'react';

interface InventoryActionButtonsProps {
	product: any;
	handleDeleteProduct: (id: string, bypassConfirm?: boolean) => void;
	openEdit: (product: any) => void;
	hasManagePermission: boolean;
	className?: string;
}

const InventoryActionButtons: React.FC<InventoryActionButtonsProps> = ({
	product,
	handleDeleteProduct,
	openEdit,
	hasManagePermission,
	className = "flex items-center justify-end gap-2"
}) => {
	const [showConfirm, setShowConfirm] = React.useState(false);

	if (!hasManagePermission) return null;

	return (
		<div className={className} onClick={(e) => e.stopPropagation()}>
			<button
				onClick={() => openEdit(product)}
				className="p-2 text-slate-300 dark:text-slate-600 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
				title="Chỉnh sửa"
			>
				<span className="material-symbols-outlined text-[20px]">edit</span>
			</button>

			{showConfirm ? (
				<div className="flex items-center gap-1 animate-in slide-in-from-right-2">
					<button
						onClick={() => setShowConfirm(false)}
						className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
					>
						Hủy
					</button>
					<button
						onClick={() => {
							handleDeleteProduct(product.id, true);
							setShowConfirm(false);
						}}
						className="px-3 py-1 bg-rose-500 text-white text-[10px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-600"
					>
						Xóa
					</button>
				</div>
			) : (
				<button
					onClick={() => setShowConfirm(true)}
					className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
					title="Xóa sản phẩm"
				>
					<span className="material-symbols-outlined text-[20px]">delete</span>
				</button>
			)}
		</div>
	);
};

export default InventoryActionButtons;
