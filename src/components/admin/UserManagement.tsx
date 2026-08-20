import React from 'react';
import { Plus, XCircle, Edit3, Trash2 } from 'lucide-react';

export const UserManagement = ({ userList, showAdd, onShowAdd, newUser, setNewUser, handleAddUser, onUpdateRole, onDelete, editingUser, setEditingUser, handleUpdateUser }: any) => {
	const [deletingUserId, setDeletingUserId] = React.useState<string | null>(null);

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h2 className="text-xl font-black uppercase text-slate-800 dark:text-white tracking-tight">Danh sách nhân sự</h2>
				<button onClick={() => onShowAdd(true)} className="flex items-center gap-2 bg-[#FF6D00] text-white px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"><Plus size={16} /> Thêm nhân viên</button>
			</div>

			{/* Add User Form */}
			{showAdd && (
				<div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
					<h3 className="font-bold text-lg mb-4 dark:text-white">Mời nhân viên mới</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-1">
							<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên hiển thị</label>
							<input type="text" placeholder="VD: Nguyễn Văn A" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={newUser.displayName} onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} />
						</div>
						<div className="space-y-1">
							<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email</label>
							<input type="email" placeholder="email@gmail.com" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
						</div>
						<div className="space-y-1">
							<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mật khẩu (mặc định: 123456)</label>
							<input type="text" placeholder="Để trống để dùng mật khẩu 123456" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
						</div>
						<div className="space-y-1">
							<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vai trò</label>
							<select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
								<option value="sale">Nhân viên Sale</option>
								<option value="warehouse">Thủ kho</option>
								<option value="accountant">Kế toán</option>
								<option value="admin">Quản trị viên</option>
							</select>
						</div>
					</div>
					<div className="flex justify-end gap-3 mt-4">
						<button onClick={() => onShowAdd(false)} className="px-6 py-2 text-slate-500 dark:text-slate-400 font-bold text-sm hover:text-slate-700 transition-colors">Hủy</button>
						<button onClick={handleAddUser} className="px-6 py-2 bg-[#1A237E] dark:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none hover:opacity-90 transition-all">Gửi lời mời</button>
					</div>
				</div>
			)}

			{/* Edit User Form/Modal */}
			{editingUser && (
				<div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
					<div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-8">
						<div className="flex justify-between items-center mb-6">
							<div>
								<h3 className="text-xl font-black uppercase text-[#1A237E] dark:text-indigo-400">Chỉnh sửa nhân sự</h3>
								<p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{editingUser.email}</p>
							</div>
							<button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><XCircle size={24} /></button>
						</div>

						<div className="space-y-5">
							<div className="space-y-2">
								<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên hiển thị</label>
								<input
									type="text"
									className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
									value={editingUser.displayName}
									onChange={e => setEditingUser({ ...editingUser, displayName: e.target.value })}
								/>
							</div>

							<div className="space-y-2">
								<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vai trò</label>
								<select
									className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
									value={editingUser.role}
									onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
								>
									<option value="sale">Nhân viên Sale</option>
									<option value="warehouse">Thủ kho</option>
									<option value="accountant">Kế toán</option>
									<option value="admin">Quản trị viên</option>
								</select>
							</div>

							<div className="space-y-2">
								<label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">💰 Lương / tháng (VNĐ)</label>
								<input
									type="number"
									className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
									value={editingUser.monthlyWage || ''}
									onChange={e => setEditingUser({ ...editingUser, monthlyWage: e.target.value })}
									placeholder="VD: 8000000"
								/>
								{editingUser.monthlyWage > 0 && (
									<p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold px-1">
										≈ {Math.round(Number(editingUser.monthlyWage) / 26).toLocaleString('vi-VN')}đ/ngày (26 ngày công)
									</p>
								)}
							</div>

							<div className="flex gap-3 pt-4">
								<button onClick={() => setEditingUser(null)} className="flex-1 px-4 py-3 text-slate-500 dark:text-slate-400 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">Bỏ qua</button>
								<button onClick={handleUpdateUser} className="flex-1 px-4 py-3 bg-[#1A237E] dark:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all">Lưu thay đổi</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Desktop View */}
			<div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
				<div className="overflow-x-auto custom-scrollbar">
					<table className="w-full text-left min-w-[700px]">
						<thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-400">
							<tr><th className="px-6 py-4">Nhân viên</th><th className="px-6 py-4">Vai trò</th><th className="px-6 py-4">Trạng thái</th><th className="px-6 py-4 text-right">Hành động</th></tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
							{userList.map((user: any) => (
								<tr key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
									<td className="px-6 py-4">
										<div className="font-bold text-sm dark:text-white">{user.displayName || 'Guest'}</div>
										<div className="text-[10px] text-slate-400 font-bold lowercase">{user.email}</div>
									</td>
									<td className="px-6 py-4">
										<span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">
											{user.role === 'admin' ? 'Quản trị' : user.role === 'sale' ? 'Sale' : user.role === 'warehouse' ? 'Kho' : 'Kế toán'}
										</span>
									</td>
									<td className="px-6 py-4">
										<span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${user.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
											{user.status === 'active' ? 'Đã kích hoạt' : 'Chờ xác nhận'}
										</span>
									</td>
									<td className="px-6 py-4 text-right">
										{deletingUserId === user.id ? (
											<div className="flex items-center justify-end gap-2 animate-in fade-in zoom-in-95 duration-200">
												<span className="text-[11px] text-rose-500 font-extrabold dark:text-rose-400 mr-1 animate-pulse">Xác nhận xóa?</span>
												<button
													onClick={(e) => {
														e.stopPropagation();
														e.preventDefault();
														onDelete(user);
														setDeletingUserId(null);
													}}
													className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-rose-600 active:scale-95 transition-all shadow-md shadow-rose-500/20"
												>
													Có
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														e.preventDefault();
														setDeletingUserId(null);
													}}
													className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase active:scale-95 transition-all"
												>
													Hủy
												</button>
											</div>
										) : (
											<div className="flex items-center justify-end gap-2">
												<button
													onClick={(e) => {
														e.stopPropagation();
														e.preventDefault();
														setEditingUser(user);
													}}
													className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
													title="Chỉnh sửa"
												>
													<Edit3 size={18} />
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														e.preventDefault();
														setDeletingUserId(user.id);
													}}
													className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
													title="Xóa nhân viên"
												>
													<Trash2 size={18} />
												</button>
											</div>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Mobile View */}
			<div className="md:hidden space-y-4">
				{userList.map((user: any) => (
					<div key={user.id} className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
						<div className="flex justify-between items-start">
							<div>
								<div className="font-bold text-base dark:text-white">{user.displayName || 'Guest'}</div>
								<div className="text-[10px] text-slate-400 font-bold lowercase">{user.email}</div>
							</div>
							<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-300 uppercase tracking-tight">
								{user.role === 'admin' ? 'Quản trị' : user.role === 'sale' ? 'Sale' : user.role === 'warehouse' ? 'Kho' : 'Kế toán'}
							</span>
						</div>
						
						<div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-slate-800/50">
							<span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${user.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
								{user.status === 'active' ? 'Đã kích hoạt' : 'Chờ xác nhận'}
							</span>
							
							<div className="flex items-center gap-2">
								{deletingUserId === user.id ? (
									<div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
										<span className="text-[9px] text-rose-500 font-extrabold mr-1 animate-pulse">Xóa?</span>
										<button
											onClick={(e) => {
												e.stopPropagation();
												e.preventDefault();
												onDelete(user);
												setDeletingUserId(null);
											}}
											className="px-2 py-1.5 bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase"
										>
											Có
										</button>
										<button
											onClick={(e) => {
												e.stopPropagation();
												e.preventDefault();
												setDeletingUserId(null);
											}}
											className="px-2 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black uppercase"
										>
											Không
										</button>
									</div>
								) : (
									<div className="flex items-center gap-1">
										<button
											onClick={(e) => {
												e.stopPropagation();
												e.preventDefault();
												setEditingUser(user);
											}}
											className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
											title="Chỉnh sửa"
										>
											<Edit3 size={18} />
										</button>
										<button
											onClick={(e) => {
												e.stopPropagation();
												e.preventDefault();
												setDeletingUserId(user.id);
											}}
											className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
											title="Xóa nhân viên"
										>
											<Trash2 size={18} />
										</button>
									</div>
								)}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};
