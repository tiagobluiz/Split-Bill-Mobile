# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Expo SQLite reflects Kotlin Record option classes when constructing native
# database handles. R8 can otherwise strip the metadata/annotations used by
# expo-modules-core to map ReadableMap values into OpenDatabaseOptions.
-keep class expo.modules.sqlite.** { *; }
-keep class expo.modules.kotlin.records.** { *; }
-keep class * implements expo.modules.kotlin.records.Record { *; }
-keep class kotlin.Metadata { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Add any project specific keep options here:
