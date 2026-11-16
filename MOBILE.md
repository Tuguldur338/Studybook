# Native mobile apps

Studybook uses Capacitor to package the existing web interface for Android and iOS.

## Build and sync

Install Node.js 22 or newer and the project dependencies, then run:

```sh
npm install
npm run mobile:sync
```

This creates a static web export and copies it into both native projects. The regular `npm run build` remains the web build.

## Run on a device

- **Android:** Install Android Studio, a JDK, and the Android SDK, then run `npm run mobile:android` and launch the app from Android Studio.
- **iOS:** On macOS, install Xcode, then run `npm run mobile:ios` and launch the app from Xcode.

The app identifier in `capacitor.config.ts` is provisional and should be replaced with a permanent identifier before release. Home-screen widgets are not included; they require separate native Android and iOS implementations.
