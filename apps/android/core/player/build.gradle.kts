plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "dev.ottlib.core.player"
    compileSdk = 36
    defaultConfig { minSdk = 28 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin { jvmToolchain(17) }

dependencies {
    api(project(":core:model"))
    api(libs.media3.exoplayer)
    implementation(libs.media3.datasource.okhttp)
    // Prebuilt FFmpeg decoders for Media3: software fallback for DTS / TrueHD audio and MPEG-4 ASP video.
    implementation(libs.nextlib.media3ext)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.coroutines.android)
    testImplementation(libs.junit)
}
