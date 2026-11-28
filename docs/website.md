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

- `events.js` holds the promo moments, in Vienna time (CET, UTC+1 in late November), as fixed instants:
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
- The badges share the neon colour cycle of the feature icons (`fs-neon`). The platform pills stay grey. Each badge also has a light sweep (`fs-shine` on `::after`).
- `stores-glow.js` draws a WebGL aurora behind the footer badges. It runs only while the badges are on screen. It does nothing with reduced motion or when WebGL is missing, so the CSS effects still show.

## Neon halos on the feature icons (icons-glow.js)

- One WebGL canvas covers the features grid. Each frame it draws a small quad around every icon whose card the mouse is over (the halo eases in and out), using the icon's current neon colour (read from the `fs-neon` animation), so the shader only works around the icons.
- The canvas sits above the card backgrounds and below the icon tiles and the card text (`style.css`). The card hover lift uses `top`, not `transform`, so the halo stays visible when a card is hovered.
- It runs at about 30 frames a second, caps the pixel ratio at 1.5, and runs only while the grid is on screen. It is off with reduced motion and without WebGL.

## Event badges and public holidays (events.js)

- `events.js` decides the badge on the home page and on the linktree, one badge at a time. The badge styles are in `promo.css`.
- Priority: a public holiday of the visitor's country on that day (in the country's own time zone) comes first, otherwise the promo event (Black Friday, Cyber Monday) by its instants.
- The country comes from the chosen language and the browser's region for it (`de-CH` gives Switzerland). Without a region, the language's own country is used (`de` gives Austria). Languages without a country (English, Irish, Arabic, ...) show no holidays.
- Holiday rules: `MM-DD` is a fixed date, `E+n` is Western Easter plus n days, `O+n` is Orthodox Easter plus n days. Bulgaria, Greece, Romania, Russia and Ukraine use the Orthodox Easter.
- The table is generated: `node scripts/generate-holidays.mjs` writes the COUNTRIES block of `events.js` and the names in `holidays/en.json` and `holidays/<lang>.json` (keys `CC.id`). Change the generator, not the generated block. Then run `node scripts/check-website-i18n.mjs`.
- The linktree sets the end of Cyber Monday with `data-cyber-until` on its badge (currently Thursday 3 December 2026, 00:01 Vienna time). The home page uses the default end (Tuesday 1 December 2026, 00:01).
- Not included: lunar holidays (Eid, Chinese New Year, Ramadan, ...) and weekday-based bank holidays (for example the first Monday of May). Add them to the generator with a new rule type if needed.
- The holiday names are machine-made in every language except English; they need a native check.
