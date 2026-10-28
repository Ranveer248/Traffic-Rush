# Capital Street: the app

The game in `../capital-street` wrapped with [Capacitor](https://capacitorjs.com) for Android and iPhone. The app carries every file inside it (the game, three.js, fonts and all five cities' map data, about 17 MB), so it works offline.

- **App name:** Capital Street
- **App ID:** `com.ranveer248.capitalstreet`. Change it in `capacitor.config.json`, `android/app/build.gradle` and the Xcode project **before** the first store upload; after that it can never change.
- **Portrait only.** Status bar hidden. Android's back button closes the open panel.

## Getting a build

GitHub builds the app for you on every push that changes the game or the app (workflow: `.github/workflows/capital-street-app.yml`).

1. On GitHub, open the repo → **Actions** → **Capital Street app** → the latest run.
2. Under **Artifacts**, download **capital-street-android-apk**. Unzip it and open `app-debug.apk` on an Android phone to install it (allow "install unknown apps" when asked).
3. The **ios** job builds the iPhone app for the simulator. That proves the Xcode project compiles. Putting it on a real iPhone needs an Apple developer account (below).

On your own computer:

```sh
cd capital-street-app
npm ci
npm run android   # copies the game in, syncs, opens Android Studio (press Run)
npm run ios       # Mac only: opens Xcode (pick your team under Signing, press Run)
npm run assets    # after changing assets/*.png: regenerates every icon and splash size
```

`www/` is a copy made by `npm run copy`. Edit the game in `../capital-street`, never in `www/`.

## Google Play

1. Make a Google Play developer account ($25 once) at https://play.google.com/console.
2. Make an upload key, once, and keep it safe (if you lose it, Google can reset it, but it takes days):
   ```sh
   keytool -genkey -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   base64 -w0 upload.jks   # on a Mac: base64 -i upload.jks
   ```
3. On GitHub, open the repo → Settings → Secrets and variables → Actions, and add:
   `ANDROID_KEYSTORE_BASE64` (the base64 text), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`upload`), `ANDROID_KEY_PASSWORD`.
4. Re-run the workflow. A new artifact, **capital-street-play-bundle**, holds `app-release.aab`.
5. In the Play Console, create the app, fill in the store listing (text below), the privacy policy link, the content rating questionnaire and the data safety form ("no data collected"). Then upload the `.aab` to **Internal testing** first, then Production.

## Apple App Store

1. Join the Apple Developer Program ($99 a year) at https://developer.apple.com/programs/.
2. In App Store Connect, create the app with bundle ID `com.ranveer248.capitalstreet`.
3. App Store Connect → Users and Access → Integrations → **App Store Connect API** → make a key with the **App Manager** role. Download the `.p8` file (you can only download it once).
4. Add these GitHub secrets: `APPLE_TEAM_ID` (Membership page), `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, and `APPSTORE_KEY_P8` (the whole text of the `.p8` file).
5. Re-run the workflow. The **ios** job archives, signs and uploads the build to App Store Connect. It shows up in **TestFlight** after Apple processes it (10 to 30 minutes), so you can install it on your iPhone with the TestFlight app.
6. Fill in the listing and screenshots, then submit for review.

The signed Android bundle and the App Store upload are wired up but have only run once the secrets exist. If one fails, the log in the Actions run says why.

## Store listing

- **Name:** Capital Street
- **Subtitle / short description:** Trade your way from rent day to Wall Street.
- **Category:** Games → Simulation
- **Description:**

  > Rent is due. You're alone in a tiny New York apartment with a stack of bills and an envelope of cash you just found. Trade it into a fortune.
  >
  > Capital Street is a paper-trading game on a living, real-scale 3D map of Manhattan. Buy and sell shares in fictional companies on the Share Exchange while the market reacts to whatever the city throws at it: crashes, rallies, blackouts, hurricanes, hacks and worse.
  >
  > • Pay your rent, or get evicted
  > • Take bank loans, and build your credit score
  > • Buy real buildings floor by floor and collect rent
  > • Lift the roof off your Wall Street office, furnish it, and hire interns, employees and brokers
  > • Open branches in London, Tokyo, Hong Kong and Dubai
  >
  > Every company and price is fictional. No real money, no ads, no tracking, and it plays offline.

- **Keywords (Apple):** stocks,trading,tycoon,wall street,business,simulator,market,money,new york,city
- **Privacy policy URL:** the game's `privacy.html` once the site is online, for example `https://ranveer248.github.io/<repo-name>/capital-street/privacy.html`.
- **Content rating notes:** fictional stock trading with no real money and no gambling. One of the random market events is a plane crashing into a Midtown tower (shown as smoke and a news headline). Reviewers may ask about it.
- **Screenshots:** phones need 6.7" iPhone (1290 × 2796) and Android phone shots. Take them from the game in a browser's phone view, or from the simulator.
