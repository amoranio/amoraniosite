# amoran.io

Ashley Moran's site, presented as a dark editor workspace. Plain HTML, CSS, and JavaScript, with no build step or runtime dependencies. GitHub Pages deploys `main` to the existing domain.

## Site

`index.html` opens a workspace that behaves like an IDE. The files are tabs in one page: `about.py`, `work.py`, `social.py`, and `game.py`. Choosing a tab, a file in the explorer, or a result in the Go to File palette swaps the open buffer. Nothing in that switch reloads the page. The address hash updates so a file can be shared, and the browser's back button returns to the previous file.

`game.py` is Block Runner, the game that used to fill the homepage. It keeps its worlds, characters, coins, link blocks, touch controls, and difficulty settings. Packet Snake and Neural Breach are no longer part of the site. Difficulty, pause, restart, character, and sound sit in the editor toolbar while that tab is open. Leaving the tab freezes the run and coming back continues it.

The other files are Python, drawn with editor colours: keywords, functions, classes, strings, and comments each have their own colour. The text face is Aptos when it is installed, with Source Sans 3 and Segoe UI as fallbacks. Edit the words in `js/profile.js`. Lines marked `EDIT` in the buffers, and the comments in that file, are the slots for a summary, current work, interests, project notes, and profiles. Add an object to `projects` or `social` and refresh.

Old `play.html` and `professional.html` bookmarks redirect to the homepage, including without JavaScript. Previously saved persona and theme choices are discarded without changing scores, character selection, or sound preferences.

`Ctrl`+`P` (or `⌘`+`P`) opens Go to File. `Ctrl`+`1` through `Ctrl`+`4` jump to a file. `Ctrl`+`Tab` cycles the open tabs. On a narrow screen the explorer starts closed; the activity bar brings it back.

LinkedIn, X, GitHub, Exnoscan, ClearQR, and badMCP are in the Python files and in Block Runner's links panel. The original `extensions/support.txt`, `quickGroup/privacy.txt`, custom domain, and Pages deployment are unchanged.

## Block Runner

The difficulty selector changes gameplay, not the workspace theme.

| Mode | Behaviour |
| --- | --- |
| Classic | Original three worlds, characters, enemies, pickups, and three lives |
| Overclock | 90 seconds per world, faster movement and enemies, starts armed |
| Training | No damage or life loss; starts armed |

WASD or the arrow keys move, Space, W, or Up jumps, and F, X, or Shift fires after the pulse star is collected. Keyboard play needs the canvas focused. Touch controls are included. Escape pauses. The run also pauses when the browser tab loses focus. Best scores stay on this device when storage is available. Hitting a link block pauses the runner and attempts to open its URL in a new tab. A dialog with a normal `target="_blank"` anchor remains if a popup blocker stops that attempt.

## Development

```sh
python3 -m http.server 4173 --bind 127.0.0.1
node --test tests/*.test.cjs
node --check js/game.js
node --check js/arcade.js
node --check js/ide.js
node --check js/profile.js
node --check js/site.js
```

Open `http://127.0.0.1:4173/`. No install is required.

`js/profile.js` is the editable copy for the Python tabs. `js/ide.js` draws those buffers and switches files. `js/game.js` is Block Runner. `js/arcade.js` connects the editor toolbar to the game. `css/ide.css` is the workspace. `css/arcade.css` is the game.

Tests cover the platformer, editor tabs, the file palette, viewport sizing, link-block collisions, preference migration, legacy redirects, and asset references. GitHub runs these checks on pull requests.
