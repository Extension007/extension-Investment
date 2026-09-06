# Albamount Android

Site + app share one service: https://www.albamount.xyz

## Play readiness

See [PLAY_COMPLIANCE.md](./PLAY_COMPLIANCE.md) for Privacy/Terms URLs, Data Safety, and AAB signing steps.

## Run locally

1. Android Studio → Open → `apps/android`
2. Sync Gradle
3. Run on device/emulator (loads production site)

## Release signing

1. `keystore.properties.example` → `keystore.properties`
2. Create `keystore/albamount-upload.jks`
3. `./gradlew :app:bundleRelease`
