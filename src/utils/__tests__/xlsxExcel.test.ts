import { describe, it, expect } from 'vitest';

describe('XLSX Excel Export and Import Suite', () => {
  it('should dynamically import XLSX and build a valid Excel workbook', async () => {
    const XLSX = await import('xlsx');
    expect(XLSX).toBeDefined();

    // 1. Create test data
    const sampleData = [
      { STT: 1, 'Mã sản phẩm': 'SP001', 'Tên sản phẩm': 'Keo dán gạch', 'Đơn giá': 150000, 'Tồn kho': 50 },
      { STT: 2, 'Mã sản phẩm': 'SP002', 'Tên sản phẩm': 'Tôn mạ màu 0.45mm', 'Đơn giá': 120000, 'Tồn kho': 120 }
    ];

    // 2. Export to Worksheet & Workbook
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sản phẩm');

    expect(workbook.SheetNames).toContain('Sản phẩm');

    // 3. Write to binary array & re-parse from buffer (simulating File Import)
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    expect(excelBuffer).toBeDefined();
    expect(excelBuffer.byteLength).toBeGreaterThan(0);

    // 4. Re-read workbook from array buffer
    const readWorkbook = XLSX.read(excelBuffer, { type: 'array' });
    const firstSheetName = readWorkbook.SheetNames[0];
    const parsedData: any[] = XLSX.utils.sheet_to_json(readWorkbook.Sheets[firstSheetName]);

    // 5. Verify parsed data
    expect(parsedData.length).toBe(2);
    expect(parsedData[0]['Mã sản phẩm']).toBe('SP001');
    expect(parsedData[0]['Tên sản phẩm']).toBe('Keo dán gạch');
    expect(parsedData[1]['Tồn kho']).toBe(120);
  });
});
