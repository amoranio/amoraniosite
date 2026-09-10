# amoran.io

Ashley Moran's portfolio and cyber arcade. A plain HTML/CSS/JavaScript site, with no runtime dependencies or build step. GitHub Pages deploys `main` to the existing domain.

## The two personas

- `index.html`: first-visit persona chooser. Visitors can remember a choice on this device. `index.html?choose` always opens the chooser; both personas include a switch link. Direct links to either persona also work.
- `professional.html`: dark professional portfolio. Replace the marked biography, roles, dates, achievements, certifications, and project descriptions with your own details. The Security Architect title is based on the public [LinkedIn profile](https://www.linkedin.com/in/ashleymoran/); employers, dates, and credentials have intentionally not been inferred.
- `play.html`: cyber arcade, with all six existing profile/project links available without playing.

## Arcade

| Game | Classic | Overclock | Training |
| --- | --- | --- | --- |
| Block Runner | Original three worlds, characters, enemies, pickups, and three lives | 90 seconds per world, faster movement and enemies, pulse weapon at start | No damage or life loss; starts with the pulse weapon |
| Packet Snake | Collect packets, avoid walls and your tail | Faster initial pace and acceleration | Slower pace and wrapping walls; tail collisions still end the run |
| Neural Breach | Repeat a growing sequence of numbered nodes | Shorter demonstration signals | Slower signals, mistakes replay the same sequence |

Themes: Neon terminal, Anime dusk, and Original world. Original world restores the platformer's original palette and scenery. Theme and per-game/per-mode best scores are saved locally, when browser storage is available.

Corrupt is an opt-in visual simulation: page-level terminal fragments, escaped packets, and colour offsets. It never sends commands or reads visitor data. Escape, Restore page, restarting, switching games, hiding the tab, or leaving the page clears it. It is never remembered. Decorative motion respects `prefers-reduced-motion` and avoids rapid flashing. Normal games still need animation to function.

The platformer keeps its existing WASD/arrow/Space/fire/touch controls. Focus its canvas to use gameplay keys. Links discovered in blocks require a deliberate click; the Uplinks section and Sites panel always offer regular accessible links. Snake supports keyboard and directional touch buttons. Neural Breach supports clicks, taps, and keys 1–9. Pause/Resume and Restart are available above every game. Changing a mode starts a fresh run; switching away from the platformer pauses it, while switching mini-games resets them. Games pause when the tab loses focus. A resumed memory game replays its current sequence.

## Development and validation

From this directory:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
node --test tests/*.test.cjs
node --check js/game.js
node --check js/arcade.js
node --check js/arcade-core.js
node --check js/site.js
```

Open `http://127.0.0.1:4173/`. No install is required. Tests cover game rules, the game lifecycle using an event/canvas harness, persona routing and storage failure, preservation of existing links, and local asset references. These are automated logic/static checks, not a visual browser test.

`js/arcade-core.js` contains testable, DOM-independent mini-game rules; `js/arcade.js` manages the arcade UI and timers. `js/game.js` retains the original platformer with a small lifecycle/theme/mode API. `css/site.css` styles the chooser and portfolio; `css/arcade.css` extends the original game styles.

## Existing links

LinkedIn, X, GitHub, Exnoscan, ClearQR, and badMCP are retained in both personas. Existing `extensions/support.txt`, `quickGroup/privacy.txt`, `CNAME`, and Pages deployment remain intact.

## Artwork

`assets/cyber-rooftop.jpg` is original artwork generated with the built-in image generation tool, then encoded as JPEG for the web. It is used on the chooser, arcade sidebar, and cyber platformer backdrop. No existing anime character is depicted.

Prompt: One original cyberpunk anime illustration for Ashley Moran's Play persona on amoran.io. A single androgynous adult anime hacker in a dark technical jacket, three-quarter profile, on a rooftop overlooking a dense nocturnal futuristic city. Cinematic late-1990s anime cel-and-painted-background aesthetic, expressive linework, restrained hand-painted texture, detailed but calm. Landscape 1536×1024, character on the right, darker negative space on the left, room for portrait crops. Atmospheric rain, nearly-black navy shadows, restrained acid-green and cyan light, subtle violet highlights and distant wet reflections. No existing anime characters, typography, readable signs, logos, or watermark.
