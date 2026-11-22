package xyz.iemtechnology.ghostprotocol

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Context

/**
 * The phone's Bluetooth ear — BLE advertisements from the owner's
 * device line (the watch, future cube nodes). The advertised NAME
 * is the identity; BLE addresses are often randomized, so an
 * address alone is never treated as a device fingerprint.
 *
 * v0.1 reports what it hears to the UI/log only. The core has no
 * BLE sightings door yet — by design: BLE presence joins the core
 * when the device registry grows its BLE slot, not before. Nothing
 * here pretends otherwise.
 */
class BleWatcher(context: Context) {

    data class Sighting(val name: String?, val address: String, val rssi: Int)

    @Volatile
    var onSighting: ((Sighting) -> Unit)? = null

    private val adapter =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter

    private val callback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val name = result.scanRecord?.deviceName ?: result.device?.name
            onSighting?.invoke(Sighting(name, result.device.address, result.rssi))
        }
    }

    /** False when Bluetooth is off or absent — stated, not hidden. */
    @SuppressLint("MissingPermission") // caller holds BLUETOOTH_SCAN; the activity requests it first
    fun start(): Boolean {
        val scanner = adapter?.bluetoothLeScanner ?: return false
        if (adapter?.isEnabled != true) return false
        scanner.startScan(callback)
        return true
    }

    @SuppressLint("MissingPermission")
    fun stop() {
        try {
            adapter?.bluetoothLeScanner?.stopScan(callback)
        } catch (_: Exception) {
            // Scanner already stopped or Bluetooth turned off mid-run.
        }
    }
}
