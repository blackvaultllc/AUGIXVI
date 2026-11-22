package xyz.iemtechnology.ghostprotocol

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * The tunnel to the owner's core. Plain HTTP on the owner's own
 * LAN/tailnet addresses only — the core refuses reports from public
 * addresses and from any phone without the pairing token, so a wrong
 * URL simply fails honestly.
 */
object CoreClient {

    data class Network(val ssid: String, val rssi: Int?)

    /**
     * POST one scan to /api/devices/phone-sightings.
     * Returns the server's answer text (or an error description) so
     * the UI can show exactly what the core said — never a guess.
     */
    fun postSightings(coreBaseUrl: String, pairingToken: String, networks: List<Network>): String {
        val payload = JSONObject().apply {
            put("at", System.currentTimeMillis())
            put("networks", JSONArray().apply {
                for (n in networks) {
                    put(JSONObject().apply {
                        put("ssid", n.ssid)
                        if (n.rssi != null) put("rssi", n.rssi)
                    })
                }
            })
        }
        val url = URL(coreBaseUrl.trimEnd('/') + "/api/devices/phone-sightings")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 5_000
            readTimeout = 5_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("x-ghost-token", pairingToken)
        }
        return try {
            conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader()?.readText() ?: ""
            "HTTP ${conn.responseCode} $body"
        } catch (e: Exception) {
            "UNREACHABLE: ${e.message}"
        } finally {
            conn.disconnect()
        }
    }
}
