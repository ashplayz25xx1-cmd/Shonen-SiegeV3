SHONEN SIEGE V3.1 — GITHUB PAGES

Deploy workflow: .github/workflows/deploy.yml
Repository pages base: /Shonen-SiegeV3/

Main changes in this build:
- Fixed unit placement to calculate clicks relative to the map element.
- Prevents placing units directly on the road by measuring distance to road segments.
- Speed settings cycle 1x, 1.5x, 2x.
- Core durability reduced to 40, displayed as current/40.
- Clearing a wave awards permanent gems and a small cash bonus (75 + 5 per wave).
- Upgrade prices no longer increase just because the wave number increases.
- Summon one card for 100 gems or five for 450 gems.
- New summon cannot start until all previous cards are revealed.
- Reveal All highlights the best card first; the skip option bypasses that presentation.
- Collection can filter by anime verse and rarity.
- Expanded roster to 45 characters.
- Player-facing Admin page removed. Do not add client-side admin controls for a public multiplayer game.
- Character stat balancing is in the CHARACTERS array in src/main.jsx: cost, baseDamage, range, attackSpeed.
- Artwork can be added by putting image files in public/characters and adding entries to CHARACTER_ART near STARTERS in src/main.jsx, for example: { naruto: '/Shonen-SiegeV3/characters/naruto.webp' }.

This is still a browser-local prototype. LocalStorage saves are tied to the browser/device. Secure accounts, cross-device saves, evolution, and multiplayer need a backend.
