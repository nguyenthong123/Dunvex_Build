import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distDir = path.join(rootDir, 'dist');
const zipOutput = path.join(rootDir, 'dist.zip');
const manifestPath = path.join(rootDir, 'server/ota-manifest.json');
const pkgPath = path.join(rootDir, 'package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (!fs.existsSync(distDir)) {
  console.log('📦 Building web assets first...');
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
}

console.log('🗜️ Creating OTA update zip package (dist.zip)...');
// Use native zip command on mac/linux
if (fs.existsSync(zipOutput)) fs.unlinkSync(zipOutput);
execSync(`cd "${distDir}" && zip -r -9 "${zipOutput}" ./*`, { stdio: 'inherit' });

const fileBuffer = fs.readFileSync(zipOutput);
const hashSum = crypto.createHash('sha256');
hashSum.update(fileBuffer);
const hexHash = hashSum.digest('hex');

// Deployment can pass a shared build number so the web bundle and Android APK match.
const requestedBuildNumber = process.env.OTA_BUILD_NUMBER;
let currentBuildNumber;
if (requestedBuildNumber) {
  currentBuildNumber = Number(requestedBuildNumber);
  if (!Number.isSafeInteger(currentBuildNumber) || currentBuildNumber <= 0) {
    throw new Error(`Invalid OTA_BUILD_NUMBER: ${requestedBuildNumber}`);
  }
} else {
  const existing = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : { buildNumber: 101 };
  const previousBuildNumber = Number(existing.buildNumber || 101);
  if (!Number.isSafeInteger(previousBuildNumber) || previousBuildNumber <= 0) {
    throw new Error(`Invalid buildNumber in ${manifestPath}`);
  }
  currentBuildNumber = Math.max(102, previousBuildNumber + 1);
}

const manifest = {
  version: pkg.version || '1.0.1',
  buildNumber: currentBuildNumber,
  releaseDate: new Date().toISOString(),
  bundleHash: hexHash,
  size: fileBuffer.length,
  bundleUrl: '/api/ota-update/bundle.zip',
  releaseNotes: process.argv[2] || 'Tự động cập nhật tính năng mới, tối ưu hóa giao diện và bảo mật.'
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log('✅ OTA Bundle successfully created!');
console.log('📄 Manifest:', manifest);
console.log(`📍 File: ${zipOutput} (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
