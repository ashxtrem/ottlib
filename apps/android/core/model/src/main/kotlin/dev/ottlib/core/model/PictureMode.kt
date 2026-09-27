package dev.ottlib.core.model

/** How the video picture is fitted to the screen (VLC's "aspect ratio" / "crop" options). */
enum class PictureMode(val label: String, val description: String, val scaling: Scaling, val aspectRatio: Float?) {
    Fit("Fit", "Whole picture, black bars where needed", Scaling.Fit, null),
    Zoom("Zoom", "Fill the screen, trim the edges", Scaling.Crop, null),
    Stretch("Stretch", "Fill the screen, distort the picture", Scaling.Stretch, null),
    SmartFill("Smart fill", "Fill the screen: trim a little, stretch a little", Scaling.Balanced, null),
    Wide("16:9", "Force a 16:9 picture", Scaling.Fit, 16f / 9f),
    Standard("4:3", "Force a 4:3 picture", Scaling.Fit, 4f / 3f),
    Cinema("2.39:1", "Force a 2.39:1 (scope) picture", Scaling.Fit, 2.39f);

    /** Balanced: stretch halfway towards the screen's shape, then crop the rest (see PictureGeometry). */
    enum class Scaling { Fit, Crop, Stretch, Balanced }

    companion object {
        fun fromName(name: String?): PictureMode? = entries.firstOrNull { it.name == name }
    }
}
