# Deep Debt

A pixel-art mining roguelite with idle elements. Dig for ore, chain explosions, pay off an ever-growing
debt to The Company, get foreclosed, and come back stronger.

## Development

```bash
npm install
npm run dev      # local dev server with fake test ads
npm test         # game logic + balance simulations
```

## Builds

| Command | Output | Ads |
|---|---|---|
| `npm run build:web` | `dist/web` | Google AdSense H5 Games Ads (GitHub Pages) |
| `npm run build:crazygames` | `dist/crazygames` | CrazyGames SDK, ads off (Basic Launch) |
| `npm run build:crazygames:full` | `dist/crazygames-full` | CrazyGames SDK with rewarded ads (Full Launch) |

Ad settings live in `.env.web` / `.env.crazygames`. All ads are optional rewarded ads; if an ad network is
blocked (ad blocker, school filter) the game simply runs without them.

Pushing to `main` deploys the web build to GitHub Pages (`.github/workflows/deploy.yml`).

## License

Copyright (c) 2026 cucu0628. **All rights reserved.** The source is public for hosting and reference only;
you may not copy, modify, re-host or redistribute the game without permission. See [LICENSE](LICENSE).
