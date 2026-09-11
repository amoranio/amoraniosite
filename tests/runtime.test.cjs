const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

// A minimal event/canvas harness exercises lifecycle logic without a browser or dependencies.
function runtime({width = 1000, height = 500, popupThrows = false} = {}) {
    const opened = [];
    let viewport = {left: 0, top: 0, width, height, right: width, bottom: height};
    const elements = [];
    const ids = new Map();
    const timers = new Map();
    let clock = 0, timerId = 0;
    class Element {
        constructor(tag = 'div', attrs = {}) {
            this.tagName = tag.toUpperCase(); this.dataset = {}; this.events = {}; this.attributes = attrs;
            this.textContent = ''; this.hidden = false; this.style = {}; this.disabled = false;
            const classes = new Set((attrs.class || '').split(' '));
            this.classList = {contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c), toggle: (c, force) => {const on = force ?? !classes.has(c); on ? classes.add(c) : classes.delete(c); return on;}};
            for (const [k,v] of Object.entries(attrs)) if (k.startsWith('data-')) this.dataset[k.slice(5)] = v;
            if (attrs.id) ids.set(attrs.id, this);
            elements.push(this);
        }
        addEventListener(type, callback) {(this.events[type] ||= []).push(callback);}
        emit(type, props = {}) {for (const callback of this.events[type] || []) callback({target: this, preventDefault() {}, ...props});}
        click() {this.emit('click');}
        showModal() {this.open = true;}
        close() {this.open = false;}
        focus() {document.activeElement = this;}
        setAttribute(k,v) {this.attributes[k] = v;}
        getAttribute(k) {return this.attributes[k];}
        append() {}
        querySelector(selector) {return selector === 'h2' ? {textContent: 'Game screen'} : ids.get('playBtn');}
        getContext() {return drawing;}
        getBoundingClientRect() {return viewport;}
    }
    const drawing = new Proxy({}, {get: (obj,key) => key in obj ? obj[key] : key.startsWith('create') ? () => ({addColorStop() {}}) : () => {}, set: (obj,key,value) => {obj[key] = value; return true;}});
    for (const match of read('index.html').matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/g)) {
        const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1],m[2]]));
        const element = new Element(match[1], attrs);
        element.hidden = /\bhidden(?:\s|$)/.test(match[2]);
    }
    const document = new Element('document');
    document.body = elements.find(e => e.tagName === 'BODY');
    document.activeElement = document.body;
    document.getElementById = id => {assert.ok(ids.has(id), `Missing HTML control #${id}`); return ids.get(id);};
    document.createElement = tag => new Element(tag);
    document.querySelectorAll = selector => selector.startsWith('.') ? elements.filter(e => e.classList.contains(selector.slice(1))) : elements.filter(e => e.attributes[selector.slice(1, -1)] !== undefined);
    const window = new Element('window');
    window.matchMedia = () => ({matches: false});
    window.open = (...args) => { opened.push(args); if (popupThrows) throw Error('Popup blocked'); return null; };
    const values = new Map();
    const context = vm.createContext({window, document, console, URL, URLSearchParams, location: {search: ''}, localStorage: {getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k)}, Image: class {complete = false;}, MutationObserver: class {observe() {}}, requestAnimationFrame() {}, setTimeout: (callback, delay) => {const id = ++timerId; timers.set(id, {callback, at: clock + delay}); return id;}, clearTimeout: id => timers.delete(id)});
    vm.runInContext(read('js/site.js'), context);
    vm.runInContext(read('js/arcade-core.js'), context);
    window.ArcadeCore = context.ArcadeCore;
    // Test-only observation; no debugging hooks ship to visitors.
    const instrumented = read('js/game.js').replace('    window.Platformer = {', `    window.inspectGame = () => ({lives, gameMode, started, enabled, hasWeapon, x: player.x, y: player.y, skyBot, remainingFrames, coins, menuSuspended, cameraX});
    window.drawGame = draw;
    window.hitLinkBlock = () => { const b = blocks[0]; player.x = b.x + 8; player.y = b.y + b.height + 2; player.vy = -8; player.onGround = false; keys.jump = true; update(); };
    window.stepGame = update;
    window.expireTrace = () => { remainingFrames = 1; };
    window.damageGame = () => { player.invuln = 0; hurtPlayer(0); };
    window.testPit = () => { pits = [{x: 0, w: 1000}]; player.y = 550; update(); };
    window.Platformer = {`);
    vm.runInContext(instrumented, context);
    vm.runInContext(read('js/arcade.js').replace('    drawSnake();\n})();', '    window.inspectMini = () => ({selected, running, paused, headX: snake.snake[0].x, headY: snake.snake[0].y, round: memory.round, sequence: [...memory.sequence]});\n    drawSnake();\n})();'), context);
    const advance = ms => {
        const end = clock + ms;
        let bound = 0;
        while (true) {
            const next = [...timers].sort((a,b) => a[1].at - b[1].at)[0];
            if (!next || next[1].at > end) break;
            assert.ok(++bound < 2000, 'Unbounded timer loop');
            clock = next[1].at; timers.delete(next[0]); next[1].callback();
        }
        clock = end;
    };
    return {window, document, ids, elements, advance, timers, opened, resize: (width, height) => { viewport = {left: 0, top: 0, width, height, right: width, bottom: height}; window.emit('resize'); }, choose: game => elements.find(e => e.dataset.game === game).click()};
}
test('all game controls initialize, and inactive platformer ignores keyboard input', () => {
    const r = runtime();
    r.ids.get('playBtn').click(); r.ids.get('closeOverlay').click();
    assert.equal(r.window.inspectGame().started, true);
    const x = r.window.inspectGame().x;
    r.choose('snake');
    r.document.emit('keydown', {code: 'ArrowRight'});
    r.window.stepGame();
    assert.equal(r.window.inspectGame().x, x);
    assert.equal(r.window.inspectGame().enabled, false);
});
test('training prevents damage and pit life loss; overclock expires at its time limit', () => {
    const r = runtime();
    const mode = r.ids.get('modeSelect');
    mode.value = 'training'; mode.emit('change');
    r.ids.get('closeOverlay').click();
    r.window.damageGame(); r.window.testPit();
    assert.equal(r.window.inspectGame().lives, 3);
    assert.equal(r.window.inspectGame().hasWeapon, true);
    assert.equal(r.window.inspectGame().skyBot, '#12303b');
    mode.value = 'overclock'; mode.emit('change'); r.ids.get('closeOverlay').click();
    r.window.expireTrace(); r.window.stepGame();
    assert.equal(r.ids.get('overTitle').textContent, 'TRACE COMPLETE');
    r.ids.get('continueBtn').click();
    assert.equal(r.window.inspectGame().remainingFrames, 5400);
});
test('switching games cancels memory callbacks and preserves the current sequence', () => {
    const r = runtime(); r.choose('memory');
    assert.ok(r.timers.size > 0);
    r.choose('platformer');
    assert.equal(r.timers.size, 0);
    const status = r.ids.get('miniStatus').textContent;
    r.advance(5000);
    assert.equal(r.ids.get('miniStatus').textContent, status);
    r.choose('memory');
    assert.match(r.ids.get('miniStatus').textContent, /Round 1/);
    assert.ok(r.timers.size > 0);
    r.ids.get('restartGame').click();
    assert.match(r.ids.get('miniStatus').textContent, /Round 1/);
});
test('snake pauses on focus loss and resumes only on request', () => {
    const r = runtime(); r.choose('snake'); r.ids.get('miniStart').click();
    assert.equal(r.timers.size, 1);
    r.window.emit('blur'); assert.equal(r.timers.size, 0);
    r.advance(3000); assert.match(r.ids.get('miniStatus').textContent, /Paused/);
    r.ids.get('pauseGame').click(); assert.equal(r.timers.size, 1);
});
test('the homepage has no theme or corruption controls and old preferences are retired', () => {
    const r = runtime();
    assert.equal(r.ids.has('themeSelect'), false);
    assert.equal(r.ids.has('corruptToggle'), false);
    assert.equal(r.ids.has('restorePage'), false);
    assert.equal(r.window.Platformer.setTheme, undefined);
});
test('Escape pauses and resumes the platformer even when the Resume button has focus', () => {
    const r = runtime();
    r.ids.get('playBtn').click(); r.ids.get('closeOverlay').click();
    r.document.emit('keydown', {code: 'Escape', target: r.ids.get('gameCanvas')});
    assert.equal(r.window.Platformer.isPaused(), true);
    r.ids.get('resumeBtn').focus();
    r.document.emit('keydown', {code: 'Escape', target: r.ids.get('resumeBtn')});
    assert.equal(r.window.Platformer.isPaused(), false);
});

