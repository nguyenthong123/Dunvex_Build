import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Globe, Bell, LogOut, User, ShieldCheck, Key, HelpCircle, ChevronRight, BookOpen, CheckCircle2, Info } from 'lucide-react';

const AppSettings = () => {
	const navigate = useNavigate();
	const { theme, toggleTheme } = useTheme();
	const [showConfirmLogout, setShowConfirmLogout] = React.useState(false);
	const [activeGuide, setActiveGuide] = React.useState<string | null>(null);

	const handleLogout = async () => {
		try {
			await signOut(auth);
			navigate('/login');
		} catch (error) {
			console.error("Logout error:", error);
			alert("Đã xảy ra lỗi khi đăng xuất.");
		}
	};

	return (
		<div className="flex flex-col h-full bg-[#f8f9fb] dark:bg-slate-950 transition-colors duration-300">
			<header className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 transition-colors duration-300">
				<h2 className="text-[#1A237E] dark:text-indigo-400 text-lg md:text-2xl font-black uppercase tracking-tight">Cài Đặt Ứng Dụng</h2>
			</header>

			<div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
				<div className="max-w-2xl mx-auto space-y-6">

					{/* Theme Section */}
					<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
						<h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Giao diện & Hiển thị</h3>
						<div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
							<div className="flex items-center gap-4">
								<div className={`p-3 rounded-full ${theme === 'dark' ? 'bg-indigo-500 text-white' : 'bg-yellow-100 text-yellow-600'}`}>
									{theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
								</div>
								<div>
									<h4 className="font-bold text-slate-700 dark:text-white">Chế độ tối</h4>
									<p className="text-xs text-slate-500 dark:text-slate-400">Chuyển đổi giao diện sáng/tối</p>
								</div>
							</div>
							<label className="relative inline-flex items-center cursor-pointer">
								<input type="checkbox" className="sr-only peer" checked={theme === 'dark'} onChange={toggleTheme} />
								<div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#1A237E]"></div>
							</label>
						</div>
					</div>

					{/* Account & Logout Section */}
					<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
						<h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Tài khoản & Bảo mật</h3>

						<div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-4 flex items-center gap-4">
							<div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
								<User size={24} />
							</div>
							<div>
								<h4 className="font-bold text-slate-700 dark:text-white truncate max-w-[200px]">
									{auth.currentUser?.displayName || 'Người dùng'}
								</h4>
								<p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
									{auth.currentUser?.email}
								</p>
							</div>
						</div>

						{showConfirmLogout ? (
							<div className="p-4 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-200 dark:border-rose-900/30 animate-in zoom-in-95 duration-200">
								<p className="text-sm font-bold text-rose-700 dark:text-rose-400 text-center mb-4">
									Bạn chắc chắn muốn đăng xuất chứ?
								</p>
								<div className="flex gap-3">
									<button
										onClick={() => setShowConfirmLogout(false)}
										className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-sm border border-slate-200 dark:border-slate-700 active:scale-95 transition-transform"
									>
										Hủy
									</button>
									<button
										onClick={handleLogout}
										className="flex-1 py-3 px-4 bg-rose-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-rose-200 dark:shadow-none active:scale-95 transition-transform"
									>
										Xác nhận
									</button>
								</div>
							</div>
						) : (
							<button
								onClick={() => setShowConfirmLogout(true)}
								type="button"
								className="w-full flex items-center justify-between p-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/10 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl transition-colors group cursor-pointer"
							>
								<div className="flex items-center gap-4">
									<div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-full group-hover:scale-110 transition-transform">
										<LogOut size={24} />
									</div>
									<div className="text-left">
										<h4 className="font-bold">Đăng xuất khỏi hệ thống</h4>
										<p className="text-[10px] uppercase font-black opacity-60 tracking-wider">Thoát tài khoản ngay</p>
									</div>
								</div>
								<span className="material-symbols-outlined">chevron_right</span>
							</button>
						)}
					</div>

					{/* Pricing & Subscription Section */}
					<div className="bg-[#1A237E] dark:bg-indigo-950 p-6 rounded-[2rem] shadow-xl border border-indigo-400/20 text-white relative overflow-hidden">
						<div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
							<ShieldCheck size={120} />
						</div>
						<div className="relative z-10">
							<div className="flex items-center gap-3 mb-6">
								<div className="p-3 bg-white/10 text-white rounded-xl backdrop-blur-md">
									<Info size={24} />
								</div>
								<h3 className="text-lg font-bold uppercase tracking-tight">Gói dịch vụ & Chi phí</h3>
							</div>

							<div className="space-y-4">
								<div className="p-4 bg-white/5 rounded-2xl border border-white/10">
									<p className="text-xs font-black uppercase tracking-widest text-indigo-200 mb-2">Chính sách dùng thử</p>
									<p className="text-sm font-medium leading-relaxed">
										Mọi tài khoản mới được tặng **30 ngày dùng thử Premium (Full tính năng)** ngay sau khi đăng nhập lần đầu.
									</p>
								</div>

								<div className="p-4 bg-white/5 rounded-2xl border border-white/10">
									<p className="text-xs font-black uppercase tracking-widest text-indigo-200 mb-2">Chi phí duy trì (Premium)</p>
									<ul className="text-sm space-y-2 font-medium">
										<li>• **Gói Tháng:** 199.000đ / tháng</li>
										<li>• **Gói Năm:** 1.500.000đ / năm (Tiết kiệm 35%)</li>
									</ul>
								</div>

								<div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
									<p className="text-xs font-black uppercase tracking-widest text-rose-300 mb-2 underline">Hạn chế tài khoản Miễn phí (Free)</p>
									<p className="text-[11px] text-rose-100/90 leading-relaxed font-medium">
										Tại sao cần Premium? Nếu không nâng cấp sau 30 ngày dùng thử:
										<br />• **Mất kết nối:** Không thể đồng bộ dữ liệu sang Google Sheets.
										<br />• **Giới hạn quy mô:** Chỉ được lưu tối đa 50 khách hàng & 20 sản phẩm.
										<br />• **Giới hạn hiển thị:** Bản đồ chỉ hiển thị 10 khách hàng mới nhất.
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* Policy & Security Section */}
					<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
						<div className="flex items-center gap-3 mb-6">
							<div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
								<ShieldCheck size={24} />
							</div>
							<h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">Quyền truy cập & Bảo mật</h3>
						</div>

						<div className="space-y-4">
							<div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 font-medium">
								<div className="flex items-start gap-4">
									<Key className="text-indigo-500 mt-1 shrink-0" size={18} />
									<div className="space-y-1">
										<p className="text-sm font-bold text-slate-700 dark:text-white uppercase tracking-tight">Quyền truy cập GPS</p>
										<p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
											Ứng dụng yêu cầu quyền định vị để thực hiện Chấm công và Kiểm tra vị trí khách hàng. Chúng tôi cam kết tuyệt đối **không theo dõi ngầm** ngoài các thao tác này.
										</p>
									</div>
								</div>
							</div>

							<div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 font-medium">
								<div className="flex items-start gap-4">
									<CheckCircle2 className="text-emerald-500 mt-1 shrink-0" size={18} />
									<div className="space-y-1">
										<p className="text-sm font-bold text-slate-700 dark:text-white uppercase tracking-tight">An toàn dữ liệu Cloud</p>
										<p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
											Mọi biến động về đơn hàng và kho đều được mã hóa và lưu trữ tại hệ thống Firebase của Google, đảm bảo sẵn sàng 99.9% và bảo mật đa tầng.
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Comprehensive User Guide Section */}
					<div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
						<div className="flex items-center gap-3 mb-6">
							<div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
								<BookOpen size={24} />
							</div>
							<h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">Cẩm nang vận hành (Full)</h3>
						</div>

						<div className="grid grid-cols-1 gap-3">
							<GuideItem
								id="guide_cust"
								title="1. Quản lý Khách hàng"
								description="Tạo mới, định vị và lưu trữ thông tin đối tác."
								isActive={activeGuide === 'guide_cust'}
								onClick={() => setActiveGuide(activeGuide === 'guide_cust' ? null : 'guide_cust')}
								content={
									<div className="space-y-3 pt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
										<p>• **Vào đâu?** Tại thanh Menu dưới cùng {"->"} chọn biểu tượng khách hàng (thứ 2 từ phải sang).</p>
										<p>• **Nhập như thế nào?** Nhấn nút **(+) Thêm Khách**. Nhập Tên, SĐT, Địa chỉ. Sử dụng nút "Lấy vị trí" để lưu tọa độ GPS chính xác (bắt buộc để nhân viên Checkin sau này).</p>
										<p>• **Kiểm tra ở đâu?** Xem danh sách tại thẻ "Danh sách" hoặc tab "Bản đồ" để thấy vị trí trực quan trên map.</p>
										<p>• **Chỉnh sửa?** Nhấn vào thẻ khách hàng trong danh sách {"->"} Chọn icon Sửa (Hình cây bút). Cập nhật xong nhấn "Lưu".</p>
										<p className="text-amber-600 dark:text-amber-400 font-black">• **Lưu ý:** Luôn nhập đúng SĐT để có thể dùng phím tắt gọi điện trực tiếp cho khách từ ứng dụng.</p>
									</div>
								}
							/>
							<GuideItem
								id="guide_prod"
								title="2. Quản lý Sản phẩm"
								description="Cập nhật danh mục, giá niêm yết và tồn kho."
								isActive={activeGuide === 'guide_prod'}
								onClick={() => setActiveGuide(activeGuide === 'guide_prod' ? null : 'guide_prod')}
								content={
									<div className="space-y-3 pt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
										<p>• **Thêm mới:** Menu chính {"->"} **Sản phẩm** {"->"} Nút **(+)**. Nhập Tên, Đơn vị tính và Ảnh (nếu có).</p>
										<p>• **Giá nhập & Bán:** Phải nhập **Giá nhập** (để tính lợi nhuận gộp) và **Giá bán** (để lên đơn).</p>
										<p>• **Mã SKU:** Hệ thống tự tạo mã SKU định danh duy nhất cho từng sản phẩm giúp quản lý kho chính xác.</p>
									</div>
								}
							/>
							<GuideItem
								id="guide_order"
								title="3. Quy trình Lên đơn & Trừ kho"
								description="Tạo đơn hàng nhanh và quản lý tồn kho tự động."
								isActive={activeGuide === 'guide_order'}
								onClick={() => setActiveGuide(activeGuide === 'guide_order' ? null : 'guide_order')}
								content={
									<div className="space-y-3 pt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
										<p>• **Lên đơn:** Nhấn nút chính giữa **(+) Màu cam** {"->"} Chọn **Lên đơn**. Chọn Khách hàng {"->"} Chọn các Sản phẩm {"->"} Nhập số lượng.</p>
										<p>• **Check tồn kho:** Tại trang Sản phẩm, cột **Tồn kho** luôn hiển thị số lượng hiện tại. Khi bạn nhấn "Lưu đơn", kho sẽ tự động trừ đi số hàng đã bán.</p>
										<p>• **Lịch sử kho:** Muốn xem chi tiết xuất/nhập, vào Menu {"->"} **Đơn hàng** {"->"} Tab **Lịch sử kho**.</p>
									</div>
								}
							/>
							<GuideItem
								id="guide_debt"
								title="4. Kiểm tra Công nợ & Thu nợ"
								description="Đối soát dòng tiền nợ của từng khách hàng."
								isActive={activeGuide === 'guide_debt'}
								onClick={() => setActiveGuide(activeGuide === 'guide_debt' ? null : 'guide_debt')}
								content={
									<div className="space-y-3 pt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
										<p>• **Check nợ:** Menu {"->"} **Công nợ**. Phần tổng kết hiển thị "Tổng phải thu". Phía dưới là danh sách chi tiết từng khách hàng kèm số nợ.</p>
										<p>• **Thu nợ:** Khi khách trả tiền mặt/chuyển khoản, nhấn nút **Thu nợ** trên thanh điều hướng. Nhập số tiền thu được và chọn đúng tên khách. Hệ thống sẽ tự động đối trừ dư nợ ngay lập tức.</p>
										<p>• **Nguyên tắc:** Đơn hàng "Chưa thanh toán" mặc định sẽ trở thành dòng nợ mới trong sổ cái.</p>
									</div>
								}
							/>
							<GuideItem
								id="guide_price"
								title="5. Thao tác Báo giá (Price List)"
								description="Cách gửi báo giá nhanh chuyên nghiệp."
								isActive={activeGuide === 'guide_price'}
								onClick={() => setActiveGuide(activeGuide === 'guide_price' ? null : 'guide_price')}
								content={
									<div className="space-y-3 pt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
										<p>• **Tạo báo giá:** Menu {"->"} **Báo giá**. Tích chọn các sản phẩm bạn muốn khách xem {"->"} Nhấn "Tạo bảng báo giá".</p>
										<p>• **Chụp ảnh màn hình:** Sử dụng nút **Zoom 85%** để toàn bộ bảng giá hiện đầy đủ trong khung hình, giúp bạn dễ dàng chụp ảnh màn hình để gửi qua Zalo/Facebook cho khách.</p>
									</div>
								}
							/>
							<GuideItem
								id="guide_checkin"
								title="6. Hành động Checkin GPS"
								description="Quy trình viếng thăm thị trường và chấm công."
								isActive={activeGuide === 'guide_checkin'}
								onClick={() => setActiveGuide(activeGuide === 'guide_checkin' ? null : 'guide_checkin')}
								content={
									<div className="space-y-3 pt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
										<p>• **Thao tác:** Nút **(+) Màu cam** {"->"} **Checkin**. Chụp ảnh đại diện cửa hàng và lưu lại.</p>
										<p className="text-rose-600 dark:text-rose-400 font-black tracking-tight underline">• **ĐIỀU KIỆN TIÊN QUYẾT:** Bạn phải đứng trong bán kính tối đa 100m so với vị trí GPS đã lưu của khách hàng. Nếu quá xa, hệ thống sẽ BÁO LỖI và không cho phép ghi nhận hành động viếng thăm.</p>
										<p>• **Mục đích:** Giúp Admin kiểm soát tính thực thi của nhân viên thị trường một cách khách quan.</p>
									</div>
								}
							/>
						</div>
					</div>

					<div className="text-center text-xs text-slate-400 mt-8 pb-32">
						<p>Dunvex Build v1.0.1</p>
						<p>© 2026 Dunvex Technology</p>
					</div>

				</div>
			</div>
		</div>
	);
};

const GuideItem = ({ title, description, content, isActive, onClick }: any) => (
	<div className={`overflow-hidden transition-all duration-300 border ${isActive ? 'bg-slate-50 dark:bg-slate-800/50 border-indigo-200 dark:border-indigo-900/50 rounded-[1.5rem]' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}>
		<button
			onClick={onClick}
			className="w-full flex items-center justify-between p-5 text-left outline-none"
		>
			<div className="flex-1">
				<h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight mb-1">{title}</h4>
				<p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{description}</p>
			</div>
			<div className={`transition-transform duration-300 ${isActive ? 'rotate-90 text-indigo-500' : 'text-slate-300'}`}>
				<ChevronRight size={20} />
			</div>
		</button>
		<div className={`px-5 pb-5 transition-all duration-500 ${isActive ? 'max-h-[500px] opacity-100 border-t border-indigo-100 dark:border-indigo-900/30 font-medium' : 'max-h-0 opacity-0 overflow-hidden invisible'}`}>
			{content}
		</div>
	</div>
);

export default AppSettings;
