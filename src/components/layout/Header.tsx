import { Bell } from 'lucide-react';

interface HeaderProps {
	userName?: string;
	avatarUrl?: string;
	showRevenue?: boolean;
}

const Header = ({ userName = "Tuấn Anh", avatarUrl, showRevenue = true }: HeaderProps) => {
	return (
		<header className="bg-primary text-white pt-8 pb-12 px-6 rounded-b-[2rem] shadow-lg relative overflow-hidden">
			{/* Background decorative circles */}
			<div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

			<div className="relative z-10 flex justify-between items-start mb-8">
				<div className="flex gap-3 items-center">
					<div className="h-12 w-12 rounded-full border-2 border-white/30 overflow-hidden bg-gray-200">
						{avatarUrl ? (
							<img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
						) : (
							<div className="h-full w-full flex items-center justify-center bg-accent text-white font-bold">
								{userName.charAt(0)}
							</div>
						)}
					</div>
					<div>
						<p className="text-white/80 text-sm font-medium">Xin chào,</p>
						<h2 className="text-xl font-bold leading-tight">{userName}</h2>
					</div>
				</div>
				<button className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
					<Bell size={24} />
				</button>
			</div>

			{showRevenue && (
				<div className="relative z-10">
					<p className="text-white/70 text-sm mb-1 font-medium">Doanh thu hôm nay</p>
					<h1 className="text-4xl font-extrabold tracking-tight">
						152.000.000 <span className="text-2xl font-bold align-top">đ</span>
					</h1>
					<div className="flex items-center gap-1 mt-2 text-green-300 text-sm font-medium bg-white/10 w-fit px-2 py-1 rounded-md">
						<span className="material-symbols-outlined text-sm">trending_up</span>
						<span>+12.5% so với hôm qua</span>
					</div>
				</div>
			)}
		</header>
	);
};

export default Header;