test('Block Runner fills portrait, landscape, and ultrawide viewports without changing physics', () => {
    for (const [width, height] of [[390, 844], [844, 390], [1440, 900], [3440, 1440], [320, 568]]) {
        const r = runtime({width, height});
        const canvas = r.ids.get('gameCanvas');
        assert.equal(r.window.inspectGame().started, true, 'The initial game is playable immediately');
        assert.ok(Math.abs(canvas.width / canvas.height - width / height) < .003);
        assert.ok(canvas.width >= 480 && canvas.height >= 500);
        const state = r.window.inspectGame();
        r.resize(height, width); r.window.drawGame();
        assert.equal(r.window.inspectGame().y, state.y);
        assert.equal(r.window.inspectGame().x, state.x);
        assert.equal(r.window.inspectGame().coins, state.coins);
        assert.equal(r.window.inspectGame().lives, state.lives);
        assert.ok(r.window.inspectGame().cameraX >= 0);
    }
});
test('the portal freezes a runner and returns focus without resetting its run', () => {
    const r = runtime();
    r.document.emit('keydown', {code: 'ArrowRight', target: r.ids.get('gameCanvas')}); r.window.stepGame();
    const x = r.window.inspectGame().x;
    r.ids.get('portalTrigger').click();
    assert.equal(r.ids.get('gamePortal').open, true);
    assert.equal(r.window.inspectGame().menuSuspended, true);
    r.window.stepGame(); assert.equal(r.window.inspectGame().x, x);
    r.ids.get('gamePortal').emit('cancel');
    assert.equal(r.window.inspectGame().menuSuspended, false);
    assert.equal(r.document.activeElement, r.ids.get('gameCanvas'));
    assert.equal(r.window.inspectGame().x, x);
    r.choose('snake'); r.choose('platformer');
    assert.equal(r.window.inspectGame().x, x);
});
test('G toggles the portal, ignores key repeat and typing, and does not reset a mini-game', () => {
    const r = runtime(); r.choose('snake'); r.advance(140);
    r.document.emit('keydown', {code: 'KeyG'});
    assert.equal(r.ids.get('gamePortal').open, true);
    assert.equal(r.timers.size, 0);
    r.document.emit('keydown', {code: 'KeyG', repeat: true});
    assert.equal(r.ids.get('gamePortal').open, true);
    r.document.emit('keydown', {code: 'KeyG'});
    assert.equal(r.ids.get('gamePortal').open, false);
    assert.equal(r.timers.size, 1);
    r.document.emit('keydown', {code: 'KeyG', target: r.ids.get('modeSelect')});
    assert.equal(r.ids.get('gamePortal').open, false);
});
test('closing the portal preserves a deliberate pause and tab focus loss requires resume', () => {
    const r = runtime(); r.choose('snake');
    r.ids.get('pauseGame').click();
    r.ids.get('portalTrigger').click(); r.ids.get('closePortal').click();
    assert.equal(r.timers.size, 0);
    r.ids.get('miniStart').click(); assert.equal(r.timers.size, 1);
    r.ids.get('portalTrigger').click(); r.window.emit('blur'); r.ids.get('closePortal').click();
    assert.equal(r.timers.size, 0);
    r.ids.get('miniStart').click(); assert.equal(r.timers.size, 1);
});
test('a link block opens its URL once, pauses the world, and retains a real anchor if pop-ups fail', () => {
    for (const popupThrows of [false, true]) {
        const r = runtime({popupThrows});
        r.window.hitLinkBlock();
        assert.equal(r.ids.get('linkDialog').open, true);
        assert.equal(r.opened.length, 1);
        assert.equal(r.opened[0][0], 'https://www.linkedin.com/in/ashleymoran');
        assert.equal(r.opened[0][1], '_blank');
        assert.match(r.opened[0][2], /noopener/);
        assert.equal(r.ids.get('discoveredLink').href, r.opened[0][0]);
        assert.equal(r.ids.get('discoveredLink').getAttribute('target'), '_blank');
        assert.equal(r.document.activeElement, r.ids.get('discoveredLink'));
        const state = r.window.inspectGame();
        for (let i = 0; i < 60; i++) r.window.stepGame();
        assert.equal(r.window.inspectGame().x, state.x);
        assert.equal(r.opened.length, 1);
        r.ids.get('resumeLink').click();
        assert.equal(r.ids.get('linkDialog').open, false);
        assert.equal(r.document.activeElement, r.ids.get('gameCanvas'));
        assert.equal(r.window.inspectGame().coins, 1);
    }
});
test('memory difficulty changes inside the portal resume with a playable sequence', () => {
    const r = runtime(); r.choose('memory'); r.ids.get('portalTrigger').click();
    r.ids.get('modeSelect').value = 'training'; r.ids.get('modeSelect').emit('change');
    assert.equal(r.timers.size, 0);
    r.ids.get('closePortal').click();
    assert.match(r.ids.get('miniStatus').textContent, /Round 1/);
    r.advance(1600);
    assert.match(r.ids.get('miniStatus').textContent, /Repeat 1 node/);
});

