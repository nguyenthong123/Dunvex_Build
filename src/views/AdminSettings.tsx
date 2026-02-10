import React from 'react';
import { Settings, User, Bell, Shield, Database, Globe } from 'lucide-react';

const AdminSettings = () => {
	return (
		<>
			{/* HEADER */}
			<header className="h-16 md:h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-8 shrink-0">
				<h2 className="text-lg md:text-xl font-black text-[#1A237E] uppercase tracking-tight">Cài Đặt Hệ Thống</h2>
			</header>

			{/* CONTENT */}
			<div className="flex-1 p-4 md:p-8 max-w-4xl">
				<div className="grid grid-cols-1 gap-6">
					<SettingsSection
						icon={<User className="text-blue-600" size={20} />}
						title="Tài khoản cá nhân"
						description="Cập nhật thông tin profile và ảnh đại diện của bạn."
					/>
					<SettingsSection
						icon={<Bell className="text-orange-600" size={20} />}
						title="Thông báo"
						description="Cấu hình cách bạn nhận thông báo về đơn hàng và công nợ."
					/>
					<SettingsSection
						icon={<Shield className="text-emerald-600" size={20} />}
						title="Bảo mật"
						description="Thay đổi mật khẩu và quản lý các phiên đăng nhập."
					/>
					<SettingsSection
						icon={<Database className="text-purple-600" size={20} />}
						title="Dữ liệu & Đồng bộ"
						description="Quản lý kết nối Firebase và Google Sheets."
					/>
					<SettingsSection
						icon={<Globe className="text-slate-600" size={20} />}
						title="Ngôn ngữ & Vùng"
						description="Thay đổi định dạng tiền tệ và thời gian."
					/>
				</div>
			</div>
		</>
	);
};

const SettingsSection = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
	<div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
		<div className="flex items-center gap-4">
			<div className="size-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-white transition-colors">
				{icon}
			</div>
			<div className="flex-1">
				<h3 className="font-bold text-slate-900 group-hover:text-[#1A237E] transition-colors">{title}</h3>
				<p className="text-sm text-slate-500">{description}</p>
			</div>
			<div className="text-slate-300">
				<span className="material-symbols-outlined">chevron_right</span>
			</div>
		</div>
	</div>
);

export default AdminSettings;
