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
# database handles. R8 can otherwise strip or rewrite the internal option class
# enough for the bridge cast to fail in release builds.
-keep class expo.modules.sqlite.** { *; }
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,Signature,InnerClasses,EnclosingMethod

# Add any project specific keep options here:
