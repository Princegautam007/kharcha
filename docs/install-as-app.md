# Install Kharcha as an app

You can put Kharcha on your home screen and use it like a normal app. It also
opens without internet after the first visit.

## Where the app comes from

Kharcha is published with **GitHub Pages**. The workflow file
`.github/workflows/deploy.yml` runs automatically on every push to the `main`
branch and republishes the site at
https://princegautam007.github.io/kharcha — there is no manual release step.

What that means for you:

- Updates appear on their own. After a new version is pushed to `main`, the
  link above serves the new version within a minute or two.
- The installed app picks the update up on the next visit **with internet**
  (see "Good to know" below). You never need to reinstall.
- If you host your own fork, enable Pages in the repository settings
  (Settings → Pages → Source: GitHub Actions) and the same workflow publishes
  your copy.

## On Android (Chrome)

1. Open https://princegautam007.github.io/kharcha
2. Tap the three dots at the top right.
3. Tap "Install app" or "Add to Home screen".
4. Tap Install.

## On iPhone (Safari)

1. Open the link above in Safari.
2. Tap the Share button.
3. Tap "Add to Home Screen".

## On a computer (Chrome or Edge)

1. Open the link above.
2. Click the install icon at the right end of the address bar.
3. Click Install.

## Good to know

- The installed web app cannot read SMS. Automatic SMS reading only works in the
  Kharcha Android app. In the web app you can add expenses by hand.
- Your data stays in your browser on that device. If you clear site data, your
  expenses are removed, so use the backup button first.
- The first visit needs internet. After that the app opens offline.
- When a new version is published, open the app once with internet to get it.
  It may take one more restart to show the new version.
