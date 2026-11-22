package xyz.iemtechnology.ghostprotocol

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.WifiManager
import android.os.Build

/**
 * The phone's Wi-Fi ear. One scan per requestScan() call; results
 * arrive through the SCAN_RESULTS broadcast. Android throttles
 * scans (foreground: 4 per 2 minutes) — startScan() returns false
 * when throttled, and this class reports that honestly instead of
 * pretending a scan happened.
 *
 * The watcher reports EVERY network it hears; the core keeps only
 * the watched SSIDs. Filtering at the core keeps the watch-list in
 * one place (the registry), exactly like the Parrot watcher.
 */
class WifiWatcher(private val context: Context) {

    private val wifiManager =
        context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    @Volatile
    var onScan: ((networks: List<CoreClient.Network>, throttled: Boolean) -> Unit)? = null

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            if (intent.action != WifiManager.SCAN_RESULTS_AVAILABLE_ACTION) return
            val ok = intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, true)
            @Suppress("DEPRECATION")
            val results = wifiManager.scanResults
            val networks = results
                .filter { !it.SSID.isNullOrBlank() }
                .map { CoreClient.Network(it.SSID, it.level) }
            onScan?.invoke(networks, !ok)
        }
    }

    fun start() {
        context.registerReceiver(
            receiver,
            IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION),
        )
    }

    fun stop() {
        try {
            context.unregisterReceiver(receiver)
        } catch (_: IllegalArgumentException) {
            // Already unregistered — stopping twice is harmless.
        }
    }

    /** True when the OS accepted the scan request. */
    fun requestScan(): Boolean {
        @Suppress("DEPRECATION")
        return wifiManager.startScan()
    }

    companion object {
        /** Android 10+ signal level is already dBm in ScanResult.level. */
        fun sdkSupportsScanResults(): Boolean = Build.VERSION.SDK_INT >= 29
    }
}
