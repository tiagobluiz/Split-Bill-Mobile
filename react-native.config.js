module.exports = {
  dependencies: {
    "@react-native-firebase/analytics": {
      platforms: {
        ios: null,
      },
    },
    "@react-native-firebase/app": {
      platforms: {
        android: {
          packageImportPath:
            "import io.invertase.firebase.app.ReactNativeFirebaseAppPackage;",
        },
        ios: null,
      },
    },
    "@react-native-firebase/crashlytics": {
      platforms: {
        ios: null,
      },
    },
  },
};
