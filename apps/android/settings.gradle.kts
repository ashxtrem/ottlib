pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ottlib-android"

include(":core:model")
include(":core:network")
include(":core:data")
include(":core:discovery")
include(":core:player")
include(":core:presentation")
include(":tv")
