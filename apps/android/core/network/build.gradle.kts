plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

kotlin { jvmToolchain(17) }

dependencies {
    api(project(":core:model"))
    api(libs.okhttp)
    api(libs.kotlinx.coroutines.core)
    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.kotlinx.coroutines.test)
}

tasks.test {
    systemProperty("contract.fixtures", rootProject.projectDir.resolve("../../contract/fixtures").canonicalPath)
    inputs.dir(rootProject.projectDir.resolve("../../contract/fixtures"))
}
