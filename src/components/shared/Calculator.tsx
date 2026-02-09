import { useState, useEffect } from 'react';
import { X, Calculator as CalcIcon } from 'lucide-react';

interface CalculatorProps {
	onClose: () => void;
	onConfirm: (value: number) => void;
	initialValue?: number;
	unit?: string;
}

const Calculator = ({ onClose, onConfirm, initialValue = 0, unit = "m2" }: CalculatorProps) => {
	const [length, setLength] = useState<number>(0);
	const [width, setWidth] = useState<number>(0);
	const [quantity, setQuantity] = useState<number>(1);
	const [result, setResult] = useState<number>(initialValue);

	useEffect(() => {
		if (length > 0 && width > 0) {
			setResult(length * width * quantity);
		} else {
			setResult(quantity);
		}
	}, [length, width, quantity]);

	return (
		<div className="fixed inset-0 z-50 flex flex-col justify-end">
			<div
				className="absolute inset-0 bg-black/40 backdrop-blur-sm"
				onClick={onClose}
			></div>
			<div className="relative bg-white dark:bg-surface-dark rounded-t-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
				<div className="flex justify-between items-center mb-6">
					<div className="flex items-center gap-2">
						<div className="bg-primary/10 p-2 rounded-lg text-primary">
							<CalcIcon size={20} />
						</div>
						<h3 className="text-xl font-bold">Tính diện tích / khối lượng</h3>
					</div>
					<button onClick={onClose} className="text-gray-400 hover:text-gray-600">
						<X size={24} />
					</button>
				</div>

				<div className="space-y-4 mb-8">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Dài (m)</label>
							<input
								type="number"
								value={length || ''}
								onChange={(e) => setLength(Number(e.target.value))}
								className="w-full bg-gray-50 border-none rounded-xl p-4 text-lg font-bold focus:ring-2 focus:ring-primary"
								placeholder="0.0"
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Rộng (m)</label>
							<input
								type="number"
								value={width || ''}
								onChange={(e) => setWidth(Number(e.target.value))}
								className="w-full bg-gray-50 border-none rounded-xl p-4 text-lg font-bold focus:ring-2 focus:ring-primary"
								placeholder="0.0"
							/>
						</div>
					</div>

					<div>
						<label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Số lượng (tấm/cuộn)</label>
						<input
							type="number"
							value={quantity || ''}
							onChange={(e) => setQuantity(Number(e.target.value))}
							className="w-full bg-gray-50 border-none rounded-xl p-4 text-lg font-bold focus:ring-2 focus:ring-primary"
							placeholder="1"
						/>
					</div>

					<div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
						<div className="flex justify-between items-center">
							<span className="text-sm font-medium text-primary/70">Tổng quy đổi:</span>
							<span className="text-2xl font-black text-primary">
								{result.toLocaleString('vi-VN')} <span className="text-sm font-bold uppercase">{unit}</span>
							</span>
						</div>
					</div>
				</div>

				<button
					onClick={() => onConfirm(result)}
					className="w-full btn-primary h-14"
				>
					Áp dụng kết quả
				</button>
			</div>
		</div>
	);
};

export default Calculator;