test('swapping away and back retains a moved snake and a multi-round memory game', () => {
    const r = runtime(); r.choose('snake'); r.advance(600);
    const head = r.window.inspectMini().headX;
    r.ids.get('portalTrigger').click(); r.choose('memory');
    r.advance(1300);
    for (const index of r.window.inspectMini().sequence) r.document.emit('keydown', {code: 'Digit' + (index + 1)});
    r.advance(950);
    assert.equal(r.window.inspectMini().round, 2);
    const sequence = [...r.window.inspectMini().sequence];
    r.ids.get('portalTrigger').click(); r.choose('snake');
    assert.equal(r.window.inspectMini().headX, head);
    r.ids.get('portalTrigger').click(); r.choose('memory');
    assert.equal(r.window.inspectMini().round, 2);
    assert.deepEqual([...r.window.inspectMini().sequence], sequence);
    assert.match(r.ids.get('miniStatus').textContent, /Round 2/);
});

test('the portal Pause and Resume actions match their labels', () => {
    const r = runtime(); r.choose('snake');
    r.ids.get('portalTrigger').click();
    assert.equal(r.ids.get('pauseGame').textContent, 'Pause');
    r.ids.get('pauseGame').click();
    assert.equal(r.window.inspectMini().paused, true);
    assert.equal(r.ids.get('gamePortal').open, false);
    r.ids.get('portalTrigger').click();
    assert.equal(r.ids.get('pauseGame').textContent, 'Resume');
    r.ids.get('pauseGame').click();
    assert.equal(r.window.inspectMini().paused, false);
    assert.equal(r.timers.size, 1);
});
