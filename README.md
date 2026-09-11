# amoran.io

Ashley Moran's site: three browser games and links to projects and profiles. Plain HTML, CSS, and JavaScript, with no build step or runtime dependencies. GitHub Pages deploys `main` to the existing domain.

## Site

`index.html` opens directly on the arcade. The design uses black surfaces, strong white type, outlined controls, and restrained green accents, taking visual cues from [SpaceX](https://www.spacex.com/). The platformer retains its original pixel characters, colourful blocks and pipes, hills, clouds, terrain, and three worlds, now with a night sky.

There is one fixed visual theme: Neon terminal. There is no persona chooser, professional portfolio, anime artwork, theme selector, or corruption effect. Old `play.html` and `professional.html` bookmarks redirect to the homepage, including without JavaScript. Previously saved persona and theme choices are discarded without changing scores, character selection, or sound preferences.

LinkedIn, X, GitHub, Exnoscan, ClearQR, and badMCP are available from the Links section and the in-game links panel. The original `extensions/support.txt`, `quickGroup/privacy.txt`, custom domain, and Pages deployment are unchanged.

## Games

The difficulty selector changes gameplay, not the site's visual theme.

| Game | Classic | Overclock | Training |
| --- | --- | --- | --- |
| Block Runner | Original three worlds, characters, enemies, pickups, and three lives | 90 seconds per world, faster movement and enemies, starts armed | No damage or life loss; starts armed |
| Packet Snake | Collect packets; avoid walls and your tail | Faster pace and acceleration | Slower pace and wrapping walls; tail collisions still end the run |
| Neural Breach | Repeat a growing sequence of numbered nodes | Shorter demonstration signals | Slower signals; mistakes replay the same sequence |

- Block Runner: WASD/arrows to move, Space/W/Up to jump, F/X/Shift to fire after collecting the pulse star. Keyboard gameplay requires focus on the canvas. Touch controls are included.
- Packet Snake: arrows/WASD or directional touch buttons.
- Neural Breach: click/tap the pads or press 1–9.
- Pause/Resume, Escape, and Restart are available. Games pause when the tab loses focus. A resumed memory game replays its sequence. Changing difficulty starts a fresh run. Switching away from the platformer pauses it; switching mini-games resets them.
- Best scores are stored on this device per mini-game and difficulty when browser storage is available. Discovered links open only on a deliberate click.

## Development

```sh
python3 -m http.server 4173 --bind 127.0.0.1
node --test tests/*.test.cjs
node --check js/game.js
node --check js/arcade.js
node --check js/arcade-core.js
node --check js/site.js
```

Open `http://127.0.0.1:4173/`. No install is required.

`js/game.js` contains the original platformer and its lifecycle/difficulty API. `js/arcade-core.js` contains DOM-independent mini-game rules. `js/arcade.js` handles game selection, input, timers, and scoring. `css/arcade.css` is the single stylesheet.

Tests cover game rules, difficulty behavior, input isolation, timer cleanup, preference migration and storage failures, legacy redirects, link preservation, HTML structure, and asset references. The lifecycle tests use an event/canvas harness, not a visual browser test. GitHub runs these checks on pull requests.
