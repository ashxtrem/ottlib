plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

kotlin { jvmToolchain(17) }

dependencies {
    api(libs.kotlinx.serialization.json)
    testImplementation(libs.junit)
}

tasks.test {
    // Response fixtures written by packages/server/src/routes/nativeClient.test.ts.
    systemProperty("contract.fixtures", rootProject.projectDir.resolve("../../contract/fixtures").canonicalPath)
    inputs.dir(rootProject.projectDir.resolve("../../contract/fixtures"))
}
