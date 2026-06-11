const fs = require('fs');
const path = require('path');

const targetPath = path.join('/Volumes/DATA_SSD/Projects/Dunvex_Build-main/src/views/NexusControl.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

const replacements = [
	{ from: /bg-slate-900/g, to: 'bg-white dark:bg-slate-900' },
	{ from: /border-slate-800/g, to: 'border-slate-100 dark:border-slate-800' },
	{ from: /divide-slate-800/g, to: 'divide-slate-100 dark:divide-slate-800' },
	{ from: /bg-slate-800\/50/g, to: 'bg-slate-50 dark:bg-slate-800/50' },
	{ from: /text-slate-200/g, to: 'text-slate-700 dark:text-slate-200' },
	{ from: /text-slate-300/g, to: 'text-slate-600 dark:text-slate-300' },
	{ from: /text-white/g, to: 'text-slate-900 dark:text-white' },
];

for (const rep of replacements) {
	content = content.replace(rep.from, rep.to);
}

// 6. Fix any buttons/badges that must stay white text (revert)
const reverts = [
	{ from: /text-slate-900 dark:text-white px-8 py-3/g, to: 'text-white px-8 py-3' },
	{ from: /bg-emerald-500 text-slate-900 dark:text-white/g, to: 'bg-emerald-500 text-white' },
	{ from: /bg-rose-500 text-slate-900 dark:text-white/g, to: 'bg-rose-500 text-white' },
	{ from: /bg-indigo-600 text-slate-900 dark:text-white/g, to: 'bg-indigo-600 text-white' },
	{ from: /bg-indigo-500 text-slate-900 dark:text-white/g, to: 'bg-indigo-500 text-white' },
	{ from: /bg-white dark:bg-slate-900 text-slate-950/g, to: 'bg-slate-800 text-white dark:bg-white dark:text-slate-950' },
	// Additional overrides for white text items like badges
	{ from: /text-slate-900 dark:text-white rounded-lg font-black text-\[8px\] uppercase tracking-wider/g, to: 'text-white rounded-lg font-black text-[8px] uppercase tracking-wider' },
	{ from: /text-slate-900 dark:text-white text-\[10px\] font-black flex items-center justify-center/g, to: 'text-white text-[10px] font-black flex items-center justify-center' }
];

for (const rev of reverts) {
	content = content.replace(rev.from, rev.to);
}

// 7. Fix StatBox (It replaces the class strings for StatBox wrapper)
content = content.replace(/const StatBox = \(\{ label, value, icon, color \}: any\) => \{[\s\S]*?return \([\s\S]*?<div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col gap-3 lg:gap-4 relative overflow-hidden group">/m, `const StatBox = ({ label, value, icon, color }: any) => {
	const colorMap: Record<string, string> = {
		blue: 'text-blue-500 bg-blue-500/10',
		amber: 'text-amber-500 bg-amber-500/10',
		orange: 'text-orange-500 bg-orange-500/10',
		emerald: 'text-emerald-500 bg-emerald-500/10'
	};
	return (
		<div className="bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl p-4 lg:p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3 lg:gap-4 relative overflow-hidden group">`);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Class names refactored successfully.');
