/**
 * Search Utilities — Bộ thuật toán tìm kiếm thông minh cho Dunvex App
 * Hỗ trợ: Bỏ dấu tiếng Việt, tìm kiếm đa từ không theo thứ tự, chuẩn hóa SĐT/SKU/Mã đơn, xếp hạng độ tương thích
 */

export const removeAccents = (str: any): string => {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

export const normalizeText = (text: any): string => {
  return text ? String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() : '';
};

/** Loại bỏ khoảng trắng và ký tự đặc biệt để so sánh SĐT, SKU, Mã số thuế */
export const cleanAlphanumeric = (str: any): string => {
  return removeAccents(str).toLowerCase().replace(/[^a-z0-9]/g, '');
};

/** Chuẩn hóa số điện thoại Việt Nam (+84 -> 0) */
export const cleanPhone = (str: any): string => {
  let cleaned = String(str || '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
};

/**
 * Kiểm tra xem target có khớp với query hay không
 * Supports:
 * 1. Substring match & accent-insensitive match
 * 2. Clean alphanumeric match (ví dụ tìm "0901234567" cho "090-123 4567")
 * 3. Multi-word token match (tách từ: gõ "3x keo" khớp với "Keo 3X Bond")
 */
export const smartSearchMatch = (target: string | string[], query: string): boolean => {
  if (!query || !query.trim()) return true;

  const targets = Array.isArray(target) ? target : [target];
  const qClean = normalizeText(query);
  const qNoAcc = removeAccents(qClean);
  const qAlpha = cleanAlphanumeric(query);
  const qPhone = cleanPhone(query);

  // 1. Target strings normalized
  const targetNorms = targets.map(t => normalizeText(t)).filter(Boolean);
  const targetNoAccs = targets.map(t => removeAccents(t).toLowerCase()).filter(Boolean);
  const targetAlphas = targets.map(t => cleanAlphanumeric(t)).filter(Boolean);
  const targetPhones = targets.map(t => cleanPhone(t)).filter(Boolean);

  // Check direct substring
  for (let i = 0; i < targetNorms.length; i++) {
    if (targetNorms[i].includes(qClean) || targetNoAccs[i].includes(qNoAcc)) {
      return true;
    }
  }

  // Check phone numbers (+84 -> 0, spaces, dashes)
  if (qPhone.length >= 3) {
    for (const phone of targetPhones) {
      if (phone && phone.includes(qPhone)) return true;
    }
  }

  // Check cleaned alphanumeric (dành cho SĐT, SKU, mã đơn)
  if (qAlpha.length >= 2) {
    for (const alpha of targetAlphas) {
      if (alpha.includes(qAlpha)) return true;
    }

    // Special check for order numbers / SKUs with prefixes (e.g. DH-2026-0012 matching dh0012 or 0012)
    const qDigitsOnly = query.replace(/[^0-9]/g, '');
    if (qDigitsOnly.length >= 2) {
      for (const alpha of targetAlphas) {
        if (alpha.endsWith(qDigitsOnly) || alpha.includes(qDigitsOnly)) return true;
      }
    }
  }

  // Multi-word token matching (ví dụ: query = "3x keo", tokens = ["3x", "keo"])
  const tokens = qNoAcc.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const combinedNoAcc = targetNoAccs.join(' ');
    const combinedAlpha = targetAlphas.join(' ');
    const allTokensMatch = tokens.every(token => {
      const tokenAlpha = cleanAlphanumeric(token);
      return combinedNoAcc.includes(token) || (tokenAlpha.length > 0 && combinedAlpha.includes(tokenAlpha));
    });
    if (allTokensMatch) return true;
  }

  return false;
};

/**
 * Tính điểm tương thích (Relevance Score) để xếp hạng gợi ý trong Dropdown
 * Score càng cao -> ưu tiên hiển thị lên đầu
 */
export const calculateSearchScore = (
  item: Record<string, any>,
  query: string,
  fields: { primary?: string[]; secondary?: string[] } = {}
): number => {
  if (!query || !query.trim()) return 0;

  const qClean = normalizeText(query);
  const qNoAcc = removeAccents(qClean);
  const qAlpha = cleanAlphanumeric(query);

  const primaryFields = fields.primary || ['name', 'sku', 'phone', 'id', 'businessName'];
  const secondaryFields = fields.secondary || ['category', 'specification', 'serialNumber', 'address', 'taxCode', 'note'];

  let score = 0;

  // Check Primary fields
  for (const field of primaryFields) {
    const val = String(item[field] || '');
    if (!val) continue;

    const vNoAcc = removeAccents(val).toLowerCase();
    const vAlpha = cleanAlphanumeric(val);

    // Exact match
    if (vNoAcc === qNoAcc || (qAlpha && vAlpha === qAlpha)) {
      score += 1000;
      break;
    }

    // Prefix match (Bắt đầu bằng từ khóa)
    if (vNoAcc.startsWith(qNoAcc) || (qAlpha && vAlpha.startsWith(qAlpha))) {
      score += 500;
    }

    // Word boundary match (Có từ trong tên bắt đầu bằng từ khóa, ví dụ: "Keo 3X Bond" có từ "3X")
    const words = vNoAcc.split(/\s+/);
    if (words.some(w => w.startsWith(qNoAcc))) {
      score += 300;
    }

    // Substring match
    if (vNoAcc.includes(qNoAcc)) {
      score += 100;
    }

    if (qAlpha && vAlpha.includes(qAlpha)) {
      score += 80;
    }
  }

  // Check Secondary fields
  for (const field of secondaryFields) {
    const val = String(item[field] || '');
    if (!val) continue;

    const vNoAcc = removeAccents(val).toLowerCase();
    if (vNoAcc.includes(qNoAcc)) {
      score += 30;
    }
  }

  return score;
};
