# Google Play compliance checklist (Albamount)

## Public URLs (paste into Play Console)

- Privacy policy: https://www.albamount.xyz/privacy
- Terms of use: https://www.albamount.xyz/terms
- Publication rules: https://www.albamount.xyz/rules
- Account deletion (in-app): https://www.albamount.xyz/cabinet → Delete account
- App download (sideload APK, optional): https://www.albamount.xyz/app

## Data Safety (declare)

- Account info (email, username)
- Personal info shown on listings (phone/contacts if user posts them)
- Photos / user-generated content
- App activity (votes, ALBA history)
- Device or other IDs (cookies / session / guest id)
- Collected for app functionality; encrypted in transit (HTTPS)
- Account deletion available: Yes
- Data processors: hosting/DB, SMTP email, Cloudinary images

## Build for Play

1. Create upload keystore once (keep backup offline):

```bash
keytool -genkeypair -keystore keystore/albamount-upload.jks -alias albamount -keyalg RSA -keysize 2048 -validity 10000
```

2. Copy `keystore.properties.example` → `keystore.properties` and fill passwords.
3. Build AAB:

```bash
./gradlew :app:bundleRelease
```

Output: `app/build/outputs/bundle/release/app-release.aab`

4. After first upload, put the SHA-256 of the **App signing certificate** (Play Console → App integrity) into:
   `public/.well-known/assetlinks.json` (replace `REPLACE_WITH_UPLOAD_KEY_SHA256`).

## Native extras already in the app (Policy 4.4 / 4.3 helpers)

- Splash while loading
- Offline / error screen with Retry
- Pull-to-refresh
- Deep links to albamount.xyz
- System file picker for images (no broad storage permission)

## Still do in Play Console (manual)

- Developer account verification
- Store listing (title, short/full description, screenshots, feature graphic 1024×500)
- Content rating questionnaire (marketplace + UGC)
- Target audience / news apps declarations if asked
- Upload signed AAB (not the public debug APK)
