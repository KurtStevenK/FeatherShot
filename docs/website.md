# Website (feathershot.xyz)

The website is the static site in `hosting/public`. It is plain HTML, CSS and JavaScript with no build step. It is deployed to the Firebase project `feathershot` (Firebase Hosting, custom domain feathershot.xyz).

## Pages

- `index.html`: the home page (hero, features, downloads, verification guide).
- `linktree/`: the link page.
- `marketing/`: the press kit.
- `privacy/`, `support/`: legal and help pages.
- `404.html`: Firebase's default text (not translated).

## Languages (44)

- `i18n.js` lists the 44 languages (the same list as niiii.org) and the flag of each one: `FLAG_FOR`, with the flags in `FLAG_SVG` (ported from niiii's `Flag.tsx`).
- `i18n/en.json` is the source of all texts. Each other language has `i18n/<code>.json` with the same keys in the same order.
- In the markup, `data-i18n="key"` replaces an element's text. `data-i18n-alt`, `data-i18n-label`, `data-i18n-title` and `data-i18n-content` replace an attribute. Translations may use `<a>`, `<strong>`, `<em>`, `<code>`, `<span>` and `<br>`; the attributes of the English tags (href, class, id) are kept.
- To add or change a text: edit `en.json`, put the `data-i18n` attribute on the element, translate the key in every language file, then run

  ```
  node scripts/check-website-i18n.mjs
  ```

  It must print `0 errors`. It also checks the placeholders and tags, and that every `data-i18n` key exists.
- The translations are machine-made. They need a native speaker's review, most of all the low-resource languages and the privacy and support pages.

## Store badges

- `badges/app-store/<code>.svg`, `badges/mac-app-store/<code>.svg` and `badges/snap-store/<code>.svg` are the stores' own localized artwork: Apple's marketing toolbox and snapcraft.io. `BADGE_LANGS` in `i18n.js` lists the languages that have a file. A language without a file shows the English badge.
- Do not edit the badge artwork or make a localized badge yourself. Apple's rules keep "App Store" in English.
- The Chrome Web Store badge is the same English image in every language (Google's branding), so it stays English.

## Promo badge (Black Friday / Cyber Monday)

- `promo.js` holds the three moments, in Vienna time (CET, UTC+1 in late November), as fixed instants:
  - Black Friday from Friday 27 November 2026, 00:00;
  - Cyber Monday from Monday 30 November 2026, 00:00;
  - hidden from Tuesday 1 December 2026, 00:01.
- The page checks once a minute. Every visitor sees the change at the same moment, whatever their time zone.
- To change a date, edit the `Date.UTC(...)` constants (remember the UTC offset) and check with `window.FeatherShotPromo.kindFor(Date.parse('...'))` in the browser console.

## Feature icons

- The icons are inline SVG in `index.html`. Their outlines are `.draw` paths with `pathLength="1"`.
- `site.js` starts each card's draw animation once, when the card scrolls into view.
- `style.css` (`fs-neon`) cycles the icon colour through neon tones over 12 seconds; the glow follows the colour.
- With reduced motion, the icons stay still and keep their base colour.

## Release manifest (`releases/latest.json`)

- The release script `packaging/firebase/upload-releases.sh` writes this file at release time. The live site shows the same file, and the download links in the page come from it.
- Before every deploy, check that the repo copy matches the live one: `https://feathershot.xyz/releases/latest.json`. A stale copy would roll the download links back to an older release.

## Deploy

Check the preview first, then go live:

```
firebase hosting:channel:deploy <channel-name> --expires 1d --project feathershot
firebase deploy --only hosting --project feathershot
```

`firebase.json` sets the cache times: one hour for CSS, JavaScript and the translation files, one week for the store badges.

## Open items

- The press kit (`marketing/`) shows a developer note about `hosting/public/marketing/screenshots/`. It should be removed from the public page.
- The 404 page is Firebase's default text.
- Language switching happens in the browser, as on niiii.org. Search engines index the English version only.

## Store badges, platform pills and the footer aurora

- The four store badges are in the footer (`.footer-stores` in `index.html`). They wrap onto two lines on phones.
- The badges and the platform pills share the neon colour cycle of the feature icons (`fs-neon`). Each badge also has a light sweep (`fs-shine` on `::after`).
- `stores-glow.js` draws a WebGL aurora behind the footer badges. It runs only while the badges are on screen. It does nothing with reduced motion or when WebGL is missing, so the CSS effects still show.

## Neon halos on the feature icons (icons-glow.js)

- One WebGL canvas covers the features grid. Each frame it draws a small quad around every icon that is on screen, using the icon's current neon colour (read from the `fs-neon` animation), so the shader only works around the icons.
- The canvas sits above the card backgrounds and below the icon tiles and the card text (`style.css`). The card hover lift uses `top`, not `transform`, so the halo stays visible when a card is hovered.
- It runs at about 30 frames a second, caps the pixel ratio at 1.5, and runs only while the grid is on screen. It is off with reduced motion and without WebGL.
