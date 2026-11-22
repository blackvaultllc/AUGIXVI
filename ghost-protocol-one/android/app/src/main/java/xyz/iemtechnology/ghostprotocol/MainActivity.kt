package xyz.iemtechnology.ghostprotocol

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlin.concurrent.thread

/**
 * GHOST PROTOCOL ONE — v0.1 face. Deliberately plain: core address,
 * pairing token, start/stop, and a live status log that says exactly
 * what the radios and the core reported — including throttles,
 * refusals, and empty reads. No invented state anywhere.
 *
 * The wand watch: scans run on a 30-second cadence while started
 * (subject to Android's scan throttle; a throttled scan is logged,
 * not hidden). Every scan's networks go to the core, which keeps the
 * watched SSIDs — SOFTISH-1851 above all.
 */
class MainActivity : Activity() {

    private lateinit var coreUrlField: EditText
    private lateinit var tokenField: EditText
    private lateinit var statusView: TextView
    private lateinit var toggleButton: Button

    private val handler = Handler(Looper.getMainLooper())
    private var watcher: WifiWatcher? = null
    private var ble: BleWatcher? = null
    private var running = false

    private val scanLoop = object : Runnable {
        override fun run() {
            if (!running) return
            val accepted = watcher?.requestScan() ?: false
            if (!accepted) log("Wi-Fi scan request refused by the OS (throttled or Wi-Fi off).")
            handler.postDelayed(this, 30_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = getSharedPreferences("ghost", MODE_PRIVATE)

        coreUrlField = EditText(this).apply {
            hint = "Core address — e.g. http://100.67.177.55:8081"
            setText(prefs.getString("coreUrl", ""))
        }
        tokenField = EditText(this).apply {
            hint = "Pairing token (from the core: ghost-token.txt)"
            setText(prefs.getString("pairingToken", ""))
        }
        toggleButton = Button(this).apply {
            text = "Start watching"
            setOnClickListener { if (running) stopWatching() else startWatching() }
        }
        val healthButton = Button(this).apply {
            text = "Read watch vitals (Health Connect)"
            setOnClickListener { readVitals() }
        }
        statusView = TextView(this).apply { text = "Idle." }

        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
            addView(coreUrlField)
            addView(tokenField)
            addView(toggleButton)
            addView(healthButton)
            addView(statusView)
        })
    }

    private fun startWatching() {
        val needed = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
        )
        if (needed.any { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }) {
            requestPermissions(needed, 1)
            log("Permissions requested — grant them, then tap Start again.")
            return
        }
        val prefs = getSharedPreferences("ghost", MODE_PRIVATE)
        prefs.edit()
            .putString("coreUrl", coreUrlField.text.toString().trim())
            .putString("pairingToken", tokenField.text.toString().trim())
            .apply()

        watcher = WifiWatcher(this).apply {
            onScan = { networks, stale ->
                val wand = networks.firstOrNull { it.ssid == WAND_SSID }
                log(
                    "Scan: ${networks.size} networks" +
                        (if (stale) " (OS marked results stale)" else "") +
                        (if (wand != null) " — WAND UP at ${wand.rssi} dBm" else " — wand not heard"),
                )
                reportToCore(networks)
            }
            start()
        }
        ble = BleWatcher(this).apply {
            onSighting = { s -> if (s.name != null) log("BLE: ${s.name} at ${s.rssi} dBm") }
        }
        val bleOk = ble?.start() ?: false
        if (!bleOk) log("BLE scan could not start (Bluetooth off or unavailable).")

        running = true
        toggleButton.text = "Stop watching"
        handler.post(scanLoop)
        log("Watching. The core hears what this phone hears.")
    }

    private fun stopWatching() {
        running = false
        handler.removeCallbacks(scanLoop)
        watcher?.stop()
        ble?.stop()
        toggleButton.text = "Start watching"
        log("Stopped.")
    }

    private fun reportToCore(networks: List<CoreClient.Network>) {
        val coreUrl = coreUrlField.text.toString().trim()
        val token = tokenField.text.toString().trim()
        if (coreUrl.isEmpty() || token.isEmpty()) {
            log("Not reporting: core address or pairing token is empty.")
            return
        }
        thread {
            val answer = CoreClient.postSightings(coreUrl, token, networks)
            runOnUiThread { log("Core: $answer") }
        }
    }

    private fun readVitals() {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val latest = HealthReader.readLatest(this@MainActivity)
                when {
                    latest == null ->
                        log("Health Connect is not available on this phone.")
                    latest.heartRateBpm == null &&
                        latest.systolicMmHg == null &&
                        latest.oxygenPercent == null ->
                        log("Watch vitals: UNAVAILABLE — Health Connect holds no readings from the last hour. The watch app may not write here.")
                    else ->
                        log(
                            "Watch vitals: heart ${latest.heartRateBpm ?: "—"} bpm · " +
                                "BP ${latest.systolicMmHg ?: "—"}/${latest.diastolicMmHg ?: "—"} · " +
                                "O2 ${latest.oxygenPercent ?: "—"}%",
                        )
                }
            } catch (e: Exception) {
                log("Watch vitals: could not read (${e.message}). Grant the Health Connect permissions first.")
            }
        }
    }

    private fun log(line: String) {
        val stamp = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())
        statusView.text = "[$stamp] $line\n\n${statusView.text}".take(4_000)
    }

    companion object {
        /** The wand's hotspot — named here for the on-screen callout;
         *  the core's watch-list is the real filter. */
        const val WAND_SSID = "SOFTISH-1851"
    }
}
