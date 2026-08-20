/**
 * Tiện ích tìm kiếm sản phẩm — dùng chung cho các bot và views
 */

/** Chuẩn hóa tiếng Việt để tìm kiếm chính xác (bỏ dấu, lowercase, NFC) */
export function normalizeVN(text: string): string {
    return text
        .normalize('NFC')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // bỏ dấu
        .replace(/đ/g, 'd')
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\s]+/g, '') // bỏ dấu câu + khoảng trắng
        .trim();
}

/** Tìm sản phẩm khớp trong danh sách (8 tầng ưu tiên) */
export function findMatchingProduct(name: string, allProducts: any[], category?: string): any | null {
    const searchName = (name || '').toLowerCase().trim();
    const searchNameVN = normalizeVN(name || '');
    
    // Ưu tiên 1: Khớp chính xác tên (case-insensitive)
    let found = allProducts.find(p => (p.name || '').toLowerCase() === searchName);
    if (found) return found;
    
    // Ưu tiên 2: Khớp tên + category nếu có
    if (category) {
        const searchCat = normalizeVN(category);
        found = allProducts.find(p => 
            (p.name || '').toLowerCase() === searchName && 
            normalizeVN(p.category || '') === searchCat
        );
        if (found) return found;
    }
    
    // Ưu tiên 3: DB name contains search name
    found = allProducts.find(p => (p.name || '').toLowerCase().includes(searchName));
    if (found) return found;
    
    // Ưu tiên 4: Search name contains DB name (VD: "Keo A2.75" chứa "A2.75")
    found = allProducts.find(p => searchName.includes((p.name || '').toLowerCase()));
    if (found) return found;
    
    // Ưu tiên 5: Fuzzy Vietnamese match (bỏ dấu + bỏ space/punctuation)
    if (searchNameVN.length >= 2) {
        found = allProducts.find(p => normalizeVN(p.name || '').includes(searchNameVN));
        if (found) return found;
        
        // Ưu tiên 6: Ngược lại - search bao hàm DB
        found = allProducts.find(p => {
            const dbVN = normalizeVN(p.name || '');
            return dbVN.length >= 2 && searchNameVN.includes(dbVN);
        });
        if (found) return found;
        
        // Ưu tiên 7: Fuzzy + category
        if (category) {
            found = allProducts.find(p => 
                normalizeVN(p.name || '').includes(searchNameVN) &&
                normalizeVN(p.category || '').includes(normalizeVN(category))
            );
            if (found) return found;
        }
    }
    
    return null;
}
