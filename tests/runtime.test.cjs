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
    vm.runInContext(read('js/profile.js'), context);
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
    vm.runInContext(read('js/arcade.js'), context);
    vm.runInContext(read('js/ide.js'), context);
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
    return {window, document, ids, elements, advance, timers, opened, resize: (width, height) => { viewport = {left: 0, top: 0, width, height, right: width, bottom: height}; window.emit('resize'); }};
}
test('editor tabs swap in place and leave the run where it was', () => {
    const r = runtime();
    r.document.emit('keydown', {code: 'ArrowRight', target: r.ids.get('gameCanvas')});
    r.window.stepGame();
    const x = r.window.inspectGame().x;
    assert.equal(r.ids.get('panel-game').hidden, false);
    r.ids.get('tab-about').click();
    assert.equal(r.ids.get('panel-about').hidden, false);
    assert.equal(r.ids.get('panel-game').hidden, true);
    assert.equal(r.window.inspectGame().enabled, false);
    r.window.stepGame();
    assert.equal(r.window.inspectGame().x, x);
    assert.match(r.ids.get('code-about').innerHTML, /Person/);
    assert.match(r.ids.get('code-about').innerHTML, /EDIT/);
    assert.match(r.ids.get('code-social').innerHTML, /https:\/\/x\.com\/amoranio/);
    assert.match(r.ids.get('code-work').innerHTML, /https:\/\/exnoscan\.com/);
    r.ids.get('close-about').click();
    assert.equal(r.ids.get('tabwrap-about').hidden, true);
    r.ids.get('file-about').click();
    assert.equal(r.ids.get('panel-about').hidden, false);
    r.ids.get('tab-game').click();
    assert.equal(r.window.inspectGame().enabled, true);
    assert.equal(r.window.inspectGame().x, x);
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
test('the file palette opens without leaving the page', () => {
    const r = runtime();
    r.document.emit('keydown', {code: 'KeyP', ctrlKey: true, preventDefault() {}, target: r.document.body});
    assert.equal(r.ids.get('palette').hidden, false);
    assert.equal(r.window.inspectGame().menuSuspended, true);
    r.document.emit('keydown', {code: 'Escape', preventDefault() {}, target: r.ids.get('paletteInput')});
    assert.equal(r.ids.get('palette').hidden, true);
    assert.equal(r.window.inspectGame().menuSuspended, false);
    assert.equal(r.window.Platformer.isPaused(), false);
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
test('Block Runner is the only game, and the editor files are the other pages', () => {
    const html = read('index.html');
    assert.equal(html.includes('snakeCanvas'), false);
    assert.equal(html.includes('id="gamePortal"'), false);
    assert.equal(html.includes('id="gameCanvas"'), true);
    for (const file of ['about.py', 'work.py', 'social.py', 'game.py']) assert.equal(html.includes(file), true);
});
