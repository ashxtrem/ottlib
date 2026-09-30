import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

// Optional release signing, shared with the TV app: apps/android/keystore.properties (git-ignored) with
// storeFile, storePassword, keyAlias, keyPassword. Without it, release builds use the debug key.
val keystoreProperties = Properties().apply {
    rootProject.file("keystore.properties").takeIf { it.exists() }?.inputStream()?.use(::load)
}

android {
    namespace = "dev.ottlib.mobile"
    compileSdk = 36

    defaultConfig {
        applicationId = "dev.ottlib.mobile"
        minSdk = 28
        targetSdk = 36
        // The release workflow passes these from the git tag (see .github/workflows/release.yml).
        versionCode = (findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = (findProperty("versionName") as String?) ?: "0.1.0"
        // Phones and foldables are 64-bit; x86_64 is for the emulator.
        ndk { abiFilters += listOf("arm64-v8a", "x86_64") }
    }

    signingConfigs {
        // keystore.properties for local builds; the ANDROID_KEYSTORE_* env vars for CI.
        val storePath = System.getenv("ANDROID_KEYSTORE_FILE") ?: keystoreProperties.getProperty("storeFile")?.let { rootProject.file(it).path }
        if (storePath != null) create("release") {
            storeFile = file(storePath)
            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: keystoreProperties.getProperty("storePassword")
            keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: keystoreProperties.getProperty("keyAlias")
            keyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: keystoreProperties.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin { jvmToolchain(17) }

dependencies {
    implementation(project(":core:presentation"))

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.material3.navigation.suite)
    implementation(libs.compose.material3.adaptive)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.media3.ui)
    implementation(libs.media3.session)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.junit)
}
