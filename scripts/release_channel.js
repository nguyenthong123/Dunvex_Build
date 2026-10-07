import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platform = process.argv[3];
const action = process.argv[2];
const allowedPlatforms = new Set(['web', 'android', 'mac', 'windows']);

if (!allowedPlatforms.has(platform)) {
  throw new Error(`Usage: node scripts/release_channel.js <next|publish> <web|android|mac|windows>`);
}

const manifestPath = path.join(rootDir, 'server/releases', `${platform}.json`);
const currentManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (action === 'next') {
  const current = Number(currentManifest.buildNumber);
  if (!Number.isSafeInteger(current) || current <= 0) {
    throw new Error(`Invalid buildNumber in ${manifestPath}`);
  }
  console.log(current + 1);
} else if (action === 'publish') {
  const buildNumber = Number(process.argv[4]);
  if (!Number.isSafeInteger(buildNumber) || buildNumber <= Number(currentManifest.buildNumber)) {
    throw new Error(`New build number must be a safe integer greater than ${currentManifest.buildNumber}`);
  }

  const packageInfo = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const releaseNotes = process.argv.slice(5).join(' ').trim() || `${platform} Dunvex update`;
  const manifest = {
    ...currentManifest,
    version: packageInfo.version || currentManifest.version,
    buildNumber,
    releaseDate: new Date().toISOString(),
    releaseNotes,
  };

  if (platform === 'mac' || platform === 'windows') {
    const distDir = path.join(rootDir, 'dist');
    const platformDir = path.join(rootDir, 'server/releases', platform);
    fs.mkdirSync(platformDir, { recursive: true });
    const bundlePath = path.join(platformDir, 'bundle.zip');
    if (fs.existsSync(bundlePath)) fs.unlinkSync(bundlePath);
    execFileSync('zip', ['-r', '-9', bundlePath, '.'], { cwd: distDir, stdio: 'inherit' });
    const bundle = fs.readFileSync(bundlePath);
    manifest.bundleHash = crypto.createHash('sha256').update(bundle).digest('hex');
    manifest.size = bundle.length;
    manifest.bundleUrl = `/api/releases/${platform}/bundle.zip`;
    const packagePath = platform === 'mac'
      ? path.join(rootDir, 'dist-mac/Dunvex-Build-1.0.1-Apple-Silicon.dmg')
      : path.join(rootDir, 'dist-win/Dunvex-Setup-1.0.1-x64.exe');
    const releasePackage = fs.readFileSync(packagePath);
    manifest.downloadSize = releasePackage.length;
    manifest.downloadSha256 = crypto.createHash('sha256').update(releasePackage).digest('hex');
    if (platform === 'windows') {
      manifest.portableDownloadUrl = '/downloads/Dunvex-Build-1.0.1-Windows-x64.zip';
      manifest.portableSize = fs.statSync(path.join(rootDir, 'dist-win/Dunvex-Build-1.0.1-Windows-x64.zip')).size;
      manifest.downloadUrl = '/downloads/Dunvex-Setup-1.0.1-x64.exe';
    }
  }

  if (platform === 'android') {
    const apkPath = path.join(rootDir, 'dunvex_app.apk');
    if (!fs.existsSync(apkPath)) throw new Error(`Android APK not found: ${apkPath}`);
    const apk = fs.readFileSync(apkPath);
    manifest.downloadUrl = '/downloads/dunvex_app.apk';
    manifest.apkUrl = 'https://dunvex.com/dunvex_app.apk';
    manifest.size = apk.length;
    manifest.sha256 = crypto.createHash('sha256').update(apk).digest('hex');
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Published ${platform} release metadata:`, manifest);
} else {
  throw new Error('Action must be "next" or "publish"');
}
