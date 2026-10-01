package dev.ottlib.core.update

/**
 * A release version as the release workflow builds it (.github/workflows/release.yml): tag `v1.2.3` becomes
 * versionName `1.2.3` and versionCode `1 * 10000 + 2 * 100 + 3`, so comparing codes compares versions.
 */
data class ReleaseVersion(val name: String, val code: Int) {
    companion object {
        private val tag = Regex("^v?(\\d+)\\.(\\d+)\\.(\\d+)(-[0-9A-Za-z.]+)?$")

        fun fromTag(value: String): ReleaseVersion? {
            val match = tag.matchEntire(value.trim()) ?: return null
            val (major, minor, patch) = match.destructured
            return ReleaseVersion(value.trim().removePrefix("v"), major.toInt() * 10_000 + minor.toInt() * 100 + patch.toInt())
        }
    }
}
