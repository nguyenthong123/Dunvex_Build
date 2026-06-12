const normalizeText = (text) => text ? String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() : '';
const removeAccents = (str) => {
	return String(str || '').normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/đ/g, 'd')
		.replace(/Đ/g, 'D');
};
const isMatch = (target, query) => {
	if (!query) return true;
	const t = normalizeText(target);
	const q = normalizeText(query);
	console.log(`t: "${t}", q: "${q}", t.includes(q): ${t.includes(q)}, removeAccents: ${removeAccents(t).includes(removeAccents(q))}`);
	return t.includes(q) || removeAccents(t).includes(removeAccents(q));
};

isMatch('Nhà máy tôn Nhật Đăng', 'nhà máy tôn nh');
isMatch('Nhà máy tôn nhân phát', 'nhà máy tôn nh');
