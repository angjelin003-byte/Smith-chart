# Smith Chart Calculator - Android App (Kotlin & Jetpack Compose)

This repository contains a 100% pure **Android application** written in **Kotlin** using **Jetpack Compose** for real-time RF Smith Chart impedance matching and calculations.

## Features
- **Interactive Smith Chart Canvas**: Custom Compose Canvas drawing constant resistance circles, reactance arcs, and interactive load impedance point mapping.
- **Sliding Bar Controls**: Real-time smooth sliders for Load Resistance ($R$), Load Reactance ($X$), Characteristic Impedance ($Z_0$), Operating Frequency ($f$), Series Inductor ($L$), Series Capacitor ($C$), and Transmission Line length ($d$).
- **Live Metrics**: Instantaneous computation of Reflection Coefficient ($\Gamma$), VSWR, and Return Loss ($S_{11}$).
- **Modern Material 3 UI**: Dark theme optimized for engineering and RF calculations.

---

## How to Build the APK (Cloud & Mobile Web Friendly)

Since this repository is fully configured for automated GitHub Actions builds, you can generate your APK directly from your mobile browser without installing a terminal or local SDK:

1. Push this repository to GitHub.
2. Go to the **Actions** tab in your GitHub repository.
3. Select the **Build Android APK** workflow and click **Run workflow**.
4. Once the build completes successfully, download the `app-debug-apk` artifact directly to your phone and install the APK!

### Local Development (Android Studio)
1. Open Android Studio.
2. Select **Open** and choose this repository root folder.
3. Wait for Gradle sync to complete.
4. Click **Run** (`Shift + F10`) to launch the app.
