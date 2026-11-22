package xyz.iemtechnology.ghostprotocol

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant

/**
 * The watch-vitals read path: whatever the watch's app has written
 * into Health Connect in the last hour — heart rate, blood pressure,
 * oxygen saturation.
 *
 * Honest limits, in code as in the design doc: if the watch app
 * (Da Fit class) never writes to Health Connect, every read returns
 * empty and the caller says UNAVAILABLE — the pipe exists, the water
 * is the watch app's choice. "Stress" is not a Health Connect record
 * type; it is not read here because it cannot be.
 */
object HealthReader {

    val PERMISSIONS: Set<String> = setOf(
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(BloodPressureRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class),
    )

    data class Latest(
        val heartRateBpm: Long?,
        val systolicMmHg: Double?,
        val diastolicMmHg: Double?,
        val oxygenPercent: Double?,
        val readAt: Instant,
    )

    /** Null when Health Connect is unavailable on this phone. */
    suspend fun readLatest(context: Context): Latest? {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            return null
        }
        val client = HealthConnectClient.getOrCreate(context)
        val now = Instant.now()
        val range = TimeRangeFilter.between(now.minusSeconds(3600), now)

        val heart = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, range))
            .records.lastOrNull()?.samples?.lastOrNull()?.beatsPerMinute
        val pressure = client.readRecords(ReadRecordsRequest(BloodPressureRecord::class, range))
            .records.lastOrNull()
        val oxygen = client.readRecords(ReadRecordsRequest(OxygenSaturationRecord::class, range))
            .records.lastOrNull()?.percentage?.value

        return Latest(
            heartRateBpm = heart,
            systolicMmHg = pressure?.systolic?.inMillimetersOfMercury,
            diastolicMmHg = pressure?.diastolic?.inMillimetersOfMercury,
            oxygenPercent = oxygen,
            readAt = now,
        )
    }
}
