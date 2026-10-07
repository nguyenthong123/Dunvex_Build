package com.dunvex.build;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupNativeBridges();
    }

    @Override
    public void onStart() {
        super.onStart();
        setupNativeBridges();
    }

    private void setupNativeBridges() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                AndroidAppUpdaterInterface updater = new AndroidAppUpdaterInterface(this, webView);
                webView.addJavascriptInterface(new AndroidPrintInterface(this, webView), "AndroidPrint");
                webView.addJavascriptInterface(new AndroidClipboardInterface(this, webView), "AndroidClipboard");
                webView.addJavascriptInterface(updater, "AndroidAppUpdater");

                webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
                    if (url != null && (url.endsWith(".apk") || url.contains(".apk"))) {
                        updater.downloadAndInstallApk(url);
                    } else if (url != null) {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception ignored) {}
                    }
                });
            }
        } catch (Throwable t) {
            // Guard against any runtime reflection or initialization exceptions
        }
    }

    // ─── 1. In-App One-Tap APK Auto-Updater ─────────────────────
    public static class AndroidAppUpdaterInterface {
        private final Context context;
        private final WebView webView;

        public AndroidAppUpdaterInterface(Context context, WebView webView) {
            this.context = context;
            this.webView = webView;
        }

        @JavascriptInterface
        public int getVersionCode() {
            try {
                PackageInfo packageInfo = context.getPackageManager()
                    .getPackageInfo(context.getPackageName(), 0);
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? (int) packageInfo.getLongVersionCode()
                    : packageInfo.versionCode;
            } catch (PackageManager.NameNotFoundException e) {
                Log.e("DunvexUpdater", "Unable to read installed app version", e);
                return -1;
            }
        }

        @JavascriptInterface
        public int getLastPromptedBuild() {
            return updatePreferences().getInt("last_prompted_build", 0);
        }

        @JavascriptInterface
        public void markBuildPrompted(int buildNumber) {
            int lastPromptedBuild = getLastPromptedBuild();
            if (buildNumber > lastPromptedBuild) {
                updatePreferences().edit().putInt("last_prompted_build", buildNumber).apply();
            }
        }

        private SharedPreferences updatePreferences() {
            return context.getSharedPreferences("dunvex_app_updates", Context.MODE_PRIVATE);
        }

        @JavascriptInterface
        public void downloadAndInstallApk(String apkUrl) {
            new Thread(() -> {
                try {
                    sendEvent("apk_download_progress", 0, "Bắt đầu kết nối máy chủ...");
                    URL url = new URL(apkUrl);
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(30000);
                    connection.setInstanceFollowRedirects(true);
                    connection.connect();

                    int responseCode = connection.getResponseCode();
                    if (responseCode != HttpURLConnection.HTTP_OK) {
                        sendEvent("apk_download_error", -1, "Không thể tải file APK từ máy chủ (HTTP " + responseCode + ")");
                        return;
                    }

                    int fileLength = connection.getContentLength();
                    File cacheDir = context.getExternalCacheDir() != null ? context.getExternalCacheDir() : context.getCacheDir();
                    File apkFile = new File(cacheDir, "Dunvex_Update.apk");
                    if (apkFile.exists()) {
                        apkFile.delete();
                    }

                    InputStream input = connection.getInputStream();
                    OutputStream output = new FileOutputStream(apkFile);

                    byte[] data = new byte[16384];
                    long total = 0;
                    int count;
                    int lastPercent = 0;

                    while ((count = input.read(data)) != -1) {
                        total += count;
                        if (fileLength > 0) {
                            int percent = (int) (total * 100 / fileLength);
                            if (percent != lastPercent && percent % 5 == 0) {
                                lastPercent = percent;
                                sendEvent("apk_download_progress", percent, "Đang tải bản cập nhật: " + percent + "%");
                            }
                        }
                        output.write(data, 0, count);
                    }

                    output.flush();
                    output.close();
                    input.close();

                    sendEvent("apk_download_progress", 100, "Đang mở trình cài đặt...");

                    // Trigger Android OS Package Installer
                    new Handler(Looper.getMainLooper()).post(() -> {
                        try {
                            Intent intent = new Intent(Intent.ACTION_VIEW);
                            Uri apkUri = FileProvider.getUriForFile(
                                context,
                                context.getPackageName() + ".fileprovider",
                                apkFile
                            );
                            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            context.startActivity(intent);
                        } catch (Exception ex) {
                            ex.printStackTrace();
                            sendEvent("apk_download_error", -1, "Lỗi mở trình cài đặt: " + ex.getMessage());
                        }
                    });

                } catch (Exception e) {
                    e.printStackTrace();
                    sendEvent("apk_download_error", -1, "Lỗi tải bản cập nhật: " + e.getMessage());
                }
            }).start();
        }

        private void sendEvent(String eventName, int progress, String message) {
            new Handler(Looper.getMainLooper()).post(() -> {
                if (webView != null) {
                    String cleanMsg = message.replace("\\", "\\\\").replace("'", "\\'");
                    String js = String.format(
                        "window.dispatchEvent(new CustomEvent('%s', { detail: { progress: %d, message: '%s' } }));",
                        eventName,
                        progress,
                        cleanMsg
                    );
                    webView.evaluateJavascript(js, null);
                }
            });
        }
    }

    // ─── 2. Android Native Print Service ────────────────────────
    public static class AndroidPrintInterface {
        private final Context context;
        private final WebView webView;

        public AndroidPrintInterface(Context context, WebView webView) {
            this.context = context;
            this.webView = webView;
        }

        @JavascriptInterface
        public void print() {
            if (webView == null || context == null) return;
            webView.post(() -> {
                try {
                    PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                    if (printManager != null) {
                        PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter("Dunvex_Document");
                        PrintAttributes.Builder builder = new PrintAttributes.Builder();
                        builder.setColorMode(PrintAttributes.COLOR_MODE_COLOR);
                        builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                        printManager.print("Dunvex Document", printAdapter, builder.build());
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        @JavascriptInterface
        public void printHtml(String html, String jobName, String paperSize) {
            if (context == null || html == null) return;
            final String title = (jobName != null && !jobName.trim().isEmpty()) ? jobName : "Dunvex_Order_Receipt";
            final String normalizedPaperSize = (paperSize == null || paperSize.trim().isEmpty()) ? "a4" : paperSize.trim().toLowerCase();
            new Handler(Looper.getMainLooper()).post(() -> {
                try {
                    WebView printWebView = new WebView(context);
                    printWebView.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            super.onPageFinished(view, url);
                            try {
                                PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                                if (printManager != null) {
                                    PrintDocumentAdapter printAdapter = printWebView.createPrintDocumentAdapter(title);
                                    PrintAttributes.Builder builder = new PrintAttributes.Builder();
                                    builder.setColorMode(PrintAttributes.COLOR_MODE_COLOR);

                                    PrintAttributes.MediaSize mediaSize = PrintAttributes.MediaSize.ISO_A4;
                                    switch (normalizedPaperSize) {
                                        case "a5":
                                            mediaSize = PrintAttributes.MediaSize.ISO_A5;
                                            break;
                                        case "k57":
                                            mediaSize = new PrintAttributes.MediaSize("DUNVEX_57MM", "57mm", 2244, 4000);
                                            break;
                                        case "k80":
                                            mediaSize = new PrintAttributes.MediaSize("DUNVEX_80MM", "80mm", 3150, 5000);
                                            break;
                                        default:
                                            mediaSize = PrintAttributes.MediaSize.ISO_A4;
                                            break;
                                    }
                                    builder.setMediaSize(mediaSize);
                                    printManager.print(title, printAdapter, builder.build());
                                }
                            } catch (Exception ex) {
                                ex.printStackTrace();
                            }
                        }
                    });
                    printWebView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }
    }

    // ─── 3. Android Native Clipboard & Gallery Interface ────────
    public static class AndroidClipboardInterface {
        private final Context context;
        private final WebView webView;

        public AndroidClipboardInterface(Context context, WebView webView) {
            this.context = context;
            this.webView = webView;
        }

        @JavascriptInterface
        public boolean copyImageBase64(String base64Data, String fileName) {
            try {
                if (base64Data == null || base64Data.trim().isEmpty()) return false;
                String cleanB64 = base64Data.contains(",") ? base64Data.substring(base64Data.indexOf(",") + 1) : base64Data;
                byte[] imageBytes = android.util.Base64.decode(cleanB64, android.util.Base64.DEFAULT);

                // 1. Save to cache directory for FileProvider
                File cacheDir = context.getExternalCacheDir() != null ? context.getExternalCacheDir() : context.getCacheDir();
                File imagesFolder = new File(cacheDir, "dunvex_clips");
                if (!imagesFolder.exists()) {
                    imagesFolder.mkdirs();
                }

                String safeName = (fileName != null && !fileName.trim().isEmpty()) ? fileName : ("dunvex_ticket_" + System.currentTimeMillis() + ".png");
                if (!safeName.endsWith(".png")) safeName += ".png";

                File imageFile = new File(imagesFolder, safeName);
                FileOutputStream fos = new FileOutputStream(imageFile);
                fos.write(imageBytes);
                fos.flush();
                fos.close();

                // 2. Obtain content URI via FileProvider
                Uri contentUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    imageFile
                );

                // JavascriptInterface calls run off the UI thread; complete the clipboard write
                // before reporting success back to JavaScript.
                android.content.ClipboardManager clipboard = (android.content.ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard == null) return false;
                android.content.ClipDescription description = new android.content.ClipDescription("Dunvex Ticket", new String[]{ "image/png", "image/*" });
                android.content.ClipData.Item item = new android.content.ClipData.Item(contentUri);
                android.content.ClipData clip = new android.content.ClipData(description, item);
                clipboard.setPrimaryClip(clip);

                // 4. Also register into MediaStore / Pictures so Zalo gallery picker immediately sees it
                try {
                    android.content.ContentValues values = new android.content.ContentValues();
                    values.put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, safeName);
                    values.put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/png");
                    values.put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, android.os.Environment.DIRECTORY_PICTURES + "/Dunvex");
                    Uri mediaUri = context.getContentResolver().insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                    if (mediaUri != null) {
                        OutputStream outStream = context.getContentResolver().openOutputStream(mediaUri);
                        if (outStream != null) {
                            outStream.write(imageBytes);
                            outStream.flush();
                            outStream.close();
                        }
                    }
                } catch (Exception mediaEx) {
                    // Non-fatal if scoped storage prevents MediaStore insert
                }

                return true;
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }
    }
}
