/*
 * Promo badge in the hero: "Black Friday" until Monday, then "Cyber Monday" until the end.
 *
 * The switch happens at fixed moments (Vienna time, CET = UTC+1 in late November), so every
 * visitor sees the same change at the same time, whatever their own time zone:
 *   Friday 27 Nov 2026, 00:00  -> Black Friday
 *   Monday 30 Nov 2026, 00:00  -> Cyber Monday
 *   Tuesday 1 Dec 2026, 00:01  -> badge hidden
 * The page checks once a minute, so a page that stays open also switches on time.
 */
(function () {
  'use strict';

  const BLACK_FRIDAY_FROM = Date.UTC(2026, 10, 26, 23, 0); // Fri 27 Nov 2026 00:00 in Vienna
  const CYBER_MONDAY_FROM = Date.UTC(2026, 10, 29, 23, 0); // Mon 30 Nov 2026 00:00 in Vienna
  const PROMO_UNTIL = Date.UTC(2026, 10, 30, 23, 1); // Tue 1 Dec 2026 00:01 in Vienna

  const LABELS = { 'black-friday': 'Black Friday', 'cyber-monday': 'Cyber Monday' };

  // Which badge applies at the moment `now` (milliseconds since 1970); null when none does.
  function kindFor(now) {
    if (now < BLACK_FRIDAY_FROM || now >= PROMO_UNTIL) return null;
    return now < CYBER_MONDAY_FROM ? 'black-friday' : 'cyber-monday';
  }

  window.FeatherShotPromo = { kindFor };

  const badge = document.getElementById('promo');
  if (!badge) return;

  function render() {
    const kind = kindFor(Date.now());
    if (!kind) {
      badge.hidden = true;
      return;
    }
    badge.dataset.promo = kind;
    badge.textContent = LABELS[kind];
    badge.hidden = false;
  }

  render();
  setInterval(render, 60 * 1000);
})();
