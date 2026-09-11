const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

// A minimal event/canvas harness exercises lifecycle logic without a browser or dependencies.
function runtime() {
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
        focus() {document.activeElement = this;}
        setAttribute(k,v) {this.attributes[k] = v;}
        getAttribute(k) {return this.attributes[k];}
        append() {}
        querySelector(selector) {return selector === 'h2' ? {textContent: 'Game screen'} : ids.get('playBtn');}
        getContext() {return drawing;}
        getBoundingClientRect() {return {left: 0, top: 0, width: 1000, height: 500};}
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
    const values = new Map();
    const context = vm.createContext({window, document, console, URLSearchParams, location: {search: ''}, localStorage: {getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k)}, Image: class {complete = false;}, MutationObserver: class {observe() {}}, requestAnimationFrame() {}, setTimeout: (callback, delay) => {const id = ++timerId; timers.set(id, {callback, at: clock + delay}); return id;}, clearTimeout: id => timers.delete(id)});
    vm.runInContext(read('js/site.js'), context);
    vm.runInContext(read('js/arcade-core.js'), context);
    window.ArcadeCore = context.ArcadeCore;
    // Test-only observation; no debugging hooks ship to visitors.
    const instrumented = read('js/game.js').replace('    window.Platformer = {', `    window.inspectGame = () => ({lives, gameMode, started, enabled, hasWeapon, x: player.x, skyBot, remainingFrames});
    window.stepGame = update;
    window.expireTrace = () => { remainingFrames = 1; };
    window.damageGame = () => { player.invuln = 0; hurtPlayer(0); };
    window.testPit = () => { pits = [{x: 0, w: 1000}]; player.y = 550; update(); };
    window.Platformer = {`);
    vm.runInContext(instrumented, context);
    vm.runInContext(read('js/arcade.js'), context);
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
    return {window, document, ids, elements, advance, timers, choose: game => elements.find(e => e.dataset.game === game).click()};
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
test('switching away cancels a memory demonstration and restarting resets it', () => {
    const r = runtime(); r.choose('memory'); r.ids.get('miniStart').click();
    assert.ok(r.timers.size > 0);
    r.choose('snake');
    assert.equal(r.timers.size, 0);
    const status = r.ids.get('miniStatus').textContent;
    r.advance(5000);
    assert.equal(r.ids.get('miniStatus').textContent, status);
    r.choose('memory'); r.ids.get('miniStart').click(); r.ids.get('restartGame').click();
    assert.equal(r.timers.size, 0);
    assert.equal(r.ids.get('miniStart').hidden, false);
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
