# Мој Буџет (Moj Budzet)

Personal budget app for Macedonian users (MKD, Macedonian and English).
Expo SDK 57, React Native, Expo Router, Zustand with AsyncStorage, react-i18next.

All data stays on the device. There is no account, server or analytics.

## Develop

```bash
npm install
npx expo start
```

`.npmrc` sets `legacy-peer-deps=true`: `@react-native-community/datetimepicker`
declares an optional `react-native-windows` peer that npm otherwise tries to
resolve against an older React Native.

## Checks

```bash
npx tsc --noEmit
npx eslint .
npm test
npx expo-doctor
```

## Release

See `RELEASE_CHECKLIST.md` for the steps that must be done outside the code
(credentials, store listings, privacy policy URL).
