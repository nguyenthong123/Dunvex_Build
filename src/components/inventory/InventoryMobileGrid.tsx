import React from 'react';
import InventoryActionButtons from './InventoryActionButtons';

interface InventoryMobileGridProps {
	activeTab: string;
	loading: boolean;
	paginatedProducts: any[];
	products: any[];
	openDetail: (product: any) => void;
	openEdit: (product: any) => void;
	handleDeleteProduct: (id: string, bypassConfirm?: boolean) => void;
	hasManagePermission: boolean;
	getImageUrl: (url: string) => string;
	formatPrice: (price: number) => string;
	getProductInventoryStats: (id: string) => { import: number; export: number };
	expandedSkus: Set<string>;
	setExpandedSkus: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const InventoryMobileGrid: React.FC<InventoryMobileGridProps> = ({
	activeTab,
	loading,
	paginatedProducts,
	products,
	openDetail,
	openEdit,
	handleDeleteProduct,
	hasManagePermission,
	getImageUrl,
	formatPrice,
	getProductInventoryStats,
	expandedSkus,
	setExpandedSkus
}) => {
	if (loading) {
		return (
			<div className="md:hidden pb-4 space-y-4">
				{[1, 2, 3].map(i => (
					<div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-slate-800 animate-pulse">
						<div className="flex gap-3">
							<div className="size-14 rounded-xl bg-slate-200 dark:bg-slate-800" />
							<div className="space-y-2 flex-1">
								<div className="w-3/4 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
								<div className="w-1/2 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
							</div>
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="md:hidden pb-4 relative">
			<div className="grid grid-cols-1 gap-4 pb-12">
				{activeTab === 'products' ? (
					paginatedProducts.map((product) => (
						<div key={product.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-slate-800 flex flex-col justify-between" onClick={() => openDetail(product)}>
							<div className="flex justify-between items-start mb-4">
								<div className="flex items-center gap-3 flex-1 min-w-0">
									<div className="size-14 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center overflow-hidden border border-gray-100 dark:border-slate-700 shrink-0">
										{product.imageUrl ? <img src={getImageUrl(product.imageUrl)} alt={product.name} className="size-full object-cover" /> : <span className="material-symbols-outlined text-2xl">package_2</span>}
									</div>
									<div className="flex-1 min-w-0">
										<h4 className="font-black text-slate-900 dark:text-white line-clamp-2 whitespace-normal break-words">{product.name}</h4>
										<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{product.category}</p>
										<p className="text-[10px] font-black text-blue-500 uppercase mt-1">SKU: {product.sku || 'N/A'}</p>
									</div>
								</div>
								<div className="text-right">
									<div className="text-xs font-black text-slate-900 dark:text-white">{formatPrice(product.priceSell)}</div>
									<div className={`text-[10px] font-bold mt-1 ${product.stock <= 5 ? 'text-rose-500' : 'text-slate-400'}`}>Tồn: {product.stock} {product.unit}</div>
								</div>
							</div>
							<div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
								<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${product.status === 'Kinh doanh' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
									{product.status || 'Kinh doanh'}
								</span>
								<InventoryActionButtons 
									product={product}
									handleDeleteProduct={handleDeleteProduct}
									openEdit={openEdit}
									hasManagePermission={hasManagePermission}
								/>
							</div>
						</div>
					))
				) : (
					paginatedProducts.map((product) => (
						<div key={product.groupKey || product.id} className="flex flex-col gap-2">
							<div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-slate-800" onClick={() => openDetail(product)}>
								<div className="flex justify-between items-start mb-3">
									<div className="flex items-center gap-3 flex-1 min-w-0">
										<div className="size-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-700 shrink-0">
											{product.imageUrl ? (
												<img src={getImageUrl(product.imageUrl)} alt="" className="size-full object-cover" />
											) : (
												<span className="material-symbols-outlined text-slate-300">image</span>
											)}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">
												SKU: {product.sku || '#' + (product.id || '').slice(-6).toUpperCase()}
											</p>
											<h4 className="font-black text-slate-900 dark:text-white text-base leading-tight line-clamp-2 whitespace-normal break-words">
												{product.name}
											</h4>
										</div>
									</div>
									<div className={`px-3 py-1.5 rounded-xl text-center min-w-[70px] ${product.stock <= 5 ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600' : 'bg-indigo-50 dark:bg-indigo-900/20 text-[#1A237E] dark:text-indigo-400'}`}>
										<div className="text-sm font-black leading-none">{product.stock}</div>
										<div className="text-[8px] font-black uppercase mt-0.5">{product.unit}</div>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-2 mb-4">
									<div className="bg-slate-50/50 dark:bg-slate-800/30 p-2 rounded-lg text-center">
										<p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Tổng nhập</p>
										<p className="text-xs font-bold text-slate-600 dark:text-slate-400">{product.skuImport}</p>
									</div>
									<div className="bg-slate-50/50 dark:bg-slate-800/30 p-2 rounded-lg text-center">
										<p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Tổng xuất</p>
										<p className="text-xs font-bold text-orange-600">{product.skuExport}</p>
									</div>
								</div>

								<div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-50 dark:border-slate-800">
									{product.isGrouped && (
										<button
											onClick={(e) => {
												e.stopPropagation();
												setExpandedSkus(prev => {
													const next = new Set(prev);
													if (next.has(product.groupKey)) next.delete(product.groupKey);
													else next.add(product.groupKey);
													return next;
												});
											}}
											className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${expandedSkus.has(product.groupKey)
												? 'bg-blue-600 text-white border-blue-600'
												: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/50'
												}`}
										>
											<span className="text-[10px] font-black uppercase">
												{expandedSkus.has(product.groupKey) ? 'Thu gọn' : `Xem ${product.memberIds.length} bản ghi`}
											</span>
											<span className={`material-symbols-outlined text-[16px] transition-transform duration-300 ${expandedSkus.has(product.groupKey) ? 'rotate-180' : ''}`}>
												keyboard_arrow_down
											</span>
										</button>
									)}
									<InventoryActionButtons 
										product={product}
										handleDeleteProduct={(id) => handleDeleteProduct(id, true)}
										openEdit={openEdit}
										hasManagePermission={hasManagePermission}
									/>
								</div>
							</div>

							{product.isGrouped && expandedSkus.has(product.groupKey) && (
								<div className="space-y-2 ml-4 relative before:absolute before:left-[-12px] before:top-0 before:bottom-0 before:w-0.5 before:bg-blue-100 dark:before:bg-blue-900/30">
									{product.memberIds.map((memberId: string) => {
										const member = products.find(p => p.id === memberId);
										if (!member) return null;
										const mStats = getProductInventoryStats(member.id);
										return (
											<div key={member.id} className="bg-white/60 dark:bg-slate-900/60 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800" onClick={() => openDetail(member)}>
												<div className="flex justify-between items-center">
													<div className="min-w-0">
														<p className="text-[8px] font-bold text-slate-400 truncate">SN: {member.serialNumber || member.id.slice(-6)}</p>
														<p className="text-xs font-black text-slate-700 dark:text-slate-300 truncate">{member.name}</p>
													</div>
													<div className="flex items-center gap-3">
														<div className="text-right">
															<span className={`text-xs font-black ${member.stock <= 5 ? 'text-rose-500' : 'text-slate-500'}`}>{member.stock}</span>
															<span className="text-[8px] font-bold text-slate-400 ml-0.5">{member.unit}</span>
														</div>
														<InventoryActionButtons 
															product={member}
															handleDeleteProduct={(id) => handleDeleteProduct(id, true)}
															openEdit={openEdit}
															hasManagePermission={hasManagePermission}
															className="flex items-center gap-1"
														/>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default InventoryMobileGrid;
