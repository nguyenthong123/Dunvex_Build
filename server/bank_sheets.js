/**
 * 🏦 Bank Sheets Module — Google Sheets API integration
 * 
 * Đọc/ghi bank transactions vào Google Sheets thay vì SQLite.
 * Dùng Application Default Credentials (GCE service account).
 */
import { google } from 'googleapis';

const SHEET_TITLE = 'Dunvex Bank Transactions'; // Tên spreadsheet
const SHEET_NAME = 'Bank_Transactions'; // Tên sheet tab
const COLUMNS = ['Ngày', 'Phát sinh', 'Nội dung', 'transactionId', 'processedAt', 'subject'];

let sheetsClient = null;
let spreadsheetId = null;
let initialized = false;

/**
 * Khởi tạo Google Sheets client và lấy/tạo spreadsheet
 */
async function init() {
  if (initialized && spreadsheetId) return;

  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });

  // Tìm spreadsheet đã có, hoặc tạo mới
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    const res = await drive.files.list({
      q: `name = '${SHEET_TITLE}' and mimeType = 'application/vnd.google-spreadsheet' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 1,
    });

    if (res.data.files && res.data.files.length > 0) {
      spreadsheetId = res.data.files[0].id;
      console.log(`[BankSheets] 📊 Found sheet: ${spreadsheetId}`);
    } else {
      // Tạo spreadsheet mới
      const createRes = await sheetsClient.spreadsheets.create({
        requestBody: {
          properties: { title: SHEET_TITLE },
          sheets: [{
            properties: { title: SHEET_NAME },
            data: [{
              startRow: 0, startColumn: 0,
              rowData: [{
                values: COLUMNS.map(c => ({ userEnteredValue: { stringValue: c } }))
              }]
            }]
          }]
        }
      });
      spreadsheetId = createRes.data.spreadsheetId;
      console.log(`[BankSheets] 📊 Created new sheet: ${spreadsheetId}`);
      console.log(`[BankSheets] 🔗 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
    }

    // Đảm bảo có sheet tab Bank_Transactions
    await ensureSheetTab();

    initialized = true;
  } catch (err) {
    console.error('[BankSheets] ❌ Init failed:', err.message);
    throw err;
  }
}

/**
 * Đảm bảo sheet tab "Bank_Transactions" tồn tại
 */
async function ensureSheetTab() {
  try {
    const meta = await sheetsClient.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const hasSheet = meta.data.sheets.some(s => s.properties.title === SHEET_NAME);
    
    if (!hasSheet) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: { properties: { title: SHEET_NAME } }
          }]
        }
      });
      
      // Thêm header
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `'${SHEET_NAME}'!A1:F1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [COLUMNS] }
      });

      // Freeze row 1
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: {
                sheetId: await getSheetId(),
                gridProperties: { frozenRowCount: 1 }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          }]
        }
      });
    }
  } catch (err) {
    console.error('[BankSheets] ensureSheetTab error:', err.message);
  }
}

async function getSheetId() {
  const meta = await sheetsClient.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const s = meta.data.sheets.find(sh => sh.properties.title === SHEET_NAME);
  return s?.properties?.sheetId || 0;
}

/**
 * Thêm 1 giao dịch mới
 */
export async function addTransaction(tx) {
  await init();

  const { date, amount, content, transactionId, subject } = tx;
  const txId = transactionId || Date.now().toString();

  // Kiểm tra trùng
  const existingIds = await getAllTransactionIds();
  if (existingIds.includes(txId)) {
    console.log(`[BankSheets] ⚠️ Duplicate tx: ${txId}`);
    return { success: false, message: 'Duplicate transaction', transactionId: txId };
  }

  const amountFormatted = '+' + Number(amount).toLocaleString('vi-VN') + ' đ';
  const now = new Date().toISOString();

  await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range: `'${SHEET_NAME}'!A:F`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[date, amountFormatted, content, txId, now, subject || '']]
    }
  });

  console.log(`[BankSheets] ✅ Saved: ${amountFormatted} — ${txId}`);
  return { success: true, transactionId: txId };
}

/**
 * Lấy tất cả transaction IDs (để check duplicate)
 */
async function getAllTransactionIds() {
  await init();
  try {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!D:D`,
    });
    const values = res.data.values || [];
    return values.slice(1).map(r => r[0]).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Lấy danh sách giao dịch trong N ngày gần nhất
 */
export async function getTransactions(days = 30) {
  await init();

  try {
    const res = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:F`,
    });
    
    const rows = res.data.values || [];
    if (rows.length <= 1) return [];

    const sinceTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const data = [];

    // Duyệt ngược (mới nhất trước)
    for (let i = rows.length - 1; i >= 1; i--) {
      const row = rows[i];
      const processedAt = row[4]; // Column E

      if (processedAt && new Date(processedAt) >= sinceTime) {
        data.push({
          "Ngày": row[0] || '',
          "Phát sinh": row[1] || '+0 đ',
          "Nội dung": row[2] || '',
          "transactionId": row[3] || ''
        });
      }
    }

    return data;
  } catch (err) {
    console.error('[BankSheets] getTransactions error:', err.message);
    return [];
  }
}

/**
 * Migrate: import hàng loạt từ mảng data (dùng khi migrate từ SQLite)
 */
export async function migrateData(dataArray) {
  await init();

  const existingIds = await getAllTransactionIds();
  let added = 0;
  const rows = [];

  for (const tx of dataArray) {
    const txId = tx.transactionId || tx.id || '';
    if (existingIds.includes(txId)) continue;

    const amountFormatted = '+' + Number(tx.amount || 0).toLocaleString('vi-VN') + ' đ';
    rows.push([
      tx.date || tx['Ngày'] || '',
      amountFormatted,
      tx.content || tx['Nội dung'] || '',
      txId,
      tx.processedAt || new Date().toISOString(),
      tx.subject || ''
    ]);
    existingIds.push(txId);
    added++;
  }

  if (rows.length > 0) {
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range: `'${SHEET_NAME}'!A:F`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows }
    });
  }

  console.log(`[BankSheets] 📦 Migrated ${added} transactions`);
  return { success: true, added };
}

/**
 * Lấy URL của spreadsheet
 */
export async function getSheetUrl() {
  await init();
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}
