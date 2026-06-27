const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/services/dataAccess.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Thay thế các kiểu dữ liệu lỏng lẻo bằng DocumentData từ firestore
content = content.replace(/WithId<any>/g, 'WithId<DocumentData>');
content = content.replace(/Record<string, any>/g, 'DocumentData');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully replaced any types in dataAccess.ts');
