package xyz.albamount.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.getSystemService
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

/**
 * Albamount Android shell for Google Play: same live site plus splash,
 * offline/error UI, and pull-to-refresh (Policy 4.3 helpers).
 */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var splash: View
    private lateinit var offlinePanel: View
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private val fileChooser = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback
        filePathCallback = null
        if (callback == null) return@registerForActivityResult
        val data = result.data
        val uris = when {
            result.resultCode != RESULT_OK -> null
            data?.clipData != null -> {
                val clip = data.clipData!!
                Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
            }
            data?.data != null -> arrayOf(data.data!!)
            else -> null
        }
        callback.onReceiveValue(uris)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val root = FrameLayout(this).apply { setBackgroundColor(BG_COLOR) }

        swipeRefresh = SwipeRefreshLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setColorSchemeColors(0xFF1F8A5A.toInt(), 0xFFC9A227.toInt())
            setOnRefreshListener {
                if (isOnline()) webView.reload() else {
                    isRefreshing = false
                    showOffline(true)
                }
            }
        }

        webView = WebView(this).apply {
            setBackgroundColor(BG_COLOR)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.mediaPlaybackRequiresUserGesture = false
            settings.userAgentString = settings.userAgentString + " AlbamountApp/${BuildConfig.VERSION_NAME}"

            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val host = request.url.host.orEmpty().lowercase()
                    val internal = host.isEmpty() ||
                        host == "albamount.xyz" ||
                        host.endsWith(".albamount.xyz")
                    return if (internal) {
                        false
                    } else {
                        runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                        true
                    }
                }

                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                    CookieManager.getInstance().flush()
                    if (!isOnline()) showOffline(true)
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    CookieManager.getInstance().flush()
                    splash.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                    if (isOnline()) showOffline(false)
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    if (request?.isForMainFrame == true) {
                        splash.visibility = View.GONE
                        swipeRefresh.isRefreshing = false
                        showOffline(true)
                    }
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback
                    val intent = fileChooserParams?.createIntent()
                        ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = "image/*"
                            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                        }
                    return try {
                        fileChooser.launch(intent)
                        true
                    } catch (_: Exception) {
                        this@MainActivity.filePathCallback = null
                        false
                    }
                }
            }
        }

        swipeRefresh.addView(
            webView,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        root.addView(swipeRefresh)

        splash = buildSplash()
        offlinePanel = buildOfflinePanel()
        root.addView(splash)
        root.addView(offlinePanel)
        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, windowInsets ->
            val bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(root)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) webView.goBack() else finish()
                }
            }
        )

        registerNetworkCallback()
        val start = savedInstanceState?.getString(STATE_URL) ?: BuildConfig.SITE_URL
        if (isOnline()) {
            webView.loadUrl(start)
        } else {
            splash.visibility = View.GONE
            showOffline(true)
        }
    }

    private fun buildSplash(): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(BG_COLOR)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            addView(TextView(context).apply {
                text = "Albamount"
                setTextColor(0xFFE8D5A3.toInt())
                textSize = 28f
                setTypeface(typeface, Typeface.BOLD)
                gravity = Gravity.CENTER
            })
            addView(ProgressBar(context).apply {
                val lp = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
                lp.topMargin = (24 * resources.displayMetrics.density).toInt()
                layoutParams = lp
            })
        }
    }

    private fun buildOfflinePanel(): View {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(BG_COLOR)
            visibility = View.GONE
            setPadding(48, 48, 48, 48)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            addView(TextView(context).apply {
                text = getString(R.string.offline_title)
                setTextColor(0xFFE8D5A3.toInt())
                textSize = 22f
                gravity = Gravity.CENTER
                setTypeface(typeface, Typeface.BOLD)
            })
            addView(TextView(context).apply {
                text = getString(R.string.offline_body)
                setTextColor(Color.WHITE)
                textSize = 15f
                gravity = Gravity.CENTER
                val lp = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
                lp.topMargin = (12 * resources.displayMetrics.density).toInt()
                layoutParams = lp
            })
            addView(Button(context).apply {
                text = getString(R.string.offline_retry)
                val lp = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
                lp.topMargin = (20 * resources.displayMetrics.density).toInt()
                layoutParams = lp
                setOnClickListener {
                    if (isOnline()) {
                        showOffline(false)
                        splash.visibility = View.VISIBLE
                        webView.loadUrl(BuildConfig.SITE_URL)
                    }
                }
            })
        }
    }

    private fun showOffline(show: Boolean) {
        offlinePanel.visibility = if (show) View.VISIBLE else View.GONE
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService<ConnectivityManager>() ?: return true
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun registerNetworkCallback() {
        val cm = getSystemService<ConnectivityManager>() ?: return
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread {
                    if (offlinePanel.visibility == View.VISIBLE) {
                        showOffline(false)
                        splash.visibility = View.VISIBLE
                        webView.loadUrl(webView.url ?: BuildConfig.SITE_URL)
                    }
                }
            }

            override fun onLost(network: Network) {
                runOnUiThread { showOffline(true) }
            }
        }
        networkCallback = callback
        runCatching { cm.registerDefaultNetworkCallback(callback) }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(STATE_URL, webView.url)
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onDestroy() {
        networkCallback?.let { cb ->
            runCatching { getSystemService<ConnectivityManager>()?.unregisterNetworkCallback(cb) }
        }
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val STATE_URL = "webview_url"
        private const val BG_COLOR = 0xFF0A1F16.toInt()
    }
}
