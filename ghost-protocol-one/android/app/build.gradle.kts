plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "xyz.iemtechnology.ghostprotocol"
    compileSdk = 34

    defaultConfig {
        applicationId = "xyz.iemtechnology.ghostprotocol"
        minSdk = 29
        targetSdk = 34
        versionCode = 1
        versionName = "0.1"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.health.connect:connect-client:1.1.0-alpha07")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
