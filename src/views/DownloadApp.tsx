import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { 
  Download, Apple, Monitor, Smartphone, Globe, CheckCircle, 
  ShieldCheck, Zap, RefreshCw, QrCode, ArrowLeft, LogIn, 
  Sparkles, Check, ChevronRight, HardDrive, SmartphoneCharging
} from 'lucide-react';
import { apiUrl } from '../services/apiClient';
import { useTheme } from '../context/ThemeContext';
import { isNativeApp } from '../utils/platform';

interface AppPackageInfo {
  version: string;
  buildNumber: number;
  releaseDate: string;
  releaseNotes?: string;
  changelog?: string[];
  downloadSize?: number;
  downloadUrl?: string;
}

type ReleasePlatform = 'web' | 'android' | 'mac' | 'windows';

function formatDownloadSize(bytes: number | undefined, fallback: string): string {
  if (!bytes || bytes <= 0) return fallback;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}

interface DownloadAppProps {
  isPublic?: boolean;
}

export const DownloadApp: React.FC<DownloadAppProps> = ({ isPublic = false }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [os, setOs] = useState<'mac' | 'windows' | 'android' | 'ios' | 'other'>('other');
  const [releaseInfo, setReleaseInfo] = useState<Partial<Record<ReleasePlatform, AppPackageInfo>>>({});
  const [releaseInfoErrors, setReleaseInfoErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isNativeApp()) {
      navigate('/settings', { replace: true });
      return;
    }

    // Detect Operating System
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) {
      setOs('android');
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      setOs('ios');
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      setOs('mac');
    } else if (/Windows/i.test(ua)) {
      setOs('windows');
    } else {
      setOs('other');
    }

    const platforms: ReleasePlatform[] = ['web', 'android', 'mac', 'windows'];
    void Promise.all(platforms.map(async (platform) => {
      try {
        const response = await fetch(apiUrl(`/api/releases/${platform}/version`), { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.success || !Number.isInteger(Number(data.buildNumber))) {
          throw new Error('Invalid release metadata');
        }
        setReleaseInfo(previous => ({
          ...previous,
          [platform]: {
            version: data.version || '1.0.1',
            buildNumber: Number(data.buildNumber),
            releaseDate: data.releaseDate ? new Date(data.releaseDate).toLocaleDateString('vi-VN') : '',
            releaseNotes: data.releaseNotes,
            changelog: data.changelog,
            downloadSize: data.downloadSize || data.size,
          },
        }));
      } catch (error) {
        console.error(`[Download Center] Unable to load ${platform} release metadata:`, error);
        setReleaseInfoErrors(previous => previous.includes(platform) ? previous : [...previous, platform]);
      }
    }));
  }, []);

  const packages = [
    {
      id: 'android',
      name: 'Android Mobile & Tablet',
      subtitle: 'Dành cho điện thoại & máy tính bảng Android',
      badge: 'Cập nhật mới nhất',
      size: '4.2 MB',
      filename: 'dunvex_app.apk',
      url: apiUrl('/downloads/dunvex_app.apk'),
      directUrl: 'https://dunvex.com/dunvex_app.apk',
      icon: Smartphone,
      accentColor: 'from-emerald-500 to-teal-600',
      badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25',
      tag: 'Khuyên dùng cho điện thoại',
      features: [
        'Trình tự động cập nhật APK 1 chạm trong app',
        'Xuất Excel Offline 100% không qua mạng',
        'Chấm công định vị GPS & Quét mã QR camera',
        'In hóa đơn bluetooth & máy in mạng tức thì'
      ]
    },
    {
      id: 'windows',
      name: 'Windows 64-bit',
      subtitle: 'Bộ cài cho máy tính Windows 10 & 11 (x64)',
      badge: 'Bộ cài chính thức',
      size: '65 MB',
      filename: 'Dunvex-Setup-1.0.1-x64.exe',
      url: apiUrl('/downloads/Dunvex-Setup-1.0.1-x64.exe'),
      directUrl: 'https://dunvex.com/downloads/Dunvex-Setup-1.0.1-x64.exe',
      icon: Monitor,
      accentColor: 'from-blue-600 to-indigo-700',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      btnColor: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25',
      tag: 'Bản Desktop PC',
      features: [
        'Tự tạo lối tắt trong Start Menu và Desktop',
        'Có trong danh sách ứng dụng Windows và Apps & Features',
        'Cơ sở dữ liệu SQLite cục bộ siêu tốc',
        'In ấn phiếu khổ 80mm / A4 / A5 mượt mà',
        'Tự động cập nhật OTA phiên bản mới'
      ]
    },
    {
      id: 'mac',
      name: 'macOS (Apple Silicon)',
      subtitle: 'Dành cho MacBook, Mac Mini chip M1, M2, M3, M4',
      badge: 'Apple Silicon',
      size: '1.5 MB',
      filename: 'Dunvex-Build-1.0.1-Apple-Silicon.dmg',
      url: apiUrl('/downloads/Dunvex-Build-1.0.1-Apple-Silicon.dmg'),
      directUrl: 'https://dunvex.com/downloads/Dunvex-Build-1.0.1-Apple-Silicon.dmg',
      icon: Apple,
      accentColor: 'from-slate-800 to-zinc-900',
      badgeColor: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20',
      btnColor: 'bg-zinc-900 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white shadow-zinc-900/25',
      tag: 'Khuyên dùng cho Mac',
      features: [
        'Native macOS WKWebView Engine',
        'Kéo thả vào Applications dùng ngay',
        'Tiết kiệm pin & RAM tối đa',
        'Tự động đồng bộ thời gian thực'
      ]
    },
    {
      id: 'ios',
      name: 'iPhone / iPad (Web App)',
      subtitle: 'Chạy trực tiếp qua trình duyệt Safari / Chrome',
      badge: 'PWA Web App',
      size: '0 MB',
      filename: 'PWA Web App',
      url: 'https://dunvex.com',
      directUrl: 'https://dunvex.com',
      icon: Globe,
      accentColor: 'from-indigo-600 to-violet-700',
      badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
      btnColor: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25',
      tag: 'Thêm vào Màn hình chính',
      features: [
        'Không tốn dung lượng bộ nhớ máy',
        'Mở toàn màn hình không viền như App Native',
        'Tự động lưu Offline IndexedDB trên máy',
        'Đăng nhập tức thì mọi lúc mọi nơi'
      ]
    }
  ];

  const detectedPkg = packages.find(p => p.id === os) || packages[0];
  const selectedPlatform: ReleasePlatform = detectedPkg.id === 'ios' ? 'web' : detectedPkg.id as ReleasePlatform;
  const selectedRelease = releaseInfo[selectedPlatform];
  const selectedPackageSize = detectedPkg.id === 'ios'
    ? detectedPkg.size
    : formatDownloadSize(selectedRelease?.downloadSize, detectedPkg.size);
  const selectedPackageUrl = detectedPkg.id === 'ios' || !selectedRelease
    ? detectedPkg.directUrl
    : `${detectedPkg.directUrl}${detectedPkg.directUrl.includes('?') ? '&' : '?'}v=${selectedRelease.buildNumber}`;
  const selectedChangelog = selectedRelease?.changelog?.length
    ? selectedRelease.changelog
    : selectedRelease?.releaseNotes
      ? [selectedRelease.releaseNotes]
      : [];

  return (
    <div className="flex flex-col min-h-full bg-[#f8f9fb] dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-300 font-['Manrope']">
      
      {/* ─── PUBLIC TOP HEADER (CHỈ HIỆN KHI CHƯA ĐĂNG NHẬP HOẶC TRUY CẬP CÔNG KHAI) ─── */}
      {isPublic && (
        <header className="h-16 md:h-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between transition-colors duration-300">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="size-9 md:size-10 bg-gradient-to-br from-[#1A237E] to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-900/20 text-white font-black text-sm">
              DV
            </div>
            <div>
              <h1 className="text-base md:text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Dunvex<span className="text-[#FF6D00]">Build</span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">Trung tâm tải ứng dụng</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs md:text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập hệ thống</span>
            </button>
          </div>
        </header>
      )}

      {/* ─── IN-APP NAVIGATION & HEADER (KHI ĐÃ ĐĂNG NHẬP & NẰM TRONG MAINLAYOUT) ─── */}
      {!isPublic && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-4 transition-colors duration-300">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="size-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all active:scale-95"
                title="Quay lại"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-bold mb-0.5">
                  <span className="cursor-pointer hover:underline" onClick={() => navigate('/')}>Trang chủ</span>
                  <span>/</span>
                  <span className="cursor-pointer hover:underline" onClick={() => navigate('/settings')}>Cài đặt</span>
                  <span>/</span>
                  <span className="text-indigo-600 dark:text-indigo-400">Tải ứng dụng</span>
                </div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>Trung Tâm Tải Gói Cài Đặt Dunvex</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:self-center flex-wrap">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('check_app_updates', { detail: { manual: true } }));
                }}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl transition-all active:scale-95 flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Kiểm tra cập nhật</span>
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all active:scale-95 flex items-center gap-1.5"
              >
                <span>Về Bảng điều khiển</span>
              </button>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                {selectedRelease
                  ? `v${selectedRelease.version} (Build ${selectedRelease.buildNumber})`
                  : 'Đang tải phiên bản'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT CONTAINER (RESPONSIVE CHO CẢ MOBILE VÀ DESKTOP) ─── */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-8 md:space-y-12">
        
        {/* HERO BANNER: TỰ ĐỘNG NHẬN DIỆN THIẾT BỊ ĐANG DÙNG */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A237E] via-indigo-900 to-slate-900 text-white p-6 sm:p-10 shadow-xl shadow-indigo-950/20 border border-indigo-500/20">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-16 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 md:gap-10">
            <div className="space-y-4 text-center lg:text-left w-full lg:w-3/5">
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold px-3.5 py-1.5 rounded-full">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Thiết bị nhận diện: <strong>{os === 'mac' ? 'macOS (MacBook/iMac)' : os === 'windows' ? 'Máy tính Windows' : os === 'android' ? 'Điện thoại Android' : os === 'ios' ? 'iPhone / iPad (iOS)' : 'Máy tính / Trình duyệt'}</strong></span>
              </div>

              <h3 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                Tải gói cài đặt tối ưu cho <span className="text-emerald-400">{detectedPkg.name}</span>
              </h3>

              <p className="text-indigo-100 text-xs sm:text-sm leading-relaxed max-w-2xl">
                Ứng dụng vận hành độc lập hoàn toàn trên thiết bị của bạn. Tự động sao lưu dữ liệu cục bộ, xuất Excel Offline không cần mạng và tự động cập nhật khi có phiên bản mới từ VPS.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-indigo-200 pt-1">
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Bản phát hành chính thức</span>
                <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-400" /> Tự động cập nhật OTA 1 chạm</span>
                <span className="flex items-center gap-1.5"><HardDrive className="w-4 h-4 text-indigo-300" /> Dung lượng: <strong className="text-white ml-1">{selectedPackageSize}</strong></span>
              </div>
            </div>

            {/* ACTION DOWNLOAD BUTTONS */}
            <div className="w-full lg:w-auto shrink-0 flex flex-col sm:flex-row lg:flex-col gap-3">
              <a
                href={selectedPackageUrl}
                download={detectedPkg.filename}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black rounded-2xl shadow-xl shadow-emerald-500/30 text-sm sm:text-base uppercase tracking-wider transition-all cursor-pointer"
              >
                <Download className="w-5 h-5 stroke-[2.5]" />
                <span>Tải ngay ({selectedPackageSize})</span>
              </a>

              {os === 'android' && (
                <div className="text-center">
                  <p className="text-[11px] text-emerald-300/80 font-medium">
                    ✨ Sau khi cài đặt APK, ứng dụng sẽ tự động cập nhật 1 chạm các lần sau
                  </p>
                </div>
              )}

              <a
                href="#all-platforms"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold rounded-xl text-xs transition-all"
              >
                <span>Xem tất cả nền tảng khác</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* ─── TẤT CẢ GÓI CÀI ĐẶT CHO MỌI THIẾT BỊ (RESPONSIVE GRID) ─── */}
        <div id="all-platforms" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Tất cả các gói cài đặt
              </h3>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Lựa chọn phiên bản phù hợp để cài đặt cho điện thoại nhân viên hoặc máy tính cửa hàng
              </p>
            </div>
          </div>

          {releaseInfoErrors.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Chưa tải được thông tin phiên bản của: {releaseInfoErrors.join(', ')}. Các gói tải vẫn được giữ nguyên.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {packages.map((pkg) => {
              const Icon = pkg.icon;
              const isCurrent = pkg.id === os;
              const platform: ReleasePlatform = pkg.id === 'ios' ? 'web' : pkg.id as ReleasePlatform;
              const pkgRelease = releaseInfo[platform];
              const packageSize = pkg.id === 'ios' ? pkg.size : formatDownloadSize(pkgRelease?.downloadSize, pkg.size);
              const packageUrl = pkg.id === 'ios' || !pkgRelease
                ? pkg.directUrl
                : pkgRelease.downloadUrl
                  ? (pkgRelease.downloadUrl.startsWith('http')
                    ? pkgRelease.downloadUrl
                    : `https://dunvex.com${pkgRelease.downloadUrl}`)
                  : `${pkg.directUrl}${pkg.directUrl.includes('?') ? '&' : '?'}v=${pkgRelease.buildNumber}`;

              return (
                <div
                  key={pkg.id}
                  className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border transition-all flex flex-col justify-between relative overflow-hidden ${
                    isCurrent
                      ? 'border-indigo-500 dark:border-indigo-400 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                      : 'border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                      Đang dùng thiết bị này
                    </div>
                  )}

                  <div>
                    {/* ICON & BADGE */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${pkg.accentColor} text-white shadow-md`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${pkg.badgeColor}`}>
                        {packageSize}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-slate-900 dark:text-white mb-1">
                      {pkg.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 min-h-[32px] line-clamp-2">
                      {pkg.subtitle}
                    </p>
                    {pkgRelease && (
                      <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 mb-3">
                        v{pkgRelease.version} · Build {pkgRelease.buildNumber}
                        {pkgRelease.releaseDate ? ` · ${pkgRelease.releaseDate}` : ''}
                      </p>
                    )}

                    {/* FEATURE LIST */}
                    <div className="space-y-2 mb-6 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-4">
                      {pkg.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="leading-tight">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* DOWNLOAD BUTTON */}
                  <a
                    href={packageUrl}
                    download={pkg.filename}
                    className={`w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md ${pkg.btnColor}`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải về ({packageSize})</span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── KHỐI QUÉT MÃ QR CHO ĐIỆN THOẠI & HƯỚNG DẪN 3 BƯỚC ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* QR CODE CARD */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center gap-6">
            <div className="shrink-0 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner flex flex-col items-center">
              <QRCodeSVG
                value="https://dunvex.com/dunvex_app.apk"
                size={130}
                level="H"
                includeMargin={false}
              />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">
                Quét mã tải APK
              </span>
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase">
                <QrCode className="w-4 h-4" />
                <span>Cài nhanh điện thoại</span>
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                Quét mã Camera để tải trực tiếp APK
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mở camera trên điện thoại Android của bạn, quét mã QR trên để tải file APK và cài đặt trong 1 chạm.
              </p>
            </div>
          </div>

          {/* 3 BƯỚC CÀI ĐẶT NHANH */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <h4 className="text-base font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF6D00]" />
              <span>3 bước cài đặt đơn giản trên Android</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="size-7 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center mb-2">1</div>
                <h5 className="text-xs font-black text-slate-900 dark:text-white mb-1">Bấm Tải file APK</h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Tải file <code className="text-indigo-600 dark:text-indigo-400 font-bold">dunvex_app.apk</code> về máy.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="size-7 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center mb-2">2</div>
                <h5 className="text-xs font-black text-slate-900 dark:text-white mb-1">Mở File đã tải</h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Bấm mở file từ thanh thông báo hoặc Quản lý tệp (Downloads).</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="size-7 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center mb-2">3</div>
                <h5 className="text-xs font-black text-slate-900 dark:text-white mb-1">Chọn Cài Đặt</h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Cho phép cài đặt và mở app đăng nhập là hoàn tất!</p>
              </div>
            </div>
          </div>

        </div>

        {/* ─── CHANGELOG & THÔNG TIN PHIÊN BẢN ─── */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {selectedRelease
                  ? `Nhật ký ${selectedPlatform} v${selectedRelease.version} (Build ${selectedRelease.buildNumber})`
                  : `Thông tin phiên bản ${selectedPlatform}`}
              </h4>
            </div>
            <span className="text-xs text-slate-400 font-bold">Ngày {selectedRelease?.releaseDate || '—'}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedChangelog.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-700 dark:text-slate-300">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{item}</span>
              </div>
            ))}
            {selectedChangelog.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có ghi chú phát hành cho nền tảng này.</p>
            )}
          </div>
        </div>

      </div>

      {/* ─── PUBLIC FOOTER (CHỈ HIỆN KHI Ở CHẾ ĐỘ PUBLIC) ─── */}
      {isPublic && (
        <footer className="py-8 px-6 text-center border-t border-slate-100 dark:border-slate-800 mt-auto bg-white dark:bg-slate-900 transition-colors duration-300">
          <div className="flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
              Dunvex<span className="text-[#FF6D00]">Build</span> POS & Production System
            </p>
            <p className="text-[10px] font-bold text-slate-400">
              © 2026 High-Performance Native Architecture • Tối ưu hoá Offline-First
            </p>
          </div>
        </footer>
      )}

    </div>
  );
};

export default DownloadApp;
