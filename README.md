# Smith Chart Calculator - Android App (Kotlin & Jetpack Compose)

This directory (`/android`) contains a complete, production-ready **Android application** written in **Kotlin** using **Jetpack Compose** for real-time RF Smith Chart impedance matching and calculations.

## Features
- **Interactive Smith Chart Canvas**: Custom Compose Canvas drawing constant resistance circles, reactance arcs, and interactive load impedance point mapping.
- **Sliding Bar Controls**: Real-time smooth sliders for Load Resistance ($R$), Load Reactance ($X$), Characteristic Impedance ($Z_0$), Operating Frequency ($f$), Series Inductor ($L$), Series Capacitor ($C$), and Transmission Line length ($d$).
- **Live Metrics**: Instantaneous computation of Reflection Coefficient ($\Gamma$), VSWR, and Return Loss ($S_{11}$).
- **Modern Material 3 UI**: Dark theme optimized for engineering and RF calculations.

---

## How to Build the APK

### Prerequisites
- [Android Studio Hedgehog / Iguana or newer](https://developer.android.com/studio)
- JDK 17 or higher
- Android SDK (API level 34)

### Building via Android Studio
1. Open Android Studio.
2. Select **Open** and choose the `/android` folder within this repository.
3. Wait for Gradle sync to complete.
4. Click **Run** (`Shift + F10`) to launch the app on an emulator or connected Android device.

### Building via Command Line (Gradle)
To generate the debug APK directly from your terminal:

```bash
cd android
./gradlew assembleDebug
```

The resulting APK will be available at:
`android/app/build/outputs/apk/debug/app-debug.apk`
