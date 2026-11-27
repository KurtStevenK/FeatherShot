# Linktree page: feathershot.xyz/linktree

One link for Instagram, TikTok and YouTube bios that leads to every store and channel.

- File: `hosting/public/linktree/index.html` (static, no JS, mobile-first, brand colors #0066FF / #00CCCC / #0a0a1a).
- Route: `https://feathershot.xyz/linktree` (`cleanUrls` is on).
- Deploy: `firebase deploy --only hosting --project feathershot`
- Test before deploying: `firebase hosting:channel:deploy linktree --expires 7d`, then open `<channel-url>/linktree` on the phone.
- App Store links carry `ct=linktree`, so App Store Connect → Analytics → Sources shows the clicks.

## Channels on the page (all verified live, 27 Nov 2026)

| Button | URL |
|---|---|
| App Store (iPhone, iPhone Duo, iPad, Watch) | https://apps.apple.com/app/feathershot/id6821684358 |
| Mac App Store | https://apps.apple.com/app/feathershot/id6821684358?platform=mac |
| Chrome Web Store | https://chromewebstore.google.com/detail/feathershot/agchndmchfimblcabbenpaicoopfdmlc |
| Snap Store (Linux) | https://snapcraft.io/feathershot |
| Windows | https://feathershot.xyz/#download |
| Instagram | https://www.instagram.com/feathershot.app/ |
| TikTok | https://www.tiktok.com/@feathershot.app |
| Pinterest | https://www.pinterest.com/FeatherShotApp/ |
| Facebook | https://www.facebook.com/profile.php?id=61597010128777 |
| YouTube | https://www.youtube.com/@FeatherShotApp |
| GitHub | https://github.com/KurtStevenK/FeatherShot |
| Website, Support, Privacy, Press kit | feathershot.xyz |

## Not created yet (add a button once live)

Product Hunt, Reddit, Edge Add-ons, Firefox Add-ons, Opera add-ons, Android store.

To add a channel: copy one `<a class="btn">…</a>` block in the right section (Download / Follow / More), change `href`, title, subtitle and the 24×24 SVG icon. Keep at most ~10 buttons.
