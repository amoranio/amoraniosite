/* amoran.io — "LINK RUNNER"
 * A small platformer whose collectibles are links to my things.
 *
 * Rendering runs in a fixed 960x540 logical space. The canvas backing store is
 * an integer multiple of that, chosen from the element's device-pixel size, so
 * the pixel art is never downscaled and never blurred.
 */
(function (global) {
    'use strict';

    const AMO = (global.AMO = global.AMO || {});
    const SPR = AMO.sprites;
    const DATA = AMO.levels;
    const LINKS = DATA.LINKS;
    const THEMES = DATA.THEMES;
    const GROUND_TOP = DATA.GROUND_TOP;

    /* =============================== constants =============================== */

    /* The world is 540 logical pixels tall, always. The logical width flexes
     * between 4:3 and 16:9 so a portrait phone gets a taller play area instead
     * of a letterbox slot. */
    const VIEW_H = 540;
    // Portrait phones are width-bound, so allowing a narrower logical view lets
    // the stage grow taller instead of leaving most of the screen empty.
    const VIEW_W_MIN = 600;
    const VIEW_W_MAX = 960;
    let VIEW_W = VIEW_W_MAX;
    const STEP_MS = 1000 / 60;

    const GRAVITY = 0.72;
    const MAX_FALL = 15;
    const JUMP_V = -15.2;
    const JUMP_CUT_V = -10.5;   // a tap still gets you a useful hop
    const RUN_ACCEL = 0.85;
    const AIR_ACCEL = 0.55;
    const MAX_RUN = 4.7;
    const FRICTION = 0.78;
    const COYOTE = 7;
    const JUMP_BUFFER = 8;

    const PLAYER_W = 20;
    const PLAYER_H = 44;
    const MAX_HEARTS = 5;

    const WEAPONS = {
        blaster: {
            id: 'blaster', name: 'BLASTER', short: 'BLS', ammo: Infinity, cooldown: 12,
            speed: 9.5, damage: 1, shots: 1, spread: 0, pierce: false,
            w: 12, h: 4, colour: '#ffe066', glow: '#ff9f1c'
        },
        spread: {
            id: 'spread', name: 'SPREAD', short: 'SPR', ammo: 36, cooldown: 26,
            speed: 8.2, damage: 1, shots: 3, spread: 0.2, pierce: false,
            w: 9, h: 5, colour: '#7dd3fc', glow: '#22d3ee'
        },
        pulse: {
            id: 'pulse', name: 'PULSE', short: 'PLS', ammo: 20, cooldown: 30,
            speed: 13.5, damage: 3, shots: 1, spread: 0, pierce: true,
            w: 26, h: 6, colour: '#f5d0fe', glow: '#e879f9'
        }
    };

    const ENEMY_DEFS = {
        bug: {
            w: 26, h: 22, hp: 1, speed: 0.85, stompable: true, score: 100,
            palette: 'bug', frames: ['bugA', 'bugB'], sw: 28, sh: 24, animRate: 9
        },
        hopper: {
            w: 26, h: 26, hp: 2, speed: 1.15, stompable: true, score: 150,
            palette: 'hopper', frames: ['hopA', 'hopB'], sw: 28, sh: 28
        },
        drone: {
            w: 34, h: 24, hp: 2, speed: 0.95, stompable: true, score: 200,
            palette: 'drone', frames: ['droneA', 'droneB'], sw: 40, sh: 28,
            flying: true, shoots: true, fireRate: 115, animRate: 4
        },
        sentry: {
            w: 32, h: 44, hp: 4, speed: 0, stompable: false, score: 300,
            palette: 'sentry', frames: ['sentry'], sw: 40, sh: 48,
            shoots: true, fireRate: 82
        }
    };

    const BOSS_HP = 20;

    /* ================================= canvas ================================ */

    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const stage = document.getElementById('stage');
    const stageWrap = document.getElementById('stageWrap');

    let pixelScale = 1;

    function resizeCanvas() {
        const availW = Math.max(240, (stageWrap && stageWrap.clientWidth) || VIEW_W);
        const vh = global.innerHeight || 800;
        const capFraction = vh < 560 ? 0.86 : 0.72;
        const availH = Math.max(180, Math.min(660, vh * capFraction));

        const aspect = Math.max(VIEW_W_MIN / VIEW_H, Math.min(VIEW_W_MAX / VIEW_H, availW / availH));
        const nextViewW = Math.round((VIEW_H * aspect) / 2) * 2;

        const displayH = Math.round(Math.min(availH, (availW * VIEW_H) / nextViewW));
        const displayW = Math.round((displayH * nextViewW) / VIEW_H);

        if (stage) {
            stage.style.width = displayW + 'px';
            stage.style.height = displayH + 'px';
        }

        const dpr = global.devicePixelRatio || 1;
        const devicePx = displayW * dpr;
        const factor = Math.max(1, Math.min(4, Math.floor(devicePx / nextViewW)));

        VIEW_W = nextViewW;
        if (canvas.width !== VIEW_W * factor || canvas.height !== VIEW_H * factor) {
            canvas.width = VIEW_W * factor;
            canvas.height = VIEW_H * factor;
        }
        pixelScale = factor;
        // Below one full logical pixel per device pixel, nearest-neighbour would
        // drop detail, so hand scaling back to the browser's smooth filter.
        canvas.classList.toggle('is-smooth', devicePx < VIEW_W * 0.98);
    }

    /* ================================= audio ================================= */

    const audio = (function () {
        let actx = null;
        let master = null;
        let enabled = readStore('sound', '1') === '1';

        function ensure() {
            if (actx) return actx;
            const Ctor = global.AudioContext || global.webkitAudioContext;
            if (!Ctor) return null;
            actx = new Ctor();
            master = actx.createGain();
            master.gain.value = 0.16;
            master.connect(actx.destination);
            return actx;
        }

        function blip(freq, dur, type, vol, slideTo) {
            if (!enabled) return;
            const a = ensure();
            if (!a) return;
            if (a.state === 'suspended') a.resume();
            const osc = a.createOscillator();
            const gain = a.createGain();
            osc.type = type || 'square';
            osc.frequency.setValueAtTime(freq, a.currentTime);
            if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), a.currentTime + dur);
            gain.gain.setValueAtTime(0.0001, a.currentTime);
            gain.gain.exponentialRampToValueAtTime(vol || 0.5, a.currentTime + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
            osc.connect(gain);
            gain.connect(master);
            osc.start();
            osc.stop(a.currentTime + dur + 0.02);
        }

        function noise(dur, vol) {
            if (!enabled) return;
            const a = ensure();
            if (!a) return;
            if (a.state === 'suspended') a.resume();
            const len = Math.floor(a.sampleRate * dur);
            const buf = a.createBuffer(1, len, a.sampleRate);
            const chan = buf.getChannelData(0);
            for (let i = 0; i < len; i++) chan[i] = (Math.random() * 2 - 1) * (1 - i / len);
            const src = a.createBufferSource();
            src.buffer = buf;
            const gain = a.createGain();
            gain.gain.value = vol || 0.4;
            src.connect(gain);
            gain.connect(master);
            src.start();
        }

        return {
            get enabled() { return enabled; },
            set enabled(v) { enabled = !!v; writeStore('sound', v ? '1' : '0'); if (v) ensure(); },
            unlock() { const a = ensure(); if (a && a.state === 'suspended') a.resume(); },
            jump() { blip(430, 0.12, 'square', 0.4, 720); },
            shoot() { blip(760, 0.07, 'square', 0.3, 300); },
            hit() { blip(200, 0.09, 'sawtooth', 0.35, 90); },
            stomp() { blip(320, 0.1, 'triangle', 0.45, 120); noise(0.08, 0.2); },
            coin() { blip(1180, 0.06, 'square', 0.3); blip(1560, 0.09, 'square', 0.22); },
            unlockSfx() { blip(660, 0.1, 'triangle', 0.4); setTimeout(() => blip(990, 0.14, 'triangle', 0.4), 90); setTimeout(() => blip(1320, 0.18, 'triangle', 0.35), 190); },
            hurt() { blip(280, 0.22, 'sawtooth', 0.45, 70); noise(0.12, 0.25); },
            power() { blip(520, 0.1, 'square', 0.35); setTimeout(() => blip(780, 0.12, 'square', 0.35), 80); },
            clear() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'triangle', 0.4), i * 110)); },
            boom() { noise(0.5, 0.5); blip(120, 0.4, 'sawtooth', 0.4, 40); },
            fail() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.24, 'square', 0.4), i * 130)); }
        };
    })();

    /* ============================== persistence ============================== */

    function readStore(key, fallback) {
        try {
            const v = global.localStorage.getItem('amoran.' + key);
            return v === null ? fallback : v;
        } catch (e) { return fallback; }
    }

    function writeStore(key, value) {
        try { global.localStorage.setItem('amoran.' + key, value); } catch (e) { /* private mode */ }
    }

    /* ================================= input ================================= */

    const input = {
        left: false, right: false, up: false, down: false,
        jump: false, jumpPressed: false, fire: false, firePressed: false
    };

    const KEY_MAP = {
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right',
        ArrowDown: 'down', KeyS: 'down',
        ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
        KeyJ: 'fire', KeyF: 'fire', ShiftLeft: 'fire'
    };

    const PREVENT = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];

    function setKey(code, down) {
        const slot = KEY_MAP[code];
        if (!slot) return false;
        if (down && !input[slot]) {
            if (slot === 'jump') input.jumpPressed = true;
            if (slot === 'fire') input.firePressed = true;
        }
        input[slot] = down;
        return true;
    }

    global.addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        audio.unlock();

        if (e.code === 'KeyE' || e.code === 'Enter') {
            if (ui.openPending()) { e.preventDefault(); return; }
        }
        if (e.code === 'KeyP' || e.code === 'Escape') {
            if (game.state === 'playing') { game.pause(); e.preventDefault(); return; }
            if (game.state === 'paused') { game.resume(); e.preventDefault(); return; }
        }
        if (e.code === 'KeyR' && game.state === 'playing') { game.restartLevel(); e.preventDefault(); return; }
        if (e.code === 'KeyQ' && game.state === 'playing') { cycleWeapon(); e.preventDefault(); return; }
        if (e.code === 'KeyM') { toggleSound(); e.preventDefault(); return; }

        const captured = setKey(e.code, true);
        if (captured && game.inView && game.state === 'playing' && PREVENT.indexOf(e.code) >= 0) e.preventDefault();
    });

    global.addEventListener('keyup', (e) => { setKey(e.code, false); });
    global.addEventListener('blur', () => {
        Object.keys(input).forEach((k) => { input[k] = false; });
    });

    function bindHold(el, slot) {
        if (!el) return;
        const on = (e) => {
            e.preventDefault();
            audio.unlock();
            if (!input[slot]) {
                if (slot === 'jump') input.jumpPressed = true;
                if (slot === 'fire') input.firePressed = true;
            }
            input[slot] = true;
            el.classList.add('is-down');
        };
        const off = (e) => {
            if (e) e.preventDefault();
            input[slot] = false;
            el.classList.remove('is-down');
        };
        el.addEventListener('pointerdown', on);
        el.addEventListener('pointerup', off);
        el.addEventListener('pointercancel', off);
        el.addEventListener('pointerleave', off);
        el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /* ================================== state ================================ */

    const player = {
        x: 80, y: GROUND_TOP - PLAYER_H, w: PLAYER_W, h: PLAYER_H,
        vx: 0, vy: 0, onGround: false, facing: 1,
        coyote: 0, buffer: 0, jumpHeld: false,
        animTimer: 0, animFrame: 0,
        hearts: 3, invuln: 0, hurtTimer: 0,
        weapon: null, owned: [], ammo: {}, cooldown: 0, muzzle: 0,
        safeX: 80, safeY: GROUND_TOP - PLAYER_H,
        dead: false, deadTimer: 0
    };

    const game = {
        state: 'title', // title | playing | paused | levelclear | gameover | victory
        levelIndex: 0,
        level: null,
        theme: null,
        character: readStore('character', 'ash'),
        score: 0,
        best: parseInt(readStore('best', '0'), 10) || 0,
        camX: 0,
        shake: 0,
        flash: 0,
        tick: 0,
        inView: true,
        unlocked: new Set(),
        maxLevel: parseInt(readStore('maxLevel', '0'), 10) || 0,
        pause() { if (this.state !== 'playing') return; this.state = 'paused'; ui.showPanel('paused'); },
        resume() { if (this.state !== 'paused') return; this.state = 'playing'; ui.showPanel(null); },
        restartLevel() { loadLevel(this.levelIndex, true); },
        start(index) { loadLevel(index == null ? 0 : index, true); }
    };

    if (SPR.characters[game.character] === undefined) game.character = 'ash';

    try {
        JSON.parse(readStore('links', '[]')).forEach((id) => { if (LINKS[id]) game.unlocked.add(id); });
    } catch (e) { /* ignore */ }

    let solids = [];
    let blocks = [];
    let movers = [];
    let coins = [];
    let enemies = [];
    let hazards = [];
    let emblems = [];
    let bolts = [];
    let bits = [];      // particles
    let floaters = [];  // rising score text
    let boss = null;
    let goal = null;
    let arena = null;
    let backdrop = null;
    let motes = [];
    let reducedMotion = false;

    try {
        reducedMotion = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { /* ignore */ }

    /* ============================== level loading ============================ */

    function loadLevel(index, resetRun) {
        game.levelIndex = Math.max(0, Math.min(DATA.LEVELS.length - 1, index));
        const def = DATA.LEVELS[game.levelIndex];
        game.level = def;
        game.theme = THEMES[def.theme];

        solids = [];
        blocks = [];
        movers = [];
        coins = [];
        enemies = [];
        hazards = [];
        emblems = [];
        bolts = [];
        bits = [];
        floaters = [];
        boss = null;
        arena = null;

        def.ground.forEach((seg) => {
            solids.push({ x: seg[0], y: GROUND_TOP, w: seg[1] - seg[0], h: 260, kind: 'ground' });
        });
        def.solids.forEach((s) => { solids.push({ x: s.x, y: s.y, w: s.w, h: s.h, kind: s.kind }); });

        // Invisible walls at both ends.
        solids.push({ x: -40, y: -400, w: 40, h: 1200, kind: 'metal' });
        solids.push({ x: def.width, y: -400, w: 40, h: 1200, kind: 'metal' });

        (def.movers || []).forEach((m) => {
            movers.push({
                baseX: m.x, baseY: m.y, x: m.x, y: m.y, w: m.w, h: m.h,
                axis: m.axis, range: m.range, speed: m.speed, phase: m.phase || 0,
                dx: 0, dy: 0, kind: 'platform'
            });
        });

        def.blocks.forEach((b) => {
            const link = b.kind === 'link' ? LINKS[b.link] : null;
            const block = {
                x: b.x, y: b.y, w: 48, h: 48, kind: b.kind,
                link: link, reward: b.reward || null,
                used: false, bob: 0, shine: Math.random() * Math.PI * 2
            };
            blocks.push(block);
            solids.push({ x: b.x, y: b.y, w: 48, h: 48, kind: 'blockbody', block: block });
        });

        def.coins.forEach((c) => { coins.push({ x: c.x, y: c.y, taken: false, spin: Math.random() * 8 }); });

        def.enemies.forEach((e) => { enemies.push(makeEnemy(e)); });

        (def.hazards || []).forEach((h) => {
            hazards.push({
                type: h.type, baseX: h.x, baseY: h.y, x: h.x, y: h.y,
                w: 30, h: 30, axis: h.axis, range: h.range, speed: h.speed,
                phase: h.phase || 0, spin: 0
            });
        });

        goal = def.goal ? { x: def.goal.x, y: def.goal.y, w: 48, h: 240, reached: false } : null;
        if (def.arena) arena = { trigger: def.arena.trigger, left: def.arena.left, right: def.arena.right, active: false, closed: false };

        backdrop = buildBackdrop(def, game.theme);
        motes = buildMotes(game.theme);

        player.x = 80;
        player.y = GROUND_TOP - PLAYER_H;
        player.vx = 0;
        player.vy = 0;
        player.facing = 1;
        player.dead = false;
        player.deadTimer = 0;
        player.invuln = 60;
        player.hurtTimer = 0;
        player.cooldown = 0;
        player.safeX = player.x;
        player.safeY = player.y;

        if (resetRun) {
            player.hearts = 3;
            player.weapon = null;
            player.owned = [];
            player.ammo = {};
        }

        game.camX = 0;
        game.shake = 0;
        game.flash = 0;
        game.state = 'playing';
        ui.showPanel(null);
        ui.setLevel(def);
        ui.syncHud(true);
    }

    function makeEnemy(spec) {
        const def = ENEMY_DEFS[spec.type];
        return {
            type: spec.type, def: def,
            x: spec.x, y: spec.y, w: def.w, h: def.h,
            vx: def.flying ? def.speed : def.speed, vy: 0,
            dir: -1, hp: def.hp, maxHp: def.hp,
            patrol: spec.patrol || null,
            baseY: spec.y, amp: spec.amp || 40, wave: Math.random() * Math.PI * 2,
            timer: 40 + Math.floor(Math.random() * 60),
            fireTimer: 40 + Math.floor(Math.random() * (def.fireRate || 90)),
            animTimer: 0, animFrame: 0, hitFlash: 0, onGround: false,
            dying: 0, alive: true, crouch: 0
        };
    }

    /* ============================== backdrops =============================== */

    function seeded(seed) {
        let s = seed >>> 0;
        return function () {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    function buildBackdrop(def, theme) {
        const rnd = seeded(def.width + def.name.length * 977);
        const out = { clouds: [], far: [], mid: [], props: [], stars: [], traces: [] };
        const span = def.width + VIEW_W;

        for (let i = 0; i < 14; i++) {
            out.clouds.push({ x: rnd() * span, y: 40 + rnd() * 150, s: 0.6 + rnd() * 0.9, o: 0.35 + rnd() * 0.5 });
        }
        for (let i = 0; i < 200; i++) {
            out.stars.push({ x: rnd() * span, y: rnd() * 300, r: rnd() < 0.85 ? 1 : 2, o: 0.25 + rnd() * 0.75, tw: rnd() * 6.28 });
        }
        for (let i = 0; i < 26; i++) {
            const w = 110 + rnd() * 220;
            out.far.push({ x: i * 190 - 200 + rnd() * 60, w: w, h: 90 + rnd() * 150 });
        }
        for (let i = 0; i < 34; i++) {
            const w = 70 + rnd() * 130;
            out.mid.push({ x: i * 150 - 200 + rnd() * 50, w: w, h: 60 + rnd() * 130, lit: rnd() });
        }
        for (let i = 0; i < 40; i++) {
            out.props.push({ x: i * 130 + rnd() * 90, s: 0.7 + rnd() * 0.8, k: Math.floor(rnd() * 3) });
        }
        for (let i = 0; i < 60; i++) {
            out.traces.push({
                x: rnd() * span, y: 30 + rnd() * 380,
                len: 60 + rnd() * 220, vert: rnd() < 0.4, o: 0.1 + rnd() * 0.3
            });
        }
        return out;
    }

    function buildMotes(theme) {
        const list = [];
        const count = reducedMotion ? 0 : (theme.motes === 'rain' ? 90 : 55);
        for (let i = 0; i < count; i++) {
            list.push({
                x: Math.random() * VIEW_W, y: Math.random() * VIEW_H,
                vx: theme.motes === 'rain' ? -1.6 : (Math.random() - 0.5) * 0.5,
                vy: theme.motes === 'rain' ? 5.5 + Math.random() * 3
                    : theme.motes === 'embers' ? -(0.4 + Math.random() * 0.8)
                        : 0.25 + Math.random() * 0.5,
                s: theme.motes === 'rain' ? 1 : 1 + Math.random() * 1.6,
                ph: Math.random() * 6.28
            });
        }
        return list;
    }

    /* =============================== collision ============================== */

    function overlaps(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function collidables() {
        const list = solids.concat(movers);
        if (arena && arena.closed) {
            list.push({ x: arena.left - 40, y: -400, w: 40, h: 1200, kind: 'metal' });
            list.push({ x: arena.right, y: -400, w: 40, h: 1200, kind: 'metal' });
        }
        return list;
    }

    function moveAndCollide(e, list, onHeadBump) {
        const prevBottom = e.y + e.h;

        e.x += e.vx;
        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (s.kind === 'platform') continue;
            if (!overlaps(e, s)) continue;
            if (e.vx > 0) e.x = s.x - e.w;
            else if (e.vx < 0) e.x = s.x + s.w;
            e.vx = 0;
            e.hitWall = true;
        }

        e.y += e.vy;
        e.onGround = false;
        e.rider = null;
        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (!overlaps(e, s)) continue;
            if (e.vy >= 0) {
                if (s.kind === 'platform' && prevBottom > s.y + 6) continue;
                e.y = s.y - e.h;
                e.vy = 0;
                e.onGround = true;
                e.rider = s;
            } else if (s.kind !== 'platform') {
                e.y = s.y + s.h;
                e.vy = 0;
                if (onHeadBump) onHeadBump(s);
            }
        }
    }

    /* ================================ effects =============================== */

    function spark(x, y, count, colour, power, gravity) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = (0.3 + Math.random()) * (power || 4);
            bits.push({
                x: x, y: y,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (power || 4) * 0.3,
                g: gravity == null ? 0.32 : gravity,
                life: 24 + Math.random() * 20, max: 44,
                size: 2 + Math.random() * 3, colour: colour || '#ffe066'
            });
        }
    }

    function ring(x, y, colour) {
        bits.push({ x: x, y: y, ringR: 4, ringMax: 46, life: 20, max: 20, colour: colour || '#ffffff', isRing: true });
    }

    function floatText(x, y, text, colour) {
        floaters.push({ x: x, y: y, text: text, life: 52, max: 52, colour: colour || '#ffffff' });
    }

    function shake(amount) {
        if (reducedMotion) return;
        game.shake = Math.min(16, game.shake + amount);
    }

    /* ============================== player logic ============================ */

    function giveWeapon(id) {
        const w = WEAPONS[id];
        if (!w) return;
        if (player.owned.indexOf(id) < 0) player.owned.push(id);
        player.ammo[id] = w.ammo === Infinity ? Infinity : (player.ammo[id] || 0) + w.ammo;
        player.weapon = id;
        audio.power();
        ui.syncHud(true);
    }

    function cycleWeapon() {
        if (player.owned.length < 2) return;
        const i = player.owned.indexOf(player.weapon);
        for (let n = 1; n <= player.owned.length; n++) {
            const cand = player.owned[(i + n) % player.owned.length];
            if (player.ammo[cand] === Infinity || player.ammo[cand] > 0) {
                player.weapon = cand;
                audio.power();
                ui.syncHud(true);
                return;
            }
        }
    }

    function fireWeapon() {
        const w = WEAPONS[player.weapon];
        if (!w || player.cooldown > 0) return;
        const ammo = player.ammo[player.weapon];
        if (ammo !== Infinity && ammo <= 0) {
            player.weapon = 'blaster';
            if (player.owned.indexOf('blaster') < 0) return;
            ui.syncHud(true);
            return;
        }

        player.cooldown = w.cooldown;
        player.muzzle = 6;
        if (ammo !== Infinity) player.ammo[player.weapon] = ammo - 1;

        const originX = player.x + (player.facing > 0 ? player.w + 2 : -2);
        const originY = player.y + 18;

        for (let i = 0; i < w.shots; i++) {
            const offset = w.shots === 1 ? 0 : (i - (w.shots - 1) / 2) * w.spread;
            bolts.push({
                x: originX - (player.facing > 0 ? 0 : w.w),
                y: originY - w.h / 2,
                w: w.w, h: w.h,
                vx: Math.cos(offset) * w.speed * player.facing,
                vy: Math.sin(offset) * w.speed,
                damage: w.damage, pierce: w.pierce, hostile: false,
                colour: w.colour, glow: w.glow, life: 90, hitList: []
            });
        }
        spark(originX, originY, 4, w.glow, 2.5, 0.05);
        audio.shoot();
        ui.syncHud();
    }

    function hurtPlayer(fromX) {
        if (player.invuln > 0 || player.dead || game.state !== 'playing') return;
        player.hearts -= 1;
        player.invuln = 96;
        player.hurtTimer = 26;
        player.vy = -7.5;
        player.vx = fromX != null && fromX > player.x ? -4.5 : 4.5;
        audio.hurt();
        shake(9);
        game.flash = 8;
        ring(player.x + player.w / 2, player.y + player.h / 2, '#fb7185');
        ui.syncHud(true);
        if (player.hearts <= 0) killPlayer();
    }

    function killPlayer() {
        if (player.dead) return;
        player.dead = true;
        player.deadTimer = 96;
        player.vy = -12;
        player.vx = 0;
        spark(player.x + player.w / 2, player.y + player.h / 2, 22, '#fb7185', 6);
        audio.fail();
    }

    /* Put the player back on solid ground, well clear of the ledge they just
     * walked off, so a fall can't turn into a death loop. */
    function footing(x) {
        const segments = game.level.ground;
        let best = null;
        let bestGap = Infinity;
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const left = Math.max(seg[0] + 48, 0);
            const right = seg[1] - 80;
            if (right <= left) continue;
            if (x >= seg[0] && x <= seg[1]) return Math.max(left, Math.min(right, x - 56));
            const gap = x < seg[0] ? seg[0] - x : x - seg[1];
            if (gap < bestGap) { bestGap = gap; best = x < seg[0] ? left : right; }
        }
        return best == null ? 80 : best;
    }

    function respawnFromPit() {
        player.hearts -= 1;
        ui.syncHud(true);
        if (player.hearts <= 0) { killPlayer(); return; }
        player.x = footing(player.safeX);
        player.y = GROUND_TOP - PLAYER_H - 8;
        player.vx = 0;
        player.vy = 0;
        player.invuln = 90;
        player.safeX = player.x;
        player.safeY = player.y;
        game.flash = 6;
        game.camX = Math.max(0, Math.min(game.level.width - VIEW_W, player.x - VIEW_W / 2));
        spark(player.x + player.w / 2, player.y + player.h, 12, 'rgba(255,255,255,0.6)', 3.5);
        audio.hurt();
    }

    function updatePlayer() {
        if (player.dead) {
            player.deadTimer -= 1;
            player.vy = Math.min(MAX_FALL, player.vy + GRAVITY);
            player.y += player.vy;
            if (player.deadTimer <= 0) {
                if (game.score > game.best) { game.best = game.score; writeStore('best', String(game.best)); }
                game.state = 'gameover';
                ui.showPanel('gameover');
            }
            return;
        }

        const accel = player.onGround ? RUN_ACCEL : AIR_ACCEL;
        if (input.left && !input.right) {
            player.vx -= accel;
            player.facing = -1;
        } else if (input.right && !input.left) {
            player.vx += accel;
            player.facing = 1;
        } else if (player.onGround) {
            player.vx *= FRICTION;
            if (Math.abs(player.vx) < 0.12) player.vx = 0;
        } else {
            player.vx *= 0.985;
        }
        player.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, player.vx));

        if (player.onGround) player.coyote = COYOTE; else player.coyote -= 1;
        if (input.jumpPressed) player.buffer = JUMP_BUFFER; else player.buffer -= 1;

        if (player.buffer > 0 && player.coyote > 0) {
            player.vy = JUMP_V;
            player.onGround = false;
            player.coyote = 0;
            player.buffer = 0;
            player.jumpHeld = true;
            audio.jump();
            spark(player.x + player.w / 2, player.y + player.h, 5, 'rgba(255,255,255,0.7)', 2.2);
        }

        // Variable jump height: release early to cut the arc short.
        if (player.jumpHeld && !input.jump && player.vy < JUMP_CUT_V) {
            player.vy = JUMP_CUT_V;
            player.jumpHeld = false;
        }
        if (player.vy >= 0) player.jumpHeld = false;

        player.vy = Math.min(MAX_FALL, player.vy + GRAVITY);

        const list = collidables();
        moveAndCollide(player, list, (s) => {
            if (s.block) punchBlock(s.block);
        });

        if (player.rider && player.rider.dx !== undefined) {
            player.x += player.rider.dx;
            player.y += player.rider.dy;
        }

        if (player.onGround && player.y + player.h <= GROUND_TOP + 4) {
            player.safeX = player.x;
            player.safeY = player.y;
        }

        if (player.cooldown > 0) player.cooldown -= 1;
        if (player.muzzle > 0) player.muzzle -= 1;
        if (player.invuln > 0) player.invuln -= 1;
        if (player.hurtTimer > 0) player.hurtTimer -= 1;

        if ((input.fire || input.firePressed) && player.weapon) fireWeapon();

        // Animation frame.
        const moving = Math.abs(player.vx) > 0.5;
        if (!player.onGround) {
            player.animFrame = 3;
        } else if (moving) {
            player.animTimer += Math.abs(player.vx);
            if (player.animTimer > 14) { player.animTimer = 0; player.animFrame = player.animFrame === 1 ? 2 : 1; }
            if (player.animFrame !== 1 && player.animFrame !== 2) player.animFrame = 1;
            if (Math.random() < 0.25) {
                bits.push({
                    x: player.x + player.w / 2, y: player.y + player.h - 2,
                    vx: -player.vx * 0.3, vy: -Math.random() * 0.8, g: 0.05,
                    life: 14, max: 14, size: 2, colour: 'rgba(255,255,255,0.28)'
                });
            }
        } else {
            player.animFrame = 0;
            player.animTimer = 0;
        }
        if (player.hurtTimer > 0) player.animFrame = 4;

        if (player.y > VIEW_H + 80) respawnFromPit();
    }

    const PLAYER_FRAMES = ['idle', 'runA', 'runB', 'jump', 'hurt'];

    /* ================================ blocks ================================ */

    function punchBlock(block) {
        if (block.bob < -2) return;
        block.bob = -14;
        shake(4);

        if (block.used) { audio.hit(); return; }
        block.used = true;

        if (block.kind === 'link') {
            grantReward('link', block.link.id, block.x + 24, block.y - 6);
        } else if (block.reward === 'heart') {
            grantReward('heart', null, block.x + 24, block.y - 6);
        } else if (block.reward && block.reward.indexOf('weapon:') === 0) {
            grantReward('weapon', block.reward.slice(7), block.x + 24, block.y - 6);
        } else {
            for (let i = 0; i < 6; i++) {
                coins.push({
                    x: block.x + 6 + i * 7, y: block.y - 30 - i * 4, taken: false,
                    spin: Math.random() * 8, vy: -3 - Math.random() * 2, loose: true
                });
            }
            audio.coin();
        }
    }

    /* Rewards land the moment a block is broken — no chasing a token that might
     * drop into a pit. The emblem that rises out of the block is decoration. */
    function grantReward(kind, ref, x, y) {
        if (kind === 'link') {
            const link = LINKS[ref];
            game.score += 500;
            emblems.push({ kind: 'link', ref: ref, x: x, y: y, life: 0, max: 74 });
            ring(x, y, link.tint);
            spark(x, y, 22, link.tint, 5.5);
            floatText(x, y - 34, '+500', link.tint);
            ui.unlock(ref, true);
            audio.unlockSfx();
            shake(6);
        } else if (kind === 'heart') {
            player.hearts = Math.min(MAX_HEARTS, player.hearts + 1);
            emblems.push({ kind: 'heart', ref: null, x: x, y: y, life: 0, max: 60 });
            spark(x, y, 14, '#fb7185', 4);
            floatText(x, y - 30, '+1 HP', '#fb7185');
            audio.power();
        } else if (kind === 'weapon') {
            giveWeapon(ref);
            const w = WEAPONS[ref];
            emblems.push({ kind: 'weapon', ref: ref, x: x, y: y, life: 0, max: 66 });
            ring(x, y, w.glow);
            spark(x, y, 18, w.glow, 5);
            floatText(x, y - 32, w.name, w.colour);
        }
        ui.syncHud(true);
    }

    function updateBlocks() {
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            if (b.bob < 0) { b.bob = Math.min(0, b.bob + 2); }
            b.shine += 0.05;
        }
    }

    /* =============================== emblems =============================== */

    function updateEmblems() {
        for (let i = emblems.length - 1; i >= 0; i--) {
            const e = emblems[i];
            e.life += 1;
            if (e.life >= e.max) emblems.splice(i, 1);
        }
    }

    /* ================================= coins ================================ */

    function updateCoins() {
        for (let i = 0; i < coins.length; i++) {
            const c = coins[i];
            if (c.taken) continue;
            c.spin += 0.16;
            if (c.loose) {
                c.y += c.vy;
                c.vy += 0.34;
                if (c.y > GROUND_TOP - 26) { c.y = GROUND_TOP - 26; c.loose = false; }
            }
            const box = { x: c.x - 5, y: c.y - 5, w: 32, h: 32 };
            if (!player.dead && overlaps(player, box)) {
                c.taken = true;
                game.score += 25;
                spark(c.x + 11, c.y + 11, 6, '#ffe066', 3);
                audio.coin();
                ui.syncHud();
            }
        }
    }

    /* ================================ enemies =============================== */

    function updateEnemies() {
        const list = collidables();

        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];

            if (!e.alive) {
                e.dying -= 1;
                if (e.dying <= 0) enemies.splice(i, 1);
                continue;
            }

            if (e.hitFlash > 0) e.hitFlash -= 1;
            const dxToPlayer = (player.x + player.w / 2) - (e.x + e.w / 2);
            const dyToPlayer = (player.y + player.h / 2) - (e.y + e.h / 2);
            const dist = Math.abs(dxToPlayer);
            const onScreen = e.x > game.camX - 200 && e.x < game.camX + VIEW_W + 200;

            if (e.type === 'bug') {
                e.vx = e.def.speed * e.dir;
                e.vy = Math.min(MAX_FALL, e.vy + GRAVITY);
                e.hitWall = false;
                moveAndCollide(e, list);
                if (e.hitWall) e.dir *= -1;
                if (e.patrol) {
                    if (e.x < e.patrol[0]) { e.x = e.patrol[0]; e.dir = 1; }
                    if (e.x + e.w > e.patrol[1]) { e.x = e.patrol[1] - e.w; e.dir = -1; }
                }
                e.animTimer += 1;
                if (e.animTimer > e.def.animRate) { e.animTimer = 0; e.animFrame ^= 1; }
            } else if (e.type === 'hopper') {
                e.vy = Math.min(MAX_FALL, e.vy + GRAVITY);
                if (e.onGround) {
                    e.vx *= 0.82;
                    e.timer -= 1;
                    e.crouch = e.timer < 16 ? 1 : 0;
                    if (e.timer <= 0) {
                        e.timer = 70 + Math.floor(Math.random() * 50);
                        e.vy = -11.5;
                        const toward = dist < 420 ? Math.sign(dxToPlayer) || 1 : e.dir;
                        e.dir = toward;
                        e.vx = toward * e.def.speed * 1.7;
                    }
                }
                e.hitWall = false;
                moveAndCollide(e, list);
                if (e.hitWall) e.dir *= -1;
                if (e.patrol) {
                    if (e.x < e.patrol[0]) { e.x = e.patrol[0]; e.vx = Math.abs(e.vx); e.dir = 1; }
                    if (e.x + e.w > e.patrol[1]) { e.x = e.patrol[1] - e.w; e.vx = -Math.abs(e.vx); e.dir = -1; }
                }
                e.animFrame = e.onGround && e.crouch ? 1 : 0;
            } else if (e.type === 'drone') {
                e.wave += 0.045;
                e.y = e.baseY + Math.sin(e.wave) * e.amp;
                e.x += e.def.speed * e.dir;
                if (e.patrol) {
                    if (e.x < e.patrol[0]) e.dir = 1;
                    if (e.x + e.w > e.patrol[1]) e.dir = -1;
                }
                e.animTimer += 1;
                if (e.animTimer > e.def.animRate) { e.animTimer = 0; e.animFrame ^= 1; }
                if (onScreen && dist < 340 && dyToPlayer > -40) {
                    e.fireTimer -= 1;
                    if (e.fireTimer <= 0) {
                        e.fireTimer = e.def.fireRate;
                        const ang = Math.atan2(dyToPlayer, dxToPlayer);
                        bolts.push({
                            x: e.x + e.w / 2 - 4, y: e.y + e.h - 2, w: 8, h: 8,
                            vx: Math.cos(ang) * 3.6, vy: Math.sin(ang) * 3.6,
                            damage: 1, hostile: true, colour: '#9be7f2', glow: '#22d3ee',
                            life: 180, hitList: []
                        });
                        audio.hit();
                    }
                }
            } else if (e.type === 'sentry') {
                e.animFrame = 0;
                if (onScreen && dist < 460 && Math.abs(dyToPlayer) < 70) {
                    e.dir = Math.sign(dxToPlayer) || 1;
                    e.fireTimer -= 1;
                    if (e.fireTimer <= 0) {
                        e.fireTimer = e.def.fireRate;
                        bolts.push({
                            x: e.x + e.w / 2 - 6, y: e.y + 14, w: 14, h: 6,
                            vx: 4.4 * e.dir, vy: 0,
                            damage: 1, hostile: true, colour: '#ffd166', glow: '#fb7185',
                            life: 180, hitList: []
                        });
                        spark(e.x + e.w / 2 + e.dir * 14, e.y + 17, 4, '#ffd166', 2, 0.02);
                        audio.hit();
                    }
                }
            }

            // Stomp / contact.
            if (!player.dead && overlaps(player, e)) {
                const playerFalling = player.vy > 1.2;
                const abovish = (player.y + player.h) - e.y < 20;
                if (playerFalling && abovish && e.def.stompable) {
                    damageEnemy(e, 2, true);
                    player.vy = input.jump ? -14 : -10.5;
                    player.jumpHeld = input.jump;
                    audio.stomp();
                    shake(4);
                } else {
                    hurtPlayer(e.x + e.w / 2);
                }
            }
        }
    }

    function damageEnemy(e, amount, stomped) {
        e.hp -= amount;
        e.hitFlash = 7;
        spark(e.x + e.w / 2, e.y + e.h / 2, stomped ? 10 : 7, '#ffffff', 3.5);
        if (e.hp > 0) { audio.hit(); return; }
        e.alive = false;
        e.dying = 18;
        game.score += e.def.score;
        floatText(e.x + e.w / 2, e.y, '+' + e.def.score, '#ffe066');
        spark(e.x + e.w / 2, e.y + e.h / 2, 16, '#ffe066', 5);
        ring(e.x + e.w / 2, e.y + e.h / 2, '#ffffff');
        if (Math.random() < 0.35) {
            coins.push({ x: e.x + e.w / 2 - 11, y: e.y, taken: false, spin: 0, vy: -4, loose: true });
        }
        ui.syncHud();
    }

    /* ================================ hazards =============================== */

    function updateHazards() {
        for (let i = 0; i < hazards.length; i++) {
            const h = hazards[i];
            h.phase += 0.02 * h.speed;
            const off = Math.sin(h.phase) * h.range;
            h.x = h.axis === 'x' ? h.baseX + off : h.baseX;
            h.y = h.axis === 'y' ? h.baseY + off : h.baseY;
            h.spin += 0.24;
            if (!player.dead && overlaps(player, h)) hurtPlayer(h.x + h.w / 2);
        }
    }

    function updateMovers() {
        for (let i = 0; i < movers.length; i++) {
            const m = movers[i];
            m.phase += 0.02 * m.speed;
            const off = Math.sin(m.phase) * m.range;
            const nx = m.axis === 'x' ? m.baseX + off : m.baseX;
            const ny = m.axis === 'y' ? m.baseY + off : m.baseY;
            m.dx = nx - m.x;
            m.dy = ny - m.y;
            m.x = nx;
            m.y = ny;
        }
    }

    /* ================================= bolts ================================ */

    function updateBolts() {
        const list = collidables();

        for (let i = bolts.length - 1; i >= 0; i--) {
            const b = bolts[i];
            b.x += b.vx;
            b.y += b.vy;
            b.life -= 1;

            if (b.life <= 0 || b.x < game.camX - 260 || b.x > game.camX + VIEW_W + 260 || b.y < -60 || b.y > VIEW_H + 60) {
                bolts.splice(i, 1);
                continue;
            }

            let gone = false;
            for (let s = 0; s < list.length; s++) {
                const sol = list[s];
                if (sol.kind === 'platform') continue;
                if (!overlaps(b, sol)) continue;
                spark(b.x + b.w / 2, b.y + b.h / 2, 5, b.glow, 2.6, 0.08);
                gone = true;
                break;
            }
            if (gone) { bolts.splice(i, 1); continue; }

            if (b.hostile) {
                if (!player.dead && overlaps(b, player)) {
                    hurtPlayer(b.x);
                    bolts.splice(i, 1);
                }
                continue;
            }

            for (let e = 0; e < enemies.length; e++) {
                const en = enemies[e];
                if (!en.alive || b.hitList.indexOf(en) >= 0) continue;
                if (!overlaps(b, en)) continue;
                damageEnemy(en, b.damage, false);
                if (b.pierce) { b.hitList.push(en); } else { gone = true; }
                break;
            }
            if (!gone && boss && boss.alive && overlaps(b, boss) && b.hitList.indexOf(boss) < 0) {
                damageBoss(b.damage);
                if (b.pierce) b.hitList.push(boss); else gone = true;
            }
            if (gone) bolts.splice(i, 1);
        }
    }

    /* ================================== boss ================================ */

    function spawnBoss() {
        const def = game.level.boss;
        boss = {
            x: def.x, y: def.y, w: 108, h: 88,
            baseY: def.y, vx: 0, vy: 0,
            hp: BOSS_HP, maxHp: BOSS_HP,
            phase: 'entry', timer: 90, wave: 0, spin: 0,
            hitFlash: 0, alive: true, dying: 0,
            name: def.name, link: def.link, intro: 90
        };
        arena.active = true;
        arena.closed = true;
        ui.setBoss(boss);
        audio.boom();
        shake(10);
    }

    function updateBoss() {
        if (!boss) return;

        if (!boss.alive) {
            boss.dying -= 1;
            if (boss.dying % 6 === 0) {
                spark(boss.x + Math.random() * boss.w, boss.y + Math.random() * boss.h, 10, '#fb7185', 5);
                shake(4);
            }
            if (boss.dying <= 0) {
                grantReward('link', boss.link, boss.x + boss.w / 2, boss.y + 40);
                arena.closed = false;
                arena.clearTimer = 170;
                boss = null;
                ui.setBoss(null);
            }
            return;
        }

        boss.wave += 0.03;
        boss.spin += 0.02;
        if (boss.hitFlash > 0) boss.hitFlash -= 1;
        boss.timer -= 1;

        const px = player.x + player.w / 2;

        if (boss.phase === 'entry') {
            boss.y = boss.baseY + Math.sin(boss.wave) * 14;
            if (boss.timer <= 0) { boss.phase = 'hover'; boss.timer = 150; }
        } else if (boss.phase === 'hover') {
            boss.y = boss.baseY + Math.sin(boss.wave) * 22;
            const target = Math.max(arena.left + 60, Math.min(arena.right - boss.w - 60, px - boss.w / 2));
            boss.x += (target - boss.x) * 0.012;
            if (boss.timer % 42 === 0) bossSpread();
            if (boss.timer <= 0) {
                boss.phase = Math.random() < 0.5 ? 'telegraph' : 'summon';
                boss.timer = boss.phase === 'telegraph' ? 45 : 60;
            }
        } else if (boss.phase === 'telegraph') {
            boss.y = boss.baseY + Math.sin(boss.wave * 3) * 8;
            if (boss.timer <= 0) {
                boss.phase = 'charge';
                boss.timer = 150;
                boss.vx = px < boss.x + boss.w / 2 ? -7 : 7;
                boss.baseY = GROUND_TOP - boss.h - 10;
                audio.boom();
            }
        } else if (boss.phase === 'charge') {
            boss.y += ((GROUND_TOP - boss.h - 6) - boss.y) * 0.12;
            boss.x += boss.vx;
            if (boss.x < arena.left + 10) { boss.x = arena.left + 10; boss.vx = Math.abs(boss.vx); shake(7); }
            if (boss.x + boss.w > arena.right - 10) { boss.x = arena.right - 10 - boss.w; boss.vx = -Math.abs(boss.vx); shake(7); }
            if (boss.timer % 4 === 0) spark(boss.x + boss.w / 2, boss.y + boss.h, 3, '#fb7185', 3);
            if (boss.timer <= 0) {
                boss.phase = 'hover';
                boss.timer = 160;
                boss.baseY = 190;
            }
        } else if (boss.phase === 'summon') {
            boss.y = boss.baseY + Math.sin(boss.wave * 2) * 16;
            if (boss.timer === 30) {
                for (let i = 0; i < 2; i++) {
                    const e = makeEnemy({ type: 'bug', x: boss.x + 20 + i * 60, y: boss.y + boss.h, patrol: [arena.left + 20, arena.right - 40] });
                    e.dir = i === 0 ? -1 : 1;
                    enemies.push(e);
                    spark(e.x, e.y, 10, '#8b5cf6', 4);
                }
                audio.power();
            }
            if (boss.timer <= 0) { boss.phase = 'hover'; boss.timer = 150; }
        }

        if (!player.dead && overlaps(player, boss)) {
            const stomping = player.vy > 1.2 && (player.y + player.h) - boss.y < 26 && boss.phase !== 'charge';
            if (stomping) {
                damageBoss(1);
                player.vy = -12;
                audio.stomp();
            } else {
                hurtPlayer(boss.x + boss.w / 2);
            }
        }
    }

    function bossSpread() {
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        const base = Math.atan2(py - (boss.y + boss.h / 2), px - (boss.x + boss.w / 2));
        for (let i = -1; i <= 1; i++) {
            const ang = base + i * 0.26;
            bolts.push({
                x: boss.x + boss.w / 2 - 6, y: boss.y + boss.h / 2 - 6, w: 12, h: 12,
                vx: Math.cos(ang) * 4.2, vy: Math.sin(ang) * 4.2,
                damage: 1, hostile: true, colour: '#fda4af', glow: '#fb7185',
                life: 220, hitList: []
            });
        }
        audio.hit();
    }

    function damageBoss(amount) {
        boss.hp -= amount;
        boss.hitFlash = 8;
        spark(boss.x + boss.w / 2, boss.y + boss.h / 2, 10, '#ffffff', 4);
        ui.setBoss(boss);
        if (boss.hp > 0) { audio.hit(); return; }
        boss.alive = false;
        boss.dying = 100;
        game.score += 5000;
        floatText(boss.x + boss.w / 2, boss.y, '+5000', '#ffe066');
        audio.boom();
        shake(14);
        game.flash = 14;
    }

    /* ============================== progression ============================= */

    function checkProgress() {
        if (arena && !arena.active && player.x > arena.trigger) spawnBoss();

        if (goal && !goal.reached && !player.dead) {
            // The trigger is the whole column, not just the drawn gate, so a
            // high jump across the finish still counts.
            const box = { x: goal.x, y: 0, w: goal.w, h: goal.y + goal.h };
            if (overlaps(player, box)) {
                goal.reached = true;
                completeLevel();
            }
        }

        // Boss level has no exit gate: clearing the boss clears the level. Hold
        // for a beat first so the last link emblem gets its moment.
        if (arena && arena.clearTimer != null && !player.dead) {
            arena.clearTimer -= 1;
            if (arena.clearTimer <= 0) {
                arena.clearTimer = null;
                completeLevel();
            }
        }
    }

    function completeLevel() {
        if (game.state !== 'playing') return;
        const isLast = game.levelIndex >= DATA.LEVELS.length - 1;
        game.score += 1000 + player.hearts * 250;
        if (game.score > game.best) { game.best = game.score; writeStore('best', String(game.best)); }
        if (game.levelIndex + 1 > game.maxLevel) {
            game.maxLevel = Math.min(DATA.LEVELS.length - 1, game.levelIndex + 1);
            writeStore('maxLevel', String(game.maxLevel));
        }
        audio.clear();
        game.state = isLast ? 'victory' : 'levelclear';
        ui.showPanel(isLast ? 'victory' : 'levelclear');
        ui.syncHud(true);
    }

    /* =============================== particles ============================== */

    function updateBits() {
        for (let i = bits.length - 1; i >= 0; i--) {
            const p = bits[i];
            p.life -= 1;
            if (p.isRing) {
                p.ringR += (p.ringMax - p.ringR) * 0.22;
            } else {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.g;
                p.vx *= 0.99;
            }
            if (p.life <= 0) bits.splice(i, 1);
        }
        for (let i = floaters.length - 1; i >= 0; i--) {
            const f = floaters[i];
            f.life -= 1;
            f.y -= 0.7;
            if (f.life <= 0) floaters.splice(i, 1);
        }
        for (let i = 0; i < motes.length; i++) {
            const m = motes[i];
            m.x += m.vx;
            m.y += m.vy;
            m.ph += 0.03;
            if (m.y > VIEW_H + 10) { m.y = -10; m.x = Math.random() * VIEW_W; }
            if (m.y < -10) { m.y = VIEW_H + 10; m.x = Math.random() * VIEW_W; }
            if (m.x < -10) m.x = VIEW_W + 10;
            if (m.x > VIEW_W + 10) m.x = -10;
        }
    }

    /* ================================= camera =============================== */

    function updateCamera() {
        const look = player.facing * 70;
        let target = player.x + player.w / 2 - VIEW_W / 2 + look;
        let minX = 0;
        let maxX = game.level.width - VIEW_W;
        if (arena && arena.closed) {
            minX = Math.max(0, arena.left - 20);
            maxX = Math.min(maxX, arena.right + 20 - VIEW_W);
            if (maxX < minX) maxX = minX;
        }
        target = Math.max(minX, Math.min(maxX, target));
        game.camX += (target - game.camX) * 0.11;
        if (game.shake > 0) game.shake *= 0.86;
        if (game.shake < 0.2) game.shake = 0;
        if (game.flash > 0) game.flash -= 1;
    }

    /* ================================== step ================================ */

    function step() {
        game.tick += 1;

        if (game.state === 'playing') {
            updateMovers();
            updatePlayer();
            updateBlocks();
            updateEnemies();
            updateHazards();
            updateBolts();
            updateEmblems();
            updateCoins();
            updateBoss();
            updateBits();
            updateCamera();
            checkProgress();
        } else if (game.state === 'title') {
            // Attract mode: the world keeps breathing behind the title card.
            updateMovers();
            updateBlocks();
            updateHazards();
            updateBits();
            const span = Math.max(0, game.level.width - VIEW_W);
            game.camX = (Math.sin(game.tick * 0.0022) * 0.5 + 0.5) * Math.min(span, 760);
            player.x = game.camX + VIEW_W * 0.26;
            player.y = GROUND_TOP - PLAYER_H;
            player.animFrame = 0;
            player.facing = 1;
            player.invuln = 0;
            player.dead = false;
        } else {
            updateBits();
        }

        input.jumpPressed = false;
        input.firePressed = false;
    }

    /* ================================ drawing =============================== */

    function blit(sprite, x, y, w, h, flip) {
        if (!sprite) return;
        const rx = Math.round(x);
        const ry = Math.round(y);
        if (flip) {
            ctx.save();
            ctx.translate(rx + w, ry);
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, 0, 0, w, h);
            ctx.restore();
        } else {
            ctx.drawImage(sprite, rx, ry, w, h);
        }
    }

    function drawSky(theme) {
        const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        g.addColorStop(0, theme.sky[0]);
        g.addColorStop(0.55, theme.sky[1]);
        g.addColorStop(1, theme.sky[2]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    function drawBackdrop(theme) {
        const cam = game.camX;

        if (theme.backdrop === 'city' || theme.backdrop === 'circuit') {
            for (let i = 0; i < backdrop.stars.length; i++) {
                const s = backdrop.stars[i];
                const sx = wrap(s.x - cam * 0.08, VIEW_W + 40) - 20;
                const tw = 0.55 + 0.45 * Math.sin(game.tick * 0.03 + s.tw);
                ctx.fillStyle = 'rgba(255,255,255,' + (s.o * tw).toFixed(3) + ')';
                ctx.fillRect(Math.round(sx), Math.round(s.y), s.r, s.r);
            }
            // Moon / core glow
            const mx = wrap(760 - cam * 0.06, VIEW_W + 400) - 200;
            const grad = ctx.createRadialGradient(mx, 110, 6, mx, 110, 120);
            grad.addColorStop(0, theme.sun);
            grad.addColorStop(0.25, 'rgba(255,255,255,0.16)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(mx - 130, -20, 260, 260);

            ctx.fillStyle = theme.sun;
            ctx.beginPath();
            ctx.arc(mx, 110, 26, 0, Math.PI * 2);
            ctx.fill();
            // Terminator shading plus an orbital ring for a bit of depth.
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath();
            ctx.arc(mx + 9, 113, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = theme.sun;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(mx, 110, 42, 11, -0.32, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1;
            ctx.globalAlpha = 1;
        } else {
            const sx = wrap(700 - cam * 0.05, VIEW_W + 400) - 200;
            const grad = ctx.createRadialGradient(sx, 88, 6, sx, 88, 116);
            grad.addColorStop(0, 'rgba(255,255,255,0.98)');
            grad.addColorStop(0.16, 'rgba(255,248,222,0.52)');
            grad.addColorStop(1, 'rgba(255,246,214,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(sx - 124, -40, 248, 248);
            for (let i = 0; i < backdrop.clouds.length; i++) {
                const c = backdrop.clouds[i];
                const cx = wrap(c.x - cam * 0.16, game.level.width + VIEW_W) - 120;
                if (cx < -220 || cx > VIEW_W + 220) continue;
                drawCloud(cx, c.y + Math.sin(game.tick * 0.006 + i) * 4, c.s, c.o);
            }
        }

        if (theme.backdrop === 'hills') {
            // Lightest furthest back so the tree line reads against the hills.
            drawHillLayer(backdrop.far, 0.22, theme.far);
            drawHillLayer(backdrop.mid, 0.42, theme.farDark);
            drawTreeLine(0.6, theme.midDark);
        } else if (theme.backdrop === 'city') {
            drawSkyline(backdrop.far, 0.2, theme.farDark, false);
            drawSkyline(backdrop.mid, 0.42, theme.mid, true);
            drawNeonSigns(0.42);
        } else {
            drawTraces(0.16, theme.sun);
            drawSkyline(backdrop.far, 0.22, theme.farDark, false);
            drawRacks(0.44, theme.mid, theme.accent);
        }
    }

    function wrap(v, span) {
        return ((v % span) + span) % span;
    }

    /* The scenery is stepped onto a coarse grid so distant shapes read as the
       same pixel art as the sprites rather than smooth vector curves. Every
       helper below adds grid-aligned rects to the *current* path and leaves the
       fill to the caller: one fill per shape keeps translucent pieces from
       double-darkening where they overlap, and rect subpaths never get joined
       by the stray connecting lines that arcs in a shared path produce. */
    const BG_PX = 4;

    function snap(v) {
        return Math.round(v / BG_PX) * BG_PX;
    }

    function pxDisc(cx, cy, r) {
        const top = snap(cy - r);
        const bottom = snap(cy + r);
        for (let y = top; y < bottom; y += BG_PX) {
            const dy = y + BG_PX / 2 - cy;
            const half = Math.sqrt(Math.max(0, r * r - dy * dy));
            const x0 = snap(cx - half);
            const w = snap(cx + half) - x0;
            if (w > 0) ctx.rect(x0, y, w, BG_PX);
        }
    }

    function pxDome(cx, cy, r) {
        const top = snap(cy - r);
        for (let y = top; y < snap(cy); y += BG_PX) {
            const dy = y + BG_PX / 2 - cy;
            const half = Math.sqrt(Math.max(0, r * r - dy * dy));
            const x0 = snap(cx - half);
            const w = snap(cx + half) - x0;
            if (w > 0) ctx.rect(x0, y, w, BG_PX);
        }
    }

    function pxCone(cx, baseY, halfBase, height) {
        const h = Math.max(BG_PX, snap(height));
        for (let y = 0; y < h; y += BG_PX) {
            const half = snap(halfBase * ((y + BG_PX) / h));
            if (half <= 0) continue;
            ctx.rect(snap(cx - half), baseY - h + y, half * 2, BG_PX);
        }
    }

    function drawCloud(x, y, s, o) {
        const u = 16 * s;
        ctx.fillStyle = 'rgba(255,255,255,' + o.toFixed(2) + ')';
        ctx.beginPath();
        pxDisc(x, y, u);
        pxDisc(x + u * 1.4, y - u * 0.35, u * 1.25);
        pxDisc(x + u * 2.9, y, u * 0.95);
        pxDisc(x + u * 1.5, y + u * 0.5, u * 1.05);
        ctx.fill();
    }

    function drawHillLayer(items, parallax, colour) {
        const cam = game.camX * parallax;
        ctx.fillStyle = colour;
        ctx.beginPath();
        for (let i = 0; i < items.length; i++) {
            const hill = items[i];
            const left = hill.x - cam;
            if (left + hill.w < -80 || left > VIEW_W + 80) continue;
            const x0 = snap(left);
            const x1 = snap(left + hill.w);
            for (let x = x0; x < x1; x += BG_PX) {
                // Matches the old quadratic silhouette: peak is half the height.
                const t = (x + BG_PX / 2 - left) / hill.w;
                const rise = snap(2 * t * (1 - t) * hill.h);
                if (rise > 0) ctx.rect(x, GROUND_TOP - rise, BG_PX, rise);
            }
        }
        ctx.fill();
    }

    function drawTreeLine(parallax, colour) {
        const cam = game.camX * parallax;
        for (let i = 0; i < backdrop.props.length; i++) {
            const p = backdrop.props[i];
            const x = p.x - cam;
            if (x < -80 || x > VIEW_W + 80) continue;
            const s = p.s;

            if (p.k === 0) {
                ctx.fillStyle = '#4b3320';
                ctx.fillRect(snap(x + 10 * s), GROUND_TOP - snap(34 * s), Math.max(BG_PX, snap(7 * s)), snap(34 * s));
                ctx.fillStyle = colour;
                ctx.beginPath();
                pxDisc(x + 13 * s, GROUND_TOP - 44 * s, 20 * s);
                pxDisc(x + 2 * s, GROUND_TOP - 34 * s, 14 * s);
                pxDisc(x + 26 * s, GROUND_TOP - 34 * s, 14 * s);
                ctx.fill();
            } else if (p.k === 1) {
                ctx.fillStyle = colour;
                ctx.beginPath();
                pxDome(x, GROUND_TOP - 12 * s, 15 * s);
                pxDome(x + 22 * s, GROUND_TOP - 12 * s, 11 * s);
                ctx.rect(snap(x - 15 * s), GROUND_TOP - snap(13 * s), snap(48 * s), snap(13 * s));
                ctx.fill();
            } else {
                // Conifers sit a shade back: same path filled twice, once to
                // colour it and once to push it into the distance.
                ctx.beginPath();
                pxCone(x + 14 * s, GROUND_TOP, 14 * s, 46 * s);
                ctx.fillStyle = colour;
                ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.16)';
                ctx.fill();
            }
        }
    }

    function drawSkyline(items, parallax, colour, lit) {
        const cam = game.camX * parallax;
        for (let i = 0; i < items.length; i++) {
            const b = items[i];
            const x = snap(b.x - cam);
            const w = snap(b.w);
            if (x + w < -60 || x > VIEW_W + 60) continue;
            const top = GROUND_TOP - snap(b.h);
            ctx.fillStyle = colour;
            ctx.fillRect(x, top, w, GROUND_TOP - top);
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(x, top, w, BG_PX);
            if (lit) {
                const rows = Math.floor(b.h / 22);
                const cols = Math.max(1, Math.floor(b.w / 20));
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const on = ((i * 31 + r * 7 + c * 13) % 5) < 2;
                        if (!on) continue;
                        const flick = ((game.tick >> 5) + r + c + i) % 17 === 0;
                        ctx.fillStyle = flick ? 'rgba(255,255,255,0.08)' : 'rgba(255, 226, 150, 0.5)';
                        ctx.fillRect(x + 8 + c * 20, top + 12 + r * 22, 7, 9);
                    }
                }
            }
        }
    }

    function drawNeonSigns(parallax) {
        const cam = game.camX * parallax;
        const palette = ['#22d3ee', '#f472b6', '#a78bfa', '#facc15'];
        for (let i = 0; i < backdrop.props.length; i++) {
            const p = backdrop.props[i];
            const x = Math.round(p.x * 1.2 - cam);
            if (x < -80 || x > VIEW_W + 80) continue;
            const colour = palette[i % palette.length];
            const y = 190 + (i % 4) * 34;
            const pulse = 0.45 + 0.55 * Math.abs(Math.sin(game.tick * 0.02 + i));
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = colour;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, 46 + (i % 3) * 16, 20);
            ctx.globalAlpha = pulse * 0.25;
            ctx.lineWidth = 9;
            ctx.strokeRect(x, y, 46 + (i % 3) * 16, 20);
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
        }
    }

    function drawTraces(parallax, colour) {
        const cam = game.camX * parallax;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 2;
        for (let i = 0; i < backdrop.traces.length; i++) {
            const t = backdrop.traces[i];
            const x = Math.round(t.x - cam);
            if (x < -260 || x > VIEW_W + 260) continue;
            const pulse = 0.5 + 0.5 * Math.sin(game.tick * 0.02 + i * 0.7);
            ctx.globalAlpha = t.o * pulse;
            ctx.beginPath();
            if (t.vert) {
                ctx.moveTo(x, t.y);
                ctx.lineTo(x, t.y + t.len);
                ctx.lineTo(x + 40, t.y + t.len);
            } else {
                ctx.moveTo(x, t.y);
                ctx.lineTo(x + t.len, t.y);
                ctx.lineTo(x + t.len + 30, t.y + 30);
            }
            ctx.stroke();
            ctx.fillStyle = colour;
            ctx.fillRect(x - 2, t.y - 2, 5, 5);
            ctx.globalAlpha = 1;
        }
        ctx.lineWidth = 1;
    }

    function drawRacks(parallax, colour, accent) {
        const cam = game.camX * parallax;
        for (let i = 0; i < backdrop.mid.length; i++) {
            const b = backdrop.mid[i];
            const x = Math.round(b.x * 1.1 - cam);
            if (x + 90 < -60 || x > VIEW_W + 60) continue;
            const h = 120 + (i % 4) * 42;
            const top = GROUND_TOP - h;
            ctx.fillStyle = colour;
            ctx.fillRect(x, top, 84, h);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(x + 6, top + 8, 72, h - 16);
            for (let r = 0; r < Math.floor((h - 20) / 14); r++) {
                const on = ((game.tick >> 4) + r * 3 + i) % 6 < 3;
                ctx.fillStyle = on ? accent : 'rgba(255,255,255,0.12)';
                ctx.fillRect(x + 12, top + 14 + r * 14, 5, 5);
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(x + 22, top + 14 + r * 14, 48, 5);
            }
        }
    }

    /* Everything below the surface line is a void, so gaps read as real holes
     * instead of a window onto the sky. */
    function drawUnderground(theme) {
        const g = ctx.createLinearGradient(0, GROUND_TOP - 8, 0, VIEW_H);
        g.addColorStop(0, 'rgba(0,0,0,0.55)');
        g.addColorStop(0.4, shade(theme.sky[0], -0.82));
        g.addColorStop(1, '#04050a');
        ctx.fillStyle = g;
        ctx.fillRect(0, GROUND_TOP - 8, VIEW_W, VIEW_H - GROUND_TOP + 8);
    }

    function drawGround(theme) {
        const cam = game.camX;
        for (let i = 0; i < solids.length; i++) {
            const s = solids[i];
            if (s.kind !== 'ground') continue;
            const x = Math.round(s.x - cam);
            if (x + s.w < -40 || x > VIEW_W + 40) continue;
            const w = Math.round(s.w);

            const g = ctx.createLinearGradient(0, s.y, 0, VIEW_H);
            g.addColorStop(0, theme.ground);
            g.addColorStop(1, theme.groundDark);
            ctx.fillStyle = g;
            ctx.fillRect(x, s.y, w, VIEW_H - s.y);

            ctx.fillStyle = theme.groundTopDark;
            ctx.fillRect(x, s.y, w, 14);
            ctx.fillStyle = theme.groundTop;
            ctx.fillRect(x, s.y, w, 8);
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
            ctx.fillRect(x, s.y, w, 2);

            // Texture flecks, stable in world space.
            ctx.fillStyle = 'rgba(0,0,0,0.14)';
            const start = Math.floor(Math.max(s.x, cam - 40) / 24) * 24;
            const end = Math.min(s.x + s.w, cam + VIEW_W + 40);
            for (let wx = start; wx < end; wx += 24) {
                const seed = (wx * 2654435761) >>> 0;
                const oy = 20 + (seed % 5) * 16;
                ctx.fillRect(Math.round(wx - cam), s.y + oy, 10, 3);
                ctx.fillRect(Math.round(wx - cam + 12), s.y + oy + 22, 6, 3);
            }
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(x, s.y + 14, w, 2);

            // Surface fringe: tufts on grass, light strips on the tech levels.
            const fringeStart = Math.floor(Math.max(s.x, cam - 40) / 16) * 16;
            const fringeEnd = Math.min(s.x + s.w, cam + VIEW_W + 40);
            ctx.fillStyle = theme.groundTop;
            for (let wx = fringeStart; wx < fringeEnd; wx += 16) {
                const seed = (wx * 374761393) >>> 0;
                if (seed % 3 === 0) continue;
                const h = 3 + (seed % 4);
                const px = Math.round(wx - cam) + (seed % 5);
                ctx.fillRect(px, s.y - h, 2, h);
                if (seed % 7 === 0) ctx.fillRect(px + 3, s.y - h - 2, 2, h + 2);
            }
        }
    }

    function drawSolids(theme) {
        const cam = game.camX;
        const all = solids.concat(movers);
        for (let i = 0; i < all.length; i++) {
            const s = all[i];
            if (s.kind === 'ground' || s.kind === 'blockbody') continue;
            const x = Math.round(s.x - cam);
            if (x + s.w < -40 || x > VIEW_W + 40) continue;
            const y = Math.round(s.y);
            if (s.kind === 'brick') drawBrick(x, y, s.w, s.h, theme);
            else if (s.kind === 'metal') drawMetal(x, y, s.w, s.h, theme);
            else if (s.kind === 'platform') drawPlatform(x, y, s.w, s.h, theme);
        }
        if (arena && arena.closed) {
            drawArenaWall(Math.round(arena.left - 40 - cam), theme);
            drawArenaWall(Math.round(arena.right - cam), theme);
        }
    }

    function drawArenaWall(x, theme) {
        if (x + 40 < 0 || x > VIEW_W) return;
        const g = ctx.createLinearGradient(x, 0, x + 40, 0);
        g.addColorStop(0, theme.metalDark);
        g.addColorStop(0.5, theme.metal);
        g.addColorStop(1, theme.metalDark);
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, 40, GROUND_TOP);
        ctx.fillStyle = theme.accent;
        for (let y = 10; y < GROUND_TOP; y += 40) {
            ctx.globalAlpha = 0.35 + 0.35 * Math.sin(game.tick * 0.06 + y * 0.05);
            ctx.fillRect(x + 8, y, 24, 4);
        }
        ctx.globalAlpha = 1;
    }

    function drawBrick(x, y, w, h, theme) {
        ctx.fillStyle = theme.brickDark;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = theme.brick;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = theme.brickLight;
        ctx.fillRect(x + 2, y + 2, w - 4, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        for (let ry = y + h / 2; ry < y + h; ry += h / 2) ctx.fillRect(x + 2, Math.round(ry) - 1, w - 4, 2);
        ctx.fillRect(x + w / 2 - 1, y + 2, 2, h / 2 - 2);
        ctx.fillRect(x + w / 4 - 1, y + h / 2, 2, h / 2 - 2);
        ctx.fillRect(x + (w * 3) / 4 - 1, y + h / 2, 2, h / 2 - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x, y + h - 3, w, 3);
    }

    function drawMetal(x, y, w, h, theme) {
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, theme.metal);
        g.addColorStop(1, theme.metalDark);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x + 2, y + 2, w - 4, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        for (let ix = x + 7; ix < x + w - 4; ix += 16) {
            ctx.fillRect(ix, y + 6, 3, 3);
            ctx.fillRect(ix, y + h - 9, 3, 3);
        }
    }

    function drawPlatform(x, y, w, h, theme) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + 3, y + h, w - 6, 5);
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, theme.brickLight);
        g.addColorStop(0.4, theme.brick);
        g.addColorStop(1, theme.brickDark);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = theme.accent;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x, y, w, 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x, y + h - 2, w, 2);
    }

    function drawBlocks(theme) {
        const cam = game.camX;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            const x = Math.round(b.x - cam);
            if (x + 48 < -40 || x > VIEW_W + 40) continue;
            const y = Math.round(b.y + b.bob);
            const tint = b.kind === 'link' ? b.link.tint : '#ffc94d';

            if (b.used) {
                ctx.fillStyle = '#0d0d16';
                ctx.fillRect(x, y, 48, 48);
                ctx.fillStyle = shade(tint, -0.72);
                ctx.fillRect(x + 3, y + 3, 42, 42);
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(x + 6, y + 6, 36, 3);
                if (b.kind === 'link') {
                    ctx.fillStyle = shade(tint, -0.25);
                    ctx.font = '16px "Press Start 2P", monospace';
                    ctx.fillText(b.link.label, x + 24, y + 25);
                }
            } else {
                const pulse = 0.5 + 0.5 * Math.sin(b.shine);
                ctx.fillStyle = '#0d0d16';
                ctx.fillRect(x, y, 48, 48);
                const g = ctx.createLinearGradient(0, y, 0, y + 48);
                g.addColorStop(0, tint);
                g.addColorStop(1, shade(tint, -0.45));
                ctx.fillStyle = g;
                ctx.fillRect(x + 3, y + 3, 42, 42);
                ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + pulse * 0.35).toFixed(2) + ')';
                ctx.fillRect(x + 6, y + 6, 36, 3);
                ctx.fillRect(x + 6, y + 6, 3, 36);
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(x + 6, y + 39, 36, 3);
                ctx.fillRect(x + 39, y + 6, 3, 36);

                ctx.fillStyle = '#0d0d16';
                ctx.font = '16px "Press Start 2P", monospace';
                const label = b.kind === 'link' ? b.link.label : '?';
                ctx.fillText(label, x + 24, y + 26);
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.fillText(label, x + 24, y + 25);
            }

            if (b.kind === 'link') {
                ctx.font = '9px "Press Start 2P", monospace';
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.fillText(b.link.title.toUpperCase(), x + 24, y + 68);
                ctx.fillStyle = b.used ? shade(b.link.tint, -0.4) : b.link.tint;
                ctx.fillText(b.link.title.toUpperCase(), x + 24, y + 67);
            }
        }
    }

    function shade(hex, amount) {
        const n = parseInt(hex.slice(1), 16);
        let r = (n >> 16) & 255;
        let g = (n >> 8) & 255;
        let b = n & 255;
        if (amount < 0) {
            r = Math.round(r * (1 + amount));
            g = Math.round(g * (1 + amount));
            b = Math.round(b * (1 + amount));
        } else {
            r = Math.round(r + (255 - r) * amount);
            g = Math.round(g + (255 - g) * amount);
            b = Math.round(b + (255 - b) * amount);
        }
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    // Weighted towards the full face so a coin always reads as a coin; the
    // edge-on frame is a flick, not a third of the loop.
    const COIN_CYCLE = [0, 0, 1, 2, 1];

    function drawCoins() {
        const cam = game.camX;
        for (let i = 0; i < coins.length; i++) {
            const c = coins[i];
            if (c.taken) continue;
            const x = Math.round(c.x - cam);
            if (x < -30 || x > VIEW_W + 30) continue;
            const y = Math.round(c.y + Math.sin(c.spin * 0.5) * 2);
            const frame = COIN_CYCLE[Math.floor(c.spin / 0.42) % COIN_CYCLE.length];
            ctx.drawImage(SPR.prop('coin' + frame), x, y, 22, 22);
        }
    }

    function drawEmblems() {
        const cam = game.camX;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < emblems.length; i++) {
            const e = emblems[i];
            const t = e.life / e.max;
            const rise = 26 + Math.pow(t, 0.6) * 44;
            const cx = Math.round(e.x - cam);
            const cy = Math.round(e.y - rise);
            const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
            const size = Math.round(30 + Math.sin(Math.min(1, t * 3) * Math.PI * 0.5) * 8);
            const half = Math.round(size / 2);
            if (cx < -60 || cx > VIEW_W + 60) continue;

            ctx.globalAlpha = fade;
            if (e.kind === 'link') {
                const link = LINKS[e.ref];
                glowDisc(cx, cy, size * 1.3, link.tint, 0.5 * fade);
                ctx.fillStyle = '#0d0d16';
                ctx.fillRect(cx - half - 2, cy - half - 2, size + 4, size + 4);
                ctx.fillStyle = link.tint;
                ctx.fillRect(cx - half, cy - half, size, size);
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.fillRect(cx - half + 2, cy - half + 2, size - 4, 2);
                ctx.fillStyle = '#0d0d16';
                ctx.font = '13px "Press Start 2P", monospace';
                ctx.fillText(link.label, cx, cy + 1);
            } else if (e.kind === 'heart') {
                glowDisc(cx, cy, size * 1.2, '#fb7185', 0.45 * fade);
                drawHeartShape(cx - 12, cy - 12, 24, '#fb7185', '#7f1d3a');
            } else {
                const w = WEAPONS[e.ref];
                glowDisc(cx, cy, size * 1.3, w.glow, 0.5 * fade);
                ctx.fillStyle = '#0d0d16';
                ctx.fillRect(cx - half - 2, cy - 13, size + 4, 26);
                ctx.fillStyle = w.colour;
                ctx.fillRect(cx - half, cy - 11, size, 22);
                ctx.fillStyle = '#0d0d16';
                ctx.font = '9px "Press Start 2P", monospace';
                ctx.fillText(w.short, cx, cy + 1);
            }
            ctx.globalAlpha = 1;
        }
    }

    function glowDisc(x, y, r, colour, alpha) {
        const g = ctx.createRadialGradient(x, y, 2, x, y, r);
        g.addColorStop(0, colour);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = alpha;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    const HEART_ROWS = [
        '.oo.oo.',
        'o11o11o',
        'o11111o',
        'o12111o',
        '.o111o.',
        '..o1o..',
        '...o...'
    ];

    function drawHeartShape(x, y, size, colour, dark) {
        const u = size / 7;
        for (let r = 0; r < HEART_ROWS.length; r++) {
            for (let c = 0; c < HEART_ROWS[r].length; c++) {
                const ch = HEART_ROWS[r][c];
                if (ch === '.') continue;
                ctx.fillStyle = ch === 'o' ? dark : (ch === '2' ? 'rgba(255,255,255,0.8)' : colour);
                ctx.fillRect(Math.round(x + c * u), Math.round(y + r * u), Math.ceil(u), Math.ceil(u));
            }
        }
    }

    function drawEnemies() {
        const cam = game.camX;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const def = e.def;
            const sx = e.x - (def.sw - def.w) / 2 - cam;
            const sy = e.y - (def.sh - def.h);
            if (sx + def.sw < -40 || sx > VIEW_W + 40) continue;

            if (!e.alive) {
                ctx.globalAlpha = Math.max(0, e.dying / 18);
                ctx.save();
                ctx.translate(Math.round(sx + def.sw / 2), Math.round(sy + def.sh));
                ctx.scale(1 + (1 - e.dying / 18) * 0.6, Math.max(0.05, e.dying / 18));
                blit(SPR.enemy(def.frames[0], def.palette), -def.sw / 2, -def.sh, def.sw, def.sh, false);
                ctx.restore();
                ctx.globalAlpha = 1;
                continue;
            }

            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath();
            ctx.ellipse(Math.round(e.x + e.w / 2 - cam), GROUND_TOP + 2, e.w * 0.42, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            const frame = def.frames[Math.min(def.frames.length - 1, e.animFrame)];
            const sprite = SPR.enemy(frame, def.palette);
            blit(sprite, sx, sy, def.sw, def.sh, e.dir > 0);

            if (e.hitFlash > 0) {
                ctx.globalAlpha = e.hitFlash / 7 * 0.8;
                ctx.globalCompositeOperation = 'lighter';
                blit(sprite, sx, sy, def.sw, def.sh, e.dir > 0);
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
            }
            if (e.maxHp > 1 && e.hp < e.maxHp) {
                const w = def.sw - 8;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(Math.round(sx + 4), Math.round(sy - 8), w, 4);
                ctx.fillStyle = '#5eead4';
                ctx.fillRect(Math.round(sx + 4), Math.round(sy - 8), Math.round(w * (e.hp / e.maxHp)), 4);
            }
        }
    }

    function drawHazards() {
        const cam = game.camX;
        for (let i = 0; i < hazards.length; i++) {
            const h = hazards[i];
            const cx = Math.round(h.x + h.w / 2 - cam);
            const cy = Math.round(h.y + h.h / 2);
            if (cx < -60 || cx > VIEW_W + 60) continue;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(h.spin);
            const sprite = SPR.enemy('sawA', 'saw');
            ctx.drawImage(sprite, -18, -18, 36, 36);
            ctx.restore();
        }
    }

    function drawBolts() {
        const cam = game.camX;
        for (let i = 0; i < bolts.length; i++) {
            const b = bolts[i];
            const x = Math.round(b.x - cam);
            const y = Math.round(b.y);
            const h = Math.max(4, b.h);

            // Motion streak behind the bolt.
            const tail = Math.round(Math.min(26, Math.abs(b.vx) * 2.4));
            ctx.globalAlpha = 0.28;
            ctx.fillStyle = b.glow;
            if (b.vx >= 0) ctx.fillRect(x - tail, y + 1, tail, h - 2);
            else ctx.fillRect(x + b.w, y + 1, tail, h - 2);

            ctx.globalAlpha = 0.4;
            ctx.fillRect(x - 4, y - 4, b.w + 8, h + 8);
            ctx.globalAlpha = 1;

            ctx.fillStyle = '#0d0d16';
            ctx.fillRect(x - 1, y - 1, b.w + 2, h + 2);
            ctx.fillStyle = b.colour;
            ctx.fillRect(x, y, b.w, h);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x + (b.vx > 0 ? b.w - 4 : 0), y + 1, 4, h - 2);
        }
    }

    function drawBoss() {
        if (!boss) return;
        const cam = game.camX;
        const x = Math.round(boss.x - cam);
        const y = Math.round(boss.y);
        const cx = x + boss.w / 2;
        const cy = y + boss.h / 2;
        const charging = boss.phase === 'charge';
        const tele = boss.phase === 'telegraph';

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(cx, GROUND_TOP + 4, boss.w * 0.42, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        glowDisc(cx, cy, boss.w * 0.95, charging ? '#fb7185' : '#7c3aed', tele ? 0.7 : 0.35);

        // Rotating outer shards.
        ctx.save();
        ctx.translate(cx, cy);
        for (let i = 0; i < 6; i++) {
            const a = boss.spin * 2 + (i / 6) * Math.PI * 2;
            const r = boss.w * 0.62 + Math.sin(boss.wave * 2 + i) * 6;
            ctx.save();
            ctx.rotate(a);
            ctx.fillStyle = i % 2 ? '#312e57' : '#4c1d95';
            ctx.fillRect(r, -7, 26, 14);
            ctx.fillStyle = boss.hitFlash > 0 ? '#ffffff' : '#a78bfa';
            ctx.fillRect(r, -7, 26, 3);
            ctx.restore();
        }
        ctx.restore();

        // Core body.
        const bodyGrad = ctx.createLinearGradient(0, y, 0, y + boss.h);
        bodyGrad.addColorStop(0, '#2b2450');
        bodyGrad.addColorStop(1, '#140f2b');
        ctx.fillStyle = '#0d0d16';
        ctx.fillRect(x - 3, y - 3, boss.w + 6, boss.h + 6);
        ctx.fillStyle = boss.hitFlash > 0 ? '#ffffff' : bodyGrad;
        ctx.fillRect(x, y, boss.w, boss.h);

        // Panel lines.
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let ly = y + 10; ly < y + boss.h - 6; ly += 14) ctx.fillRect(x + 6, ly, boss.w - 12, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x, y + boss.h - 6, boss.w, 6);

        // Eye.
        const eyeW = 46;
        const eyeH = tele ? 26 : 18;
        const ex = cx - eyeW / 2;
        const ey = cy - eyeH / 2 - 6;
        ctx.fillStyle = '#0d0d16';
        ctx.fillRect(ex - 3, ey - 3, eyeW + 6, eyeH + 6);
        const eyeGrad = ctx.createLinearGradient(0, ey, 0, ey + eyeH);
        eyeGrad.addColorStop(0, charging || tele ? '#fecdd3' : '#c4b5fd');
        eyeGrad.addColorStop(1, charging || tele ? '#e11d48' : '#6d28d9');
        ctx.fillStyle = eyeGrad;
        ctx.fillRect(ex, ey, eyeW, eyeH);
        const pupil = Math.max(-12, Math.min(12, (player.x - boss.x) * 0.06));
        ctx.fillStyle = '#0d0d16';
        ctx.fillRect(Math.round(cx + pupil - 6), ey + 3, 12, eyeH - 6);

        // Mouth grill.
        ctx.fillStyle = '#0d0d16';
        ctx.fillRect(cx - 30, y + boss.h - 22, 60, 12);
        ctx.fillStyle = charging ? '#fb7185' : '#8b5cf6';
        for (let i = 0; i < 6; i++) ctx.fillRect(cx - 27 + i * 10, y + boss.h - 19, 6, 6);

        // Glitch bars.
        if (boss.hitFlash > 0 || tele) {
            for (let i = 0; i < 3; i++) {
                const gy = y + Math.random() * boss.h;
                ctx.fillStyle = 'rgba(94,234,212,0.6)';
                ctx.fillRect(x - 8 + Math.random() * 16, Math.round(gy), boss.w + 16, 3);
            }
        }
    }

    function drawGoal(theme) {
        if (!goal) return;
        const x = Math.round(goal.x - game.camX);
        if (x < -80 || x > VIEW_W + 80) return;
        const cy = goal.y;

        for (let i = 0; i < 3; i++) {
            const a = 0.12 + 0.1 * Math.sin(game.tick * 0.05 + i);
            ctx.globalAlpha = a;
            ctx.fillStyle = theme.accent;
            ctx.fillRect(x - 10 - i * 6, cy - 6, goal.w + 20 + i * 12, goal.h + 12);
            ctx.globalAlpha = 1;
        }
        const g = ctx.createLinearGradient(x, cy, x + goal.w, cy);
        g.addColorStop(0, 'rgba(255,255,255,0.25)');
        g.addColorStop(0.5, theme.accent);
        g.addColorStop(1, 'rgba(255,255,255,0.25)');
        ctx.fillStyle = g;
        ctx.fillRect(x, cy, goal.w, goal.h);

        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = 0; i < 8; i++) {
            const sy = cy + wrap(i * 30 - game.tick * 1.6, goal.h);
            ctx.fillRect(x + 4, Math.round(sy), goal.w - 8, 3);
        }
        ctx.fillStyle = '#0d0d16';
        ctx.fillRect(x - 6, cy - 14, goal.w + 12, 14);
        ctx.fillStyle = theme.accent;
        ctx.fillRect(x - 4, cy - 12, goal.w + 8, 10);
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#0d0d16';
        ctx.fillText('EXIT', x + goal.w / 2, cy - 5);
    }

    function drawPlayer() {
        if (player.invuln > 0 && !player.dead && (game.tick >> 2) % 2 === 0 && player.hurtTimer <= 0) return;
        const sprite = SPR.character(game.character, PLAYER_FRAMES[player.animFrame] || 'idle');
        const sx = player.x - 6 - game.camX;
        const sy = player.y - 4;

        if (!player.dead) {
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath();
            ctx.ellipse(Math.round(player.x + player.w / 2 - game.camX), GROUND_TOP + 2, 12, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // The night levels swallow a dark silhouette, so backlight it.
            const theme = game.theme;
            if (theme && theme.backdrop !== 'hills') {
                glowDisc(
                    Math.round(player.x + player.w / 2 - game.camX),
                    Math.round(player.y + player.h / 2),
                    34, theme.accent, 0.28
                );
            }
        }

        if (player.dead) {
            ctx.save();
            ctx.globalAlpha = Math.max(0.15, player.deadTimer / 96);
            ctx.translate(Math.round(player.x + player.w / 2 - game.camX), Math.round(player.y + player.h / 2));
            ctx.rotate((96 - player.deadTimer) * 0.06);
            ctx.drawImage(sprite, -16, -24, 32, 48);
            ctx.restore();
            ctx.globalAlpha = 1;
            return;
        }

        blit(sprite, sx, sy, 32, 48, player.facing < 0);

        if (player.weapon) drawHeldWeapon(sx, sy);
    }

    function drawHeldWeapon(sx, sy) {
        const w = WEAPONS[player.weapon];
        const flip = player.facing < 0;
        const gx = Math.round(flip ? sx + 2 : sx + 20);
        const gy = Math.round(sy + 24);
        ctx.fillStyle = '#0d0d16';
        ctx.fillRect(gx - 1, gy - 1, 13, 8);
        ctx.fillStyle = '#4b5468';
        ctx.fillRect(gx, gy, 11, 6);
        ctx.fillStyle = w.colour;
        ctx.fillRect(flip ? gx : gx + 8, gy + 1, 3, 4);
        if (player.muzzle > 0) {
            const mx = flip ? gx - 8 : gx + 11;
            glowDisc(mx + (flip ? 0 : 4), gy + 3, 14, w.glow, 0.8);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(mx, gy, 8, 6);
        }
    }

    function drawBits() {
        for (let i = 0; i < bits.length; i++) {
            const p = bits[i];
            const x = Math.round(p.x - game.camX);
            if (p.isRing) {
                ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.7;
                ctx.strokeStyle = p.colour;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x, Math.round(p.y), p.ringR, 0, Math.PI * 2);
                ctx.stroke();
                ctx.lineWidth = 1;
                ctx.globalAlpha = 1;
                continue;
            }
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
            ctx.fillStyle = p.colour;
            ctx.fillRect(x, Math.round(p.y), p.size, p.size);
            ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'center';
        ctx.font = '10px "Press Start 2P", monospace';
        for (let i = 0; i < floaters.length; i++) {
            const f = floaters[i];
            ctx.globalAlpha = Math.max(0, f.life / f.max);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText(f.text, Math.round(f.x - game.camX) + 1, Math.round(f.y) + 1);
            ctx.fillStyle = f.colour;
            ctx.fillText(f.text, Math.round(f.x - game.camX), Math.round(f.y));
            ctx.globalAlpha = 1;
        }
    }

    function drawMotes(theme) {
        if (!motes.length) return;
        ctx.fillStyle = theme.moteColour;
        for (let i = 0; i < motes.length; i++) {
            const m = motes[i];
            if (theme.motes === 'rain') {
                ctx.globalAlpha = 0.45;
                ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 9);
            } else {
                ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(m.ph));
                ctx.fillRect(Math.round(m.x), Math.round(m.y), m.s, m.s);
            }
        }
        ctx.globalAlpha = 1;
    }

    function drawVignette(theme) {
        ctx.fillStyle = theme.haze;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.36, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.42)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    function render() {
        ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
        ctx.imageSmoothingEnabled = false;

        const theme = game.theme || THEMES.grass;
        drawSky(theme);

        if (!game.level) return;

        const shakeX = game.shake ? (Math.random() - 0.5) * game.shake : 0;
        const shakeY = game.shake ? (Math.random() - 0.5) * game.shake : 0;
        ctx.save();
        ctx.translate(Math.round(shakeX), Math.round(shakeY));

        drawBackdrop(theme);
        drawUnderground(theme);
        drawGround(theme);
        drawSolids(theme);
        drawGoal(theme);
        drawBlocks(theme);
        drawCoins();
        drawHazards();
        drawEnemies();
        drawBoss();
        drawEmblems();
        drawBolts();
        drawPlayer();
        drawBits();
        drawMotes(theme);

        ctx.restore();

        drawVignette(theme);

        if (game.flash > 0) {
            ctx.fillStyle = 'rgba(255,255,255,' + (game.flash / 14 * 0.35).toFixed(3) + ')';
            ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        }
    }

    /* ================================== ui ================================== */

    const ui = (function () {
        const el = (id) => document.getElementById(id);

        const heartsEl = el('hudHearts');
        const scoreEl = el('hudScore');
        const weaponEl = el('hudWeapon');
        const ammoEl = el('hudAmmo');
        const ammoLabelEl = el('hudAmmoLabel');
        const levelEl = el('hudLevel');
        const linksEl = el('hudLinks');
        const bossBar = el('bossBar');
        const bossFill = el('bossFill');
        const bossName = el('bossName');
        const prompt = el('linkPrompt');
        const promptLink = el('linkPromptAnchor');
        const panels = {};
        ['title', 'paused', 'levelclear', 'gameover', 'victory', 'characters', 'help'].forEach((k) => {
            panels[k] = el('panel-' + k);
        });

        let pending = null;
        let promptTimer = null;
        let lastHud = '';

        function showPanel(name) {
            Object.keys(panels).forEach((k) => {
                if (!panels[k]) return;
                panels[k].hidden = k !== name;
            });
            const shell = el('stage');
            if (shell) shell.classList.toggle('has-panel', !!name);
            if (name === 'levelclear') {
                const next = DATA.LEVELS[game.levelIndex + 1];
                const t = el('clearNext');
                if (t) t.textContent = next ? next.name : '';
                const s = el('clearScore');
                if (s) s.textContent = game.score.toLocaleString();
            }
            if (name === 'victory' || name === 'gameover') {
                const s = el(name === 'victory' ? 'victoryScore' : 'gameoverScore');
                if (s) s.textContent = game.score.toLocaleString();
                const b = el(name === 'victory' ? 'victoryBest' : 'gameoverBest');
                if (b) b.textContent = game.best.toLocaleString();
            }
            if (name) {
                const focusable = panels[name] && panels[name].querySelector('button, a');
                if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 30);
            }
        }

        function heartMarkup(count, max) {
            let out = '';
            for (let i = 0; i < max; i++) {
                out += '<span class="heart' + (i < count ? '' : ' is-empty') + '" aria-hidden="true"></span>';
            }
            return out;
        }

        function syncHud(force) {
            const w = player.weapon ? WEAPONS[player.weapon] : null;
            const ammo = w ? player.ammo[player.weapon] : 0;
            const key = [player.hearts, game.score, player.weapon, ammo, game.levelIndex, game.unlocked.size].join('|');
            if (!force && key === lastHud) return;
            lastHud = key;

            if (heartsEl) {
                heartsEl.innerHTML = heartMarkup(player.hearts, Math.max(3, MAX_HEARTS));
                heartsEl.setAttribute('aria-label', player.hearts + ' health remaining');
            }
            if (scoreEl) scoreEl.textContent = game.score.toLocaleString();
            if (weaponEl) weaponEl.textContent = w ? w.name : 'UNARMED';
            if (weaponEl) weaponEl.dataset.weapon = player.weapon || 'none';
            if (ammoEl) ammoEl.textContent = !w ? '' : (ammo === Infinity ? '\u221E' : String(ammo));
            if (ammoLabelEl) ammoLabelEl.hidden = !w;
            if (linksEl) linksEl.textContent = game.unlocked.size + '/' + DATA.linkOrder.length;
        }

        function setLevel(def) {
            if (levelEl) levelEl.textContent = (game.levelIndex + 1) + '-' + def.name;
            const hint = el('levelHint');
            if (hint) hint.textContent = def.hint;
            setBoss(null);
        }

        function setBoss(b) {
            if (!bossBar) return;
            bossBar.hidden = !b;
            if (!b) return;
            bossName.textContent = b.name;
            bossFill.style.width = Math.max(0, (b.hp / b.maxHp) * 100) + '%';
        }

        function unlock(id, celebrate) {
            const link = LINKS[id];
            if (!link) return;
            game.unlocked.add(id);
            writeStore('links', JSON.stringify(Array.from(game.unlocked)));
            document.querySelectorAll('[data-link="' + id + '"]').forEach((node) => {
                node.classList.add('is-found');
            });
            syncHud(true);
            if (!celebrate) return;
            pending = link;
            if (prompt && promptLink) {
                promptLink.href = link.url;
                promptLink.textContent = 'Open ' + link.title;
                prompt.hidden = false;
                prompt.classList.remove('is-out');
                clearTimeout(promptTimer);
                promptTimer = setTimeout(() => {
                    prompt.classList.add('is-out');
                    setTimeout(() => { prompt.hidden = true; }, 400);
                }, 9000);
            }
        }

        function openPending() {
            if (!pending) return false;
            const url = pending.url;
            pending = null;
            if (prompt) { prompt.classList.add('is-out'); setTimeout(() => { prompt.hidden = true; }, 300); }
            global.open(url, '_blank', 'noopener');
            return true;
        }

        return { showPanel, syncHud, setLevel, setBoss, unlock, openPending };
    })();

    /* ================================= wiring =============================== */

    function toggleSound() {
        audio.enabled = !audio.enabled;
        const btn = document.getElementById('soundBtn');
        if (btn) {
            btn.setAttribute('aria-pressed', String(audio.enabled));
            btn.dataset.state = audio.enabled ? 'on' : 'off';
        }
        if (audio.enabled) audio.coin();
    }

    function bindClick(id, fn) {
        const node = document.getElementById(id);
        if (node) node.addEventListener('click', (e) => { e.preventDefault(); audio.unlock(); fn(); });
    }

    function buildLevelSelect() {
        const host = document.getElementById('levelSelect');
        if (!host) return;
        host.innerHTML = '';
        DATA.LEVELS.forEach((def, i) => {
            const locked = i > game.maxLevel;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'level-chip' + (locked ? ' is-locked' : '');
            btn.disabled = locked;
            btn.innerHTML = '<span class="level-chip__num">' + (i + 1) + '</span><span class="level-chip__name">' +
                def.name + '</span>';
            btn.addEventListener('click', () => { game.start(i); });
            host.appendChild(btn);
        });
    }

    function buildCharacterPicker() {
        const host = document.getElementById('characterGrid');
        if (!host) return;
        host.innerHTML = '';
        SPR.characterIds.forEach((id) => {
            const def = SPR.characters[id];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'char-card' + (id === game.character ? ' is-active' : '');
            btn.dataset.character = id;
            const c = document.createElement('canvas');
            c.width = 64;
            c.height = 96;
            c.className = 'char-card__art';
            const g = c.getContext('2d');
            g.imageSmoothingEnabled = false;
            g.drawImage(SPR.character(id, 'idle'), 0, 0, 64, 96);
            const label = document.createElement('span');
            label.className = 'char-card__name';
            label.textContent = def.name;
            btn.appendChild(c);
            btn.appendChild(label);
            btn.addEventListener('click', () => {
                game.character = id;
                writeStore('character', id);
                host.querySelectorAll('.char-card').forEach((n) => n.classList.toggle('is-active', n.dataset.character === id));
                audio.power();
            });
            host.appendChild(btn);
        });
    }

    function init() {
        // Reflect already-discovered links on the page.
        game.unlocked.forEach((id) => {
            document.querySelectorAll('[data-link="' + id + '"]').forEach((n) => n.classList.add('is-found'));
        });

        buildCharacterPicker();
        buildLevelSelect();

        const soundBtn = document.getElementById('soundBtn');
        if (soundBtn) {
            soundBtn.setAttribute('aria-pressed', String(audio.enabled));
            soundBtn.dataset.state = audio.enabled ? 'on' : 'off';
            soundBtn.addEventListener('click', toggleSound);
        }

        bindClick('startBtn', () => { buildLevelSelect(); game.start(0); });

        const heroPlay = document.getElementById('heroPlayBtn');
        if (heroPlay) {
            heroPlay.addEventListener('click', (e) => {
                e.preventDefault();
                audio.unlock();
                if (stage) stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                buildLevelSelect();
                if (game.state === 'title' || game.state === 'gameover') game.start(0);
                else if (game.state === 'paused') game.resume();
            });
        }
        bindClick('titleCharBtn', () => ui.showPanel('characters'));
        bindClick('titleHelpBtn', () => ui.showPanel('help'));
        bindClick('charDoneBtn', () => ui.showPanel(game.state === 'playing' ? null : 'title'));
        bindClick('helpDoneBtn', () => ui.showPanel(game.state === 'playing' ? null : 'title'));
        bindClick('resumeBtn', () => game.resume());
        bindClick('pauseRestartBtn', () => game.restartLevel());
        bindClick('pauseCharBtn', () => ui.showPanel('characters'));
        bindClick('pauseQuitBtn', () => { game.state = 'title'; ui.showPanel('title'); buildLevelSelect(); });
        bindClick('nextLevelBtn', () => loadLevel(game.levelIndex + 1, false));
        bindClick('retryBtn', () => game.restartLevel());
        bindClick('gameoverTitleBtn', () => { game.state = 'title'; ui.showPanel('title'); buildLevelSelect(); });
        bindClick('victoryTitleBtn', () => { game.state = 'title'; ui.showPanel('title'); buildLevelSelect(); });
        bindClick('victoryReplayBtn', () => game.start(0));
        bindClick('pauseBtn', () => {
            if (game.state === 'playing') game.pause();
            else if (game.state === 'paused') game.resume();
        });

        bindHold(document.getElementById('padLeft'), 'left');
        bindHold(document.getElementById('padRight'), 'right');
        bindHold(document.getElementById('padJump'), 'jump');
        bindHold(document.getElementById('padFire'), 'fire');
        const padSwap = document.getElementById('padSwap');
        if (padSwap) padSwap.addEventListener('click', (e) => { e.preventDefault(); cycleWeapon(); });

        function markTouch() {
            document.body.classList.add('has-touch');
            resizeCanvas();
        }
        if (navigator.maxTouchPoints > 0 || 'ontouchstart' in global) markTouch();
        global.addEventListener('touchstart', markTouch, { once: true, passive: true });

        canvas.addEventListener('pointerdown', (e) => {
            audio.unlock();
            if (e.pointerType === 'touch') markTouch();
            if (game.state === 'title') game.start(0);
        });

        global.addEventListener('resize', resizeCanvas, { passive: true });
        global.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));
        if ('ResizeObserver' in global && stageWrap) {
            new ResizeObserver(resizeCanvas).observe(stageWrap);
        }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && game.state === 'playing') game.pause();
        });

        if ('IntersectionObserver' in global && stage) {
            const obs = new IntersectionObserver((entries) => {
                entries.forEach((entry) => { game.inView = entry.isIntersecting; });
            }, { threshold: 0.25 });
            obs.observe(stage);
        }

        // Attract mode behind the title card.
        loadLevel(0, true);
        game.state = 'title';
        ui.showPanel('title');
        resizeCanvas();
    }

    /* ================================== loop ================================ */

    let last = performance.now();
    let acc = 0;

    function frame(now) {
        let dt = now - last;
        last = now;
        if (dt > 250) dt = 250;
        acc += dt;
        let guard = 0;
        while (acc >= STEP_MS && guard < 6) {
            step();
            acc -= STEP_MS;
            guard += 1;
        }
        if (guard >= 6) acc = 0;
        render();
        requestAnimationFrame(frame);
    }

    function boot() {
        init();
        requestAnimationFrame(frame);
    }

    if (document.fonts && document.fonts.load) {
        Promise.race([
            document.fonts.load('10px "Press Start 2P"'),
            new Promise((r) => setTimeout(r, 1200))
        ]).then(boot, boot);
    } else {
        boot();
    }

    AMO.game = game;
    AMO.debug = {
        player: player,
        warp(x) {
            player.x = x;
            player.y = GROUND_TOP - PLAYER_H - 40;
            player.vx = 0;
            player.vy = 0;
            player.safeX = x;
            player.safeY = player.y;
            game.camX = Math.max(0, Math.min(game.level.width - VIEW_W, x - VIEW_W / 2));
        },
        arm(id) { giveWeapon(id); },
        get boss() { return boss; }
    };
})(window);
