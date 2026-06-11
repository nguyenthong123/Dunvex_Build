const fs = require('fs');
const path = require('path');

const targetPath = path.join('/Volumes/DATA_SSD/Projects/Dunvex_Build-main/src/views/NexusControl.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Replace the Access Denied Block
content = content.replace(
	/if \(auth\.currentUser\?\.email !== NEXUS_ADMIN_EMAIL\) \{[\s\S]*?return \([\s\S]*?<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8">[\s\S]*?<div className="bg-red-500\/10 p-6 rounded-full text-red-500 mb-6 border border-red-500\/20">[\s\S]*?<Lock size=\{64\} \/>[\s\S]*?<\/div>[\s\S]*?<h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Access Denied<\/h1>[\s\S]*?<p className="text-slate-400 text-center max-w-md">Nexus Control is restricted to system administrators only\.<\/p>[\s\S]*?<button onClick=\{.*?\} className="mt-8 bg-white text-slate-950 px-8 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-200 transition-all">Go Back<\/button>[\s\S]*?<\/div>[\s\S]*?\);[\s\S]*?\}/m,
	`if (auth.currentUser?.email !== NEXUS_ADMIN_EMAIL) {
		return (
			<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 flex flex-col items-center justify-center text-slate-800 dark:text-white p-8">
				<div className="bg-red-500/10 p-6 rounded-full text-red-500 mb-6 border border-red-500/20">
					<Lock size={64} />
				</div>
				<h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Access Denied</h1>
				<p className="text-slate-500 dark:text-slate-400 text-center max-w-md">Nexus Control is restricted to system administrators only.</p>
				<button onClick={() => navigate('/')} className="mt-8 bg-slate-900 dark:bg-white text-white dark:text-slate-950 px-8 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all">Go Back</button>
			</div>
		);
	}`
);

// 2. Replace the Main Wrapper
const mainWrapperRegex = /return \([\s\S]*?<div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500 selection:text-white">[\s\S]*?\{\/\* Mobile Header Overlay \*\/\}[\s\S]*?<header className="h-16 lg:h-20 border-b border-slate-800 flex items-center justify-between px-6 lg:px-10 bg-slate-950\/50 backdrop-blur-xl sticky top-16 lg:top-0 z-40">[\s\S]*?<div>[\s\S]*?<h3 className="text-lg lg:text-2xl font-black text-white uppercase tracking-tight">[\s\S]*?<\/h3>[\s\S]*?<\/div>[\s\S]*?<\/header>/m;

const newMainWrapper = `return (
		<div className="min-h-screen bg-[#f8f9fb] dark:bg-slate-950 p-4 md:p-8 pb-32 font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-300">
			<div className="max-w-[1400px] mx-auto">
				{/* Header */}
				<div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
					<div>
						<h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Nexus Control</h1>
						<p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">System Core v1.0</p>
					</div>

					<div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar">
						<TabItem active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} icon={<Activity size={18} />} label="Hệ thống" badge={stats.pendingPayments} />
						<TabItem active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={18} />} label="Khách hàng" />
						<TabItem active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Settings size={18} />} label="Lịch sử Log" />
						<TabItem active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} icon={<Bot size={18} />} label="Nexus AI" />
					</div>
				</div>`;

content = content.replace(mainWrapperRegex, newMainWrapper);

// Also need to adjust the closing tags since we removed `<main>`
content = content.replace(/<\/main>\s*<\/div>\s*\);\s*\};\s*const SidebarItem/m, `</div>\n\t\t</div>\n\t);\n};\n\nconst TabItem`);

// 3. Replace SidebarItem with TabItem
content = content.replace(/const SidebarItem[\s\S]*?\);\s*const StatBox/m, `const TabItem = ({ icon, label, active, onClick, badge }: any) => (
	<button
		onClick={onClick}
		className={\`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[13px] whitespace-nowrap transition-all duration-300 \${active ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'}\`}
	>
		{icon}
		{label}
		{badge > 0 && <span className="ml-1 size-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">{badge}</span>}
	</button>
);

const StatBox`);

// 4. Update Classes (Global replacing but careful)
// We will do some specific targeted replacements for dark mode classes.
content = content.replace(/bg-slate-900/g, 'bg-white dark:bg-slate-900');
content = content.replace(/border-slate-800/g, 'border-slate-100 dark:border-slate-800');
content = content.replace(/divide-slate-800/g, 'divide-slate-100 dark:divide-slate-800');
content = content.replace(/bg-slate-800\/50/g, 'bg-slate-50 dark:bg-slate-800/50');
content = content.replace(/text-slate-200/g, 'text-slate-700 dark:text-slate-200');
content = content.replace(/text-slate-300/g, 'text-slate-600 dark:text-slate-300');
content = content.replace(/text-white/g, 'text-slate-900 dark:text-white'); // Dangerous but mostly correct for headings/titles, we will fix primary buttons later
// Fix buttons that need to stay white
content = content.replace(/text-slate-900 dark:text-white px-8 py-3/g, 'text-white px-8 py-3');
content = content.replace(/bg-emerald-500 text-slate-900 dark:text-white/g, 'bg-emerald-500 text-white');
content = content.replace(/bg-rose-500 text-slate-900 dark:text-white/g, 'bg-rose-500 text-white');
content = content.replace(/bg-indigo-600 text-slate-900 dark:text-white/g, 'bg-indigo-600 text-white');
content = content.replace(/bg-indigo-500 text-slate-900 dark:text-white/g, 'bg-indigo-500 text-white');
content = content.replace(/bg-white text-slate-950/g, 'bg-slate-800 text-white dark:bg-white dark:text-slate-950');

// Fix StatBox
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
console.log('Refactoring completed successfully.');
