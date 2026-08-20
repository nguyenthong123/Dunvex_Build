import fs from 'fs';
import path from 'path';

const GAS_WEBAPP_URL = process.env.GAS_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbwIup8ysoKT4E_g8GOVrBiQxXw7SOtqhLWD2b0GOUT54MuoXgTtxP42XSpFR_3aoXAG7g/exec';
const FOLDER_ID = '1kQciC7-VvMdKmt6rpiyspNNkQeThydxg';

async function uploadToDrive(filePath, customName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileName = customName || path.basename(filePath);
  console.log(`📤 Reading file ${filePath} (${fileName})...`);

  const fileBuffer = await fs.promises.readFile(filePath);
  const base64Data = fileBuffer.toString('base64');

  let mimeType = 'application/octet-stream';
  if (fileName.endsWith('.json')) mimeType = 'application/json';
  else if (fileName.endsWith('.json.gz') || fileName.endsWith('.gz')) mimeType = 'application/gzip';
  else if (fileName.endsWith('.tar.gz')) mimeType = 'application/x-gzip';
  else if (fileName.endsWith('.webp')) mimeType = 'image/webp';
  else if (fileName.endsWith('.png')) mimeType = 'image/png';
  else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg';

  const payload = {
    filename: fileName,
    mimeType: mimeType,
    base64Data: base64Data,
    folderId: FOLDER_ID
  };

  console.log(`🚀 Sending ${fileName} (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) to Google Apps Script Drive uploader...`);

  const response = await fetch(GAS_WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resText = await response.text();
  let resJson;
  try {
    resJson = JSON.parse(resText);
  } catch (e) {
    resJson = { raw: resText };
  }

  if (response.ok && (resJson.status === 'success' || resJson.fileUrl || resJson.ok === true || resJson.success === true)) {
    console.log(`✅ Upload SUCCESS! File URL: ${resJson.fileUrl || 'Uploaded to Drive folder'}`);
    return resJson;
  } else {
    throw new Error(`GAS Upload Error: ${JSON.stringify(resJson)}`);
  }
}

const targetFile = process.argv[2];
const customFileName = process.argv[3];

if (targetFile) {
  uploadToDrive(targetFile, customFileName)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Upload failed:', err.message || err);
      process.exit(1);
    });
}

export { uploadToDrive };
