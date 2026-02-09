import { Package, ChevronRight, Clock } from 'lucide-react';

interface OrderCardProps {
	id: string;
	customerName: string;
	total: number;
	status: 'pending' | 'completed' | 'cancelled';
	time: string;
}

const OrderCard = ({ id, customerName, total, status, time }: OrderCardProps) => {
	const statusConfig = {
		pending: { label: 'Chờ xử lý', color: 'bg-orange-100 text-orange-600' },
		completed: { label: 'Hoàn thành', color: 'bg-green-100 text-green-600' },
		cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-600' }
	};

	return (
		<div className="card active:scale-[0.98] transition-transform">
			<div className="flex justify-between items-start mb-3">
				<div className="flex gap-3">
					<div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
						<Package size={24} />
					</div>
					<div>
						<h4 className="font-bold text-gray-900 group-hover:text-primary transition-colors">#{id}</h4>
						<p className="text-gray-500 text-xs flex items-center gap-1">
							<Clock size={12} /> {time}
						</p>
					</div>
				</div>
				<span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${statusConfig[status].color}`}>
					{statusConfig[status].label}
				</span>
			</div>

			<div className="flex justify-between items-center mt-4">
				<div>
					<p className="text-gray-400 text-[10px] font-medium uppercase mb-0.5">Khách hàng</p>
					<p className="font-bold text-sm">{customerName}</p>
				</div>
				<div className="text-right">
					<p className="text-gray-400 text-[10px] font-medium uppercase mb-0.5">Thanh toán</p>
					<p className="font-black text-primary text-lg">
						{total.toLocaleString('vi-VN')} <span className="text-xs">đ</span>
					</p>
				</div>
			</div>

			<div className="mt-4 pt-3 border-t border-gray-50 flex justify-end">
				<button className="text-primary text-xs font-bold flex items-center gap-1 hover:gap-2 transition-all">
					Xem chi tiết <ChevronRight size={14} />
				</button>
			</div>
		</div>
	);
};

export default OrderCard;
