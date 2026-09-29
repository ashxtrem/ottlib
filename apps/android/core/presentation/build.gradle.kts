plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "dev.ottlib.core.presentation"
    compileSdk = 36
    defaultConfig { minSdk = 28 }
    buildFeatures { compose = true }
    // Failure messages log through android.util.Log; unit tests just get its default (no-op) behaviour.
    testOptions { unitTests.isReturnDefaultValues = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin { jvmToolchain(17) }

// ViewModels and UI-neutral helpers shared by the TV and phone apps. Compose is used only for colours and the
// appContainer() accessor; screens stay in the app modules.
dependencies {
    api(project(":core:data"))
    api(project(":core:discovery"))
    api(project(":core:player"))

    api(platform(libs.compose.bom))
    api(libs.compose.ui)
    api(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
