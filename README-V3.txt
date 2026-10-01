SHONEN SIEGE V3
================

This is a standalone Vite/React prototype designed for GitHub Pages.

Main upgrades:
- 5-card squad limit
- 8 field placements max
- rarity-based duplicate limits
- rarity-based upgrade caps
- separate permanent Gems and run-only Cash
- 5-card packs with duplicate tracking and pity
- duplicate card selling for Gems
- full collection with search/filter
- character image uploads saved in the browser
- bigger winding map with real enemy pathing
- ground enemies only
- boss every 4 waves with rotating boss types
- boss warning before the wave starts
- wave clear rewards paid immediately in Gems
- Gems stay with the player after losing or quitting
- continue from best cleared wave + 1
- restart from wave 1
- auto next wave
- faster game speed options
- quit run
- unit level display and rarity upgrade limits
- local prototype Admin controls

Deployment:
1. Replace the files in your GitHub repository with the files in this folder.
2. Commit to main.
3. The included .github/workflows/deploy.yml builds and deploys automatically.
4. Your GitHub Pages URL remains:
   https://ashplay25xx1-cmd.github.io/Shonen_Siege/

Notes:
- Admin controls are local-only in this prototype.
- Character artwork is stored in browser localStorage for development.
- Real accounts, cloud saves, multiplayer, secure admin tools and server-side validation should be added before public competitive play.
