import React from 'react';
import { BrainCircuit, CheckCircle2, AlertTriangle, Clock, LineChart } from 'lucide-react';

interface NexusAiTabProps {
	aiAnomalies: any[];
	aiAnalyticsData: any[];
}

const StatBox = ({ label, value, icon, color }: any) => {
	const colorMap: Record<string, string> = {
		blue: 'text-blue-500 bg-blue-500/10',
		amber: 'text-amber-500 bg-amber-500/10',
		orange: 'text-orange-500 bg-orange-500/10',
		emerald: 'text-emerald-500 bg-emerald-500/10'
	};
	return (
		<div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3 lg:gap-4 relative overflow-hidden group">
			<div className={`size-10 lg:size-12 rounded-xl lg:rounded-2xl ${colorMap[color]} flex items-center justify-center scale-90 lg:scale-100`}>{icon}</div>
			<div>
				<p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-[2px] mb-1">{label}</p>
				<p className="text-lg lg:text-2xl font-black text-slate-900 dark:text-white tracking-tighter truncate">{value}</p>
			</div>
		</div>
	);
};

export function NexusAiTab({ aiAnomalies, aiAnalyticsData }: NexusAiTabProps) {
	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<StatBox label="Total AI Calls" value={aiAnalyticsData.length} icon={<BrainCircuit />} color="blue" />
				<StatBox label="Success Rate" value={`${Math.round((aiAnalyticsData.filter(d => d.success).length / (aiAnalyticsData.length || 1)) * 100)}%`} icon={<CheckCircle2 />} color="emerald" />
				<StatBox label="Errors" value={aiAnalyticsData.filter(d => !d.success).length} icon={<AlertTriangle />} color="rose" />
				<StatBox label="Avg Latency" value={`${Math.round(aiAnalyticsData.reduce((acc, curr) => acc + (curr.latencyMs || 0), 0) / (aiAnalyticsData.length || 1))}ms`} icon={<Clock />} color="amber" />
			</div>
			<div className="bg-white dark:bg-slate-900 rounded-3xl lg:rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-2xl">
				<div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
					<h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><LineChart className="text-indigo-500" /> AI System Data & Metrics</h3>
				</div>
				<div className="overflow-x-auto custom-scrollbar">
					<table className="w-full text-sm text-left">
						<thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
							<tr>
								<th className="px-6 py-4 font-semibold whitespace-nowrap">Thời gian</th>
								<th className="px-6 py-4 font-semibold">User</th>
								<th className="px-6 py-4 font-semibold">Action</th>
								<th className="px-6 py-4 font-semibold">Intent</th>
								<th className="px-6 py-4 font-semibold">Trạng thái</th>
								<th className="px-6 py-4 font-semibold text-right">Độ trễ</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-800">
							{aiAnalyticsData.map(log => (
								<tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
									<td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('vi-VN') : 'N/A'}</td>
									<td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{log.userEmail}</td>
									<td className="px-6 py-4"><span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-700">{log.action}</span></td>
									<td className="px-6 py-4"><span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold border border-indigo-100 dark:border-indigo-800/50">{log.intent}</span></td>
									<td className="px-6 py-4">
										{log.success ? <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={16}/> OK</span> : <span className="text-rose-500 flex items-center gap-1" title={log.error}><AlertTriangle size={16}/> Lỗi</span>}
									</td>
									<td className="px-6 py-4 font-mono text-xs text-right text-slate-500">{log.latencyMs}ms</td>
								</tr>
							))}
							{aiAnalyticsData.length === 0 && (
								<tr>
									<td colSpan={6} className="px-6 py-12 text-center text-slate-500">Chưa có dữ liệu phân tích AI</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
