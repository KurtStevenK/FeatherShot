package xyz.kainzmayer.feathershot

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.Button
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.IntentCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.File

/**
 * Hosts the shared annotation editor (chrome-extension/editor.html) in a WebView.
 *
 * The editor is served from https://appassets.androidplatform.net so that the screenshot
 * and the canvas share one origin, which keeps the canvas readable for export.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var editor: WebView
    private lateinit var emptyState: View
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var incomingDir: File
    private var editorReady = false
    private var currentImageName: String? = null

    private val pickImage = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) importImage(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        setSupportActionBar(findViewById(R.id.toolbar))

        // targetSdk 35+ draws edge-to-edge, so keep the toolbar and editor clear of the system bars.
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        incomingDir = File(filesDir, "incoming").apply { mkdirs() }
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/incoming/", WebViewAssetLoader.InternalStoragePathHandler(this, incomingDir))
            .build()

        emptyState = findViewById(R.id.empty_state)
        findViewById<Button>(R.id.open_button).setOnClickListener { openPicker() }
        setupEditor()

        val restored = savedInstanceState?.getString(STATE_IMAGE)?.takeIf { File(incomingDir, it).exists() }
        if (restored != null) {
            currentImageName = restored
            showEditor(restored)
        }
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(STATE_IMAGE, currentImageName)
    }

    override fun onDestroy() {
        if (editorReady) editor.destroy()
        super.onDestroy()
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean =
        if (item.itemId == R.id.action_open) {
            openPicker()
            true
        } else {
            super.onOptionsItemSelected(item)
        }

    private fun setupEditor() {
        editor = findViewById(R.id.editor)
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            Toast.makeText(this, R.string.webview_too_old, Toast.LENGTH_LONG).show()
            return
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        editor.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
        }

        // Runs before the editor's own scripts: provides chrome.storage, touch input and Save.
        val shim = assets.open("feathershot-android.js").bufferedReader().use { it.readText() }
        WebViewCompat.addDocumentStartJavaScript(editor, shim, setOf(ORIGIN))
        editor.addJavascriptInterface(EditorBridge(applicationContext), "FeatherShotNative")

        editor.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)
        }
        // The editor uses confirm() for Clear; WebView needs a native dialog for it.
        editor.webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }
        }
        editorReady = true
    }

    private fun handleIntent(intent: Intent?) {
        val uri: Uri? = when (intent?.action) {
            Intent.ACTION_SEND ->
                if (intent.type?.startsWith("image/") == true) {
                    IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    null
                }
            Intent.ACTION_VIEW -> intent.data
            else -> null
        }
        if (uri != null) importImage(uri)
    }

    private fun openPicker() {
        pickImage.launch(arrayOf("image/*"))
    }

    /** Copies the picked image into app storage and opens it in the editor. */
    private fun importImage(uri: Uri) {
        val extension = when (contentResolver.getType(uri)) {
            "image/jpeg" -> "jpg"
            "image/webp" -> "webp"
            else -> "png"
        }
        val name = "image-${System.currentTimeMillis()}.$extension"
        val target = File(incomingDir, name)
        try {
            val input = contentResolver.openInputStream(uri) ?: throw IllegalStateException("No data for $uri")
            input.use { source -> target.outputStream().use { source.copyTo(it) } }
        } catch (e: Exception) {
            target.delete()
            Toast.makeText(this, R.string.open_failed, Toast.LENGTH_LONG).show()
            return
        }

        // Only the newest image is kept.
        incomingDir.listFiles()?.filter { it != target }?.forEach { it.delete() }
        currentImageName = name
        showEditor(name)
    }

    private fun showEditor(imageName: String) {
        if (!editorReady) return
        emptyState.visibility = View.GONE
        editor.visibility = View.VISIBLE
        editor.loadUrl("$ORIGIN/assets/editor/editor.html?img=${Uri.encode(imageName)}")
    }

    companion object {
        private const val ORIGIN = "https://appassets.androidplatform.net"
        private const val STATE_IMAGE = "current_image"
    }
}
