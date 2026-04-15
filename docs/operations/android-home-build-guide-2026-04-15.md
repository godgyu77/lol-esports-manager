# Android Home Build Guide (2026-04-15)

이 프로젝트는 이제 Windows 개발자 모드 없이도 Android APK를 만들 수 있게 `copy 기반` Rust Android 빌드 경로를 사용합니다.

## 집에서 필요한 것

- Android SDK
  - 기본 경로 예시: `%LOCALAPPDATA%\Android\Sdk`
- Android NDK
  - Android Studio SDK Manager에서 설치
- JDK 17
  - 또는 Android Studio `jbr`
- Rust Android target
  - 최소 `aarch64-linux-android`

## 처음 한 번만 할 것

1. Android SDK / NDK 설치
2. Rust target 설치
   - `rustup target add aarch64-linux-android`
3. Android project init
   - `npx tauri android init`

## 빠른 실행

디버그 APK:

```powershell
npm run android:apk:home
```

릴리즈 APK:

```powershell
npm run android:apk:home:release
```

기본은 `arm64` 기준입니다.

직접 flavor를 바꾸고 싶으면:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/android-home-build.ps1 -Flavor x86_64
```

## 스크립트가 하는 일

- SDK / NDK / JAVA 경로 자동 탐색
- `npm run build` 실행
- `src-tauri/gen/android/gradlew.bat assembleArm64Debug` 또는 release 실행
- 생성된 APK 경로 출력

## 경로 탐색 우선순위

- SDK
  - `ANDROID_SDK_ROOT`
  - `ANDROID_HOME`
  - repo 내부 `.android-sdk`
  - `%LOCALAPPDATA%\Android\Sdk`
- NDK
  - `NDK_HOME`
  - SDK 아래 최신 버전
- JAVA
  - `JAVA_HOME`
  - `C:\Users\user\.jdks\azul-17.0.17`
  - `C:\Program Files\Android\Android Studio\jbr`

## 주의

- `src-tauri/gen/android`가 없으면 먼저 `npx tauri android init`를 실행해야 합니다.
- 집 PC에서 Android Studio를 설치해두면 SDK / NDK / JBR 탐색이 가장 안정적입니다.
