const userMsg = "uh, tạo mới sản phẩm với link trên";
const flatMsg = userMsg.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();

const isOrder = /(lên|tạo|chốt|đặt|order|tao)\s*.?(đơn|don|order|hàng|hang)/.test(flatMsg) ||
    /đơn\s*hàng|order\s*from|từ\s*sheet.*đơn|\b2\b|^lên( đơn)?$/.test(flatMsg);
const isInventory = /(nhập|import|cập\s*nhật|update|nạp|thêm)\s*.?(kho|tồn|ton|inventory|stock)/.test(flatMsg) ||
    /tồn\s*kho|nhập\s*hàng|import\s*stock|\b1\b|^nhập( kho)?$/.test(flatMsg);
const isSupplier = /nhà\s*cung\s*cấp|ncc|nhập\s*hàng|mua\s*hàng|đơn\s*mua|purchase|supplier|\b4\b|^mua( hàng)?$/.test(flatMsg);
const isCreateProducts = /tạo\s*.?(danh\s*sách)?\s*.?(sản\s*phẩm|sp|mới)|create\s*.?(product|sp)/.test(flatMsg) ||
    /sản\s*phẩm\s*mới|danh\s*sách\s*(sản\s*phẩm|sp)|thêm\s*(sản\s*phẩm|sp|mới)|\b3\b/.test(flatMsg);

console.log("isOrder", isOrder);
console.log("isInventory", isInventory);
console.log("isSupplier", isSupplier);
console.log("isCreateProducts", isCreateProducts);

if (isCreateProducts && !isOrder && !isInventory && !isSupplier) {
    console.log("WILL EXECUTE IMPORT_CREATE_PRODUCTS!");
} else {
    console.log("WILL NOT EXECUTE IMPORT_CREATE_PRODUCTS!");
}
