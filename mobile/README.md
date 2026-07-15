# ScoreCast — iOS app

The native (Expo React Native) ScoreCast client. Talks to the same backend as
the (soon-to-be-retired) web app. See the repo-root planning docs:
`MOBILE_PLAN.md` (decisions/specs), `MOBILE_SLICES.md` (roadmap),
`MOBILE_DESIGN_SPEC.md` (design system).

## Stack

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript strict · Expo Router ·
TanStack Query · better-auth Expo client (SecureStore sessions) · Plus Jakarta
Sans. Light theme; tokens in `src/constants/theme.ts`.

## Layout

- `src/app/` — Expo Router routes: `(auth)` stack, `(tabs)` (Leagues/Account),
  plus dev-only `gallery` (design tokens) and `debug` (backend `/health`).
- `src/components` · `src/constants` · `src/lib` (+ `lib/queries`) · `src/utils`
  · `src/types`.

## Develop

```bash
npm install
# point at your machine's LAN IP so a device/simulator can reach the local API:
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000 npx expo start
```

Push notifications and better-auth's SecureStore need a **dev build** (not Expo
Go): `npx expo run:ios` (or an EAS dev build) on a simulator/device. Without
`EXPO_PUBLIC_API_URL` set, the app targets the deployed API
(`https://api.scorecast.club`).

## Checks

```bash
npm run typecheck        # tsc --noEmit (strict)
npx expo export --platform ios   # verify the whole module graph bundles
npx expo-doctor          # config + dependency sanity
```
