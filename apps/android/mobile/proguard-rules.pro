# FFmpeg decoders (nextlib) are called from native code by class/field/method name.
-keep class io.github.anilbeesetti.nextlib.** { *; }
-keep class androidx.media3.decoder.** { *; }
-keepclasseswithmembernames class * { native <methods>; }

# API models are decoded with kotlinx.serialization; keep their generated serializers.
-keepattributes *Annotation*, InnerClasses
-keep,includedescriptorclasses class dev.ottlib.core.model.**$$serializer { *; }
-keepclassmembers class dev.ottlib.core.model.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
