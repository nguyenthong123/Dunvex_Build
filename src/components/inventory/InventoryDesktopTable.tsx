import React from 'react';
import InventoryActionButtons from './InventoryActionButtons';

interface InventoryDesktopTableProps {
	activeTab: string;
	loading: boolean;
	paginatedProducts: any[];
	products: any[];
	selectedIds: string[];
	toggleSelect: (id: string) => void;
	toggleSelectAll: () => void;
	openDetail: (product: any) => void;
	openEdit: (product: any) => void;
	handleDeleteProduct: (id: string, bypassConfirm?: boolean) => void;
	hasManagePermission: boolean;
	getImageUrl: (url: string) => string;
	formatPrice: (price: number) => string;
	copyToClipboard: (text: string, label: string) => void;
	expandedSkus: Set<string>;
	setExpandedSkus: React.Dispatch<React.SetStateAction<Set<string>>>;
	getProductInventoryStats: (id: string) => { import: number; export: number };
}

const InventoryDesktopTable: React.FC<InventoryDesktopTableProps> = ({
	activeTab,
	loading,
	paginatedProducts,
	products,
	selectedIds,
	toggleSelect,
	toggleSelectAll,
	openDetail,
	openEdit,
	handleDeleteProduct,
	hasManagePermission,
	getImageUrl,
	formatPrice,
	copyToClipboard,
	expandedSkus,
	setExpandedSkus,
	getProductInventoryStats
}) => {
	const allSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.includes(p.id));

	return (
		<div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
			<table className="w-full text-left">
				{activeTab === 'products' ? (
					<>
						<thead>
							<tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
								<th className="py-4 px-6 w-10">
									<input
										type="checkbox"
										className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
										checked={allSelected}
										onChange={toggleSelectAll}
									/>
								</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Sản phẩm</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">SKU / Số Seri</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-right">Giá Bán</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-center">Tồn kho</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-center">Trạng thái</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-right">Hành động</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 dark:divide-slate-800">
							{loading ? (
								[1, 2, 3, 4, 5].map(i => (
									<tr key={i} className="animate-pulse">
										<td className="py-4 px-6"><div className="size-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
										<td className="py-4 px-6"><div className="w-48 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
										<td className="py-4 px-6"><div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
										<td className="py-4 px-6"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
										<td className="py-4 px-6"><div className="w-12 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
										<td className="py-4 px-6"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
										<td className="py-4 px-6"><div className="w-20 h-8 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
									</tr>
								))
							) : paginatedProducts.length === 0 ? (
								<tr><td colSpan={7} className="py-8 text-center text-slate-400">Không tìm thấy sản phẩm nào</td></tr>
							) : (
								paginatedProducts.map((product) => (
									<tr key={product.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer ${selectedIds.includes(product.id) ? 'bg-indigo-50/30' : ''}`} onClick={() => openDetail(product)}>
										<td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
											<input
												type="checkbox"
												className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
												checked={selectedIds.includes(product.id)}
												onChange={() => toggleSelect(product.id)}
											/>
										</td>
										<td className="py-4 px-6">
											<div className="flex items-center gap-3">
												<div className="size-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-700">
													{product.imageUrl ? <img src={getImageUrl(product.imageUrl)} alt="" className="size-full object-cover" /> : <span className="material-symbols-outlined text-slate-300">image</span>}
												</div>
												<div>
													<div className="font-bold text-slate-900 dark:text-white">{product.name}</div>
													<div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{product.category}</div>
												</div>
											</div>
										</td>
										<td className="py-4 px-6">
											<div className="flex flex-col gap-0.5">
												<div className="flex items-center gap-1.5 group/sku" onClick={(e) => { e.stopPropagation(); copyToClipboard(product.sku || product.id, 'mã SKU'); }}>
													<span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{product.sku || 'N/A'}</span>
													<span className="material-symbols-outlined text-[14px] opacity-0 group-hover/sku:opacity-100 transition-opacity">content_copy</span>
												</div>
												{product.serialNumber && <div className="text-[9px] font-bold text-orange-500 uppercase">SN: {product.serialNumber}</div>}
											</div>
										</td>
										<td className="py-4 px-6 text-right">
											<div className="font-black text-[#1A237E] dark:text-indigo-400">{formatPrice(product.priceSell)}</div>
										</td>
										<td className="py-4 px-6 text-center">
											<div className={`text-sm font-black ${product.stock <= 5 ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}`}>{product.stock} {product.unit}</div>
										</td>
										<td className="py-4 px-6 text-center">
											<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${product.status === 'Kinh doanh' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
												{product.status || 'Kinh doanh'}
											</span>
										</td>
										<td className="py-4 px-6 text-right">
											<InventoryActionButtons 
												product={product}
												handleDeleteProduct={handleDeleteProduct}
												openEdit={openEdit}
												hasManagePermission={hasManagePermission}
											/>
										</td>
									</tr>
								))
							)}
						</tbody>
					</>
				) : (
					<>
						<thead>
							<tr className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
								<th className="py-4 px-6 w-10">
									<input
										type="checkbox"
										className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
										checked={allSelected}
										onChange={toggleSelectAll}
									/>
								</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-center">Hình ảnh</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest">Tên sản phẩm (Gộp)</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-center">Nhập kho</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-center">Xuất kho</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-center">Còn lại</th>
								<th className="py-4 px-6 text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest text-right">Hành động</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 dark:divide-slate-800">
							{loading ? (
								[1, 2, 3, 4, 5].map(i => (
									<tr key={i} className="animate-pulse">
										<td className="py-4 px-6"><div className="size-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
										<td className="py-4 px-2"><div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
										<td className="py-4 px-6">
											<div className="w-48 h-4 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
											<div className="w-20 h-3 bg-slate-200 dark:bg-slate-800 rounded opacity-60" />
										</td>
										<td className="py-4 px-6"><div className="w-12 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
										<td className="py-4 px-6"><div className="w-12 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
										<td className="py-4 px-6"><div className="w-12 h-6 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto" /></td>
										<td className="py-4 px-6"><div className="w-20 h-8 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
									</tr>
								))
							) : paginatedProducts.length === 0 ? (
								<tr><td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">Không tìm thấy sản phẩm nào</td></tr>
							) : (
								paginatedProducts.map((product) => (
									<React.Fragment key={product.groupKey || product.id}>
										<tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer ${selectedIds.includes(product.id) ? 'bg-indigo-50/30' : ''}`} onClick={() => openDetail(product)}>
											<td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
												<input
													type="checkbox"
													className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
													checked={selectedIds.includes(product.id)}
													onChange={() => toggleSelect(product.id)}
												/>
											</td>
											<td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
												<div className="size-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-700 mx-auto">
													{product.imageUrl ? (
														<img src={getImageUrl(product.imageUrl)} alt="" className="size-full object-cover" />
													) : (
														<span className="material-symbols-outlined text-slate-300">image</span>
													)}
												</div>
											</td>
											<td className="py-4 px-6">
												<div className="flex items-center gap-2">
													<div className="font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-indigo-400 transition-colors">
														{product.name}
													</div>
													<div className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-0.5">
														{product.sku || 'N/A'}
													</div>
													{product.aiHealth && (
														<span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-sm animate-pulse ${
															product.aiHealth === 'hot' ? 'bg-orange-100 text-orange-600 border border-orange-200' :
															product.aiHealth === 'urgent' ? 'bg-rose-100 text-rose-600 border border-rose-200' :
															product.aiHealth === 'stale' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
															'hidden'
														}`}>
															{product.aiHealth === 'hot' ? '🔥 Bán chạy' : 
															 product.aiHealth === 'urgent' ? '⚠️ Sắp hết' : 
															 '💤 Đọng vốn'}
														</span>
													)}
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
															className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all ${expandedSkus.has(product.groupKey)
																? 'bg-blue-600 text-white border-blue-600'
																: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/50'
																}`}
														>
															<span className="text-[8px] font-black uppercase">Nhóm SKU</span>
															<span className={`material-symbols-outlined text-[12px] transition-transform duration-300 ${expandedSkus.has(product.groupKey) ? 'rotate-180' : ''}`}>
																keyboard_arrow_down
															</span>
														</button>
													)}
												</div>
												<div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5 opacity-60">
													{product.category}
												</div>
											</td>
											<td className="py-4 px-6 text-center bg-slate-50/50 dark:bg-slate-800/30">
												<div className="flex flex-col items-center">
													<span className="text-sm font-black text-slate-600 dark:text-slate-300">
														{product.skuImport}
													</span>
													<span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{product.unit}</span>
												</div>
											</td>
											<td className="py-4 px-6 text-center">
												<div className="flex flex-col items-center">
													<span className="text-sm font-black text-orange-600 dark:text-orange-400">
														{product.skuExport}
													</span>
													<span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{product.unit}</span>
												</div>
											</td>
											<td className="py-4 px-6 text-center bg-indigo-50/30 dark:bg-indigo-900/10">
												<div className="flex flex-col items-center">
													<span className={`text-base font-black ${product.stock <= 5 ? 'text-rose-500' : 'text-[#1A237E] dark:text-indigo-400'}`}>
														{product.stock}
													</span>
													<span className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{product.unit}</span>
												</div>
											</td>
											<td className="py-4 px-6 text-right">
												<InventoryActionButtons 
													product={product}
													handleDeleteProduct={(id) => handleDeleteProduct(id, true)}
													openEdit={openEdit}
													hasManagePermission={hasManagePermission}
												/>
											</td>
										</tr>

										{/* Expanded Child Rows */}
										{product.isGrouped && expandedSkus.has(product.groupKey) && product.memberIds.map((memberId: string) => {
											const member = products.find(p => p.id === memberId);
											if (!member) return null;
											const mStats = getProductInventoryStats(member.id);
											return (
												<tr key={member.id} className="bg-slate-50/40 dark:bg-slate-800/20 border-l-4 border-blue-400/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors group/child cursor-pointer" onClick={() => openDetail(member)}>
													<td className="py-3 px-6"></td>
													<td className="py-3 px-2">
														<span className="text-[10px] font-bold text-slate-400">{member.sku || member.id.slice(-6).toUpperCase()}</span>
													</td>
													<td className="py-3 px-6">
														<div className="flex items-center gap-2">
															<span className="text-xs font-bold text-slate-600 dark:text-slate-300">{member.name}</span>
															{member.spec && <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1 rounded text-slate-400">{member.spec}</span>}
														</div>
														<div className="text-[9px] font-black text-blue-500/70 uppercase">Giá: {formatPrice(member.priceSell)}</div>
													</td>
													<td className="py-3 px-6 text-center opacity-60">
														<span className="text-xs font-bold text-slate-500">{mStats.import}</span>
													</td>
													<td className="py-3 px-6 text-center opacity-60">
														<span className="text-xs font-bold text-slate-500">{mStats.export}</span>
													</td>
													<td className="py-3 px-6 text-center">
														<span className={`text-xs font-black ${member.stock <= 5 ? 'text-rose-400' : 'text-slate-500'}`}>{member.stock}</span>
													</td>
													<td className="py-3 px-6 text-right">
														<InventoryActionButtons 
															product={member}
															handleDeleteProduct={(id) => handleDeleteProduct(id, true)}
															openEdit={openEdit}
															hasManagePermission={hasManagePermission}
														/>
													</td>
												</tr>
											);
										})}
									</React.Fragment>
								))
							)}
						</tbody>
					</>
				)}
			</table>
		</div>
	);
};

export default InventoryDesktopTable;
