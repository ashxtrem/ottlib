# GitHub release responses are decoded with kotlinx.serialization; keep their generated serializers.
-keepattributes *Annotation*, InnerClasses
-keep,includedescriptorclasses class dev.ottlib.core.update.**$$serializer { *; }
-keepclassmembers class dev.ottlib.core.update.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
