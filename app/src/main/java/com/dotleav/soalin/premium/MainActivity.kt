package com.dotleav.soalin.premium

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Membungkus web app Soalin (folder assets/www) di WebView.
 * Halaman dimuat dari https://appassets.androidplatform.net/assets/www/ supaya
 * localStorage, IndexedDB, dan service worker berjalan seperti di browser.
 */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // Pemilih file untuk upload .docx / .pdf (input type=file di web app).
    private val pickFiles = registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        filePathCallback?.onReceiveValue(if (uris.isNullOrEmpty()) null else uris.toTypedArray())
        filePathCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        setContentView(web)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true            // localStorage & IndexedDB
            mediaPlaybackRequiresUserGesture = false  // suara benar/salah
            allowFileAccess = false
            allowContentAccess = false
            setSupportZoom(true)                      // pinch-to-zoom
            builtInZoomControls = true
            displayZoomControls = false               // sembunyikan tombol +/- bawaan
        }
        CookieManager.getInstance().setAcceptCookie(true)

        // Dipakai js/update-check.js: SoalinNative.installUpdate(url)
        web.addJavascriptInterface(UpdateBridge(), "SoalinNative")

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            // Link eksternal (mis. "Download template" ke Google Drive) dibuka di browser.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == "appassets.androidplatform.net") return false
                startActivity(Intent(Intent.ACTION_VIEW, url))
                return true
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                callback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                pickFiles.launch("*/*")
                return true
            }
        }

        // Tombol Back: kembali ke halaman sebelumnya di WebView, kalau tidak ada keluar app.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) {
                    web.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        if (savedInstanceState == null) {
            web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
        } else {
            web.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }

    /** Jembatan dari JS. Dipanggil dari background thread. */
    inner class UpdateBridge {
        @JavascriptInterface
        fun installUpdate(apkUrl: String) {
            if (!apkUrl.startsWith("https://raw.githubusercontent.com/")) return // hanya dari repo kita
            runOnUiThread { Toast.makeText(this@MainActivity, "Mengunduh update...", Toast.LENGTH_SHORT).show() }
            Thread {
                try {
                    val file = File(cacheDir, "update/update.apk")
                    file.parentFile?.mkdirs()
                    val conn = URL(apkUrl).openConnection() as HttpURLConnection
                    conn.connectTimeout = 15_000
                    conn.readTimeout = 60_000
                    conn.inputStream.use { input -> file.outputStream().use { input.copyTo(it) } }
                    conn.disconnect()
                    runOnUiThread { launchInstaller(file) }
                } catch (e: Exception) {
                    runOnUiThread { Toast.makeText(this@MainActivity, "Gagal mengunduh update", Toast.LENGTH_LONG).show() }
                }
            }.start()
        }
    }

    private fun launchInstaller(apk: File) {
        // Android 8+: user harus mengizinkan "instal aplikasi tidak dikenal" untuk Soalin sekali.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
            Toast.makeText(this, "Izinkan instal dari Soalin, lalu tekan Update lagi", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            return
        }
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", apk)
        startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }
}
