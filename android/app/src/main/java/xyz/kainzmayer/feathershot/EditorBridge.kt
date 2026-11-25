package xyz.kainzmayer.feathershot

import android.content.ContentValues
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast
import java.io.IOException

/**
 * Native half of the editor's "Save & Download" button.
 * The page calls `FeatherShotNative.saveImage(...)` (see assets/feathershot-android.js).
 */
class EditorBridge(private val context: Context) {

    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun saveImage(base64Png: String, fileName: String): Boolean {
        val saved = try {
            writeToPictures(Base64.decode(base64Png, Base64.DEFAULT), sanitize(fileName))
            true
        } catch (e: Exception) {
            false
        }
        mainHandler.post {
            Toast.makeText(
                context,
                if (saved) R.string.saved_to_gallery else R.string.save_failed,
                Toast.LENGTH_LONG,
            ).show()
        }
        return saved
    }

    private fun writeToPictures(bytes: ByteArray, fileName: String) {
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/FeatherShot")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            ?: throw IOException("MediaStore insert failed")
        try {
            val out = resolver.openOutputStream(uri) ?: throw IOException("No output stream")
            out.use { it.write(bytes) }
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            throw e
        }
        values.clear()
        values.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
    }

    private fun sanitize(fileName: String): String {
        val cleaned = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_")
        return if (cleaned.endsWith(".png")) cleaned else "$cleaned.png"
    }
}
