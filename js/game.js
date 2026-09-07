(() => {
    'use strict';

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const GAME_W = 1000;
    const GAME_H = 500;
    const GRAVITY = 0.58;
    const JUMP_FORCE = -14.8;
    const MOVE_SPEED = 5.1;
    const MAX_FALL = 13;
    const GROUND_HEIGHT = 100;
    const COYOTE_FRAMES = 6;
    const JUMP_BUFFER = 8;

    const COLORS = {
        white: '#ffffff',
        black: '#000000',
        coin: '#ffdc00',
        marioRed: '#e52521',
        marioBlue: '#049cd8',
        marioSkin: '#ffb8a0',
        marioBrown: '#6b4423',
        ashBlack: '#1a1a1a',
        ashDarkGrey: '#333333',
        ashSkin: '#ffb8a0',
        ashBrown: '#5c3d2e',
        ashShoe: '#222222',
        maggiePurple: '#8b5cf6',
        maggiePurpleDark: '#6d28d9',
        maggieBlack: '#1a1a1a',
        maggieSkin: '#ffcdb8',
        maggieBlonde: '#f5d742',
        maggieBlondeDark: '#d4a830',
        brick: '#c84c0c',
        brickDark: '#a03800',
        brickLight: '#e8a060',
        q: '#ffa500',
        qDark: '#c87800',
        qLight: '#ffdc00',
        pipe: '#00a800',
        pipeDark: '#007000',
        pipeLight: '#3ce03c',
        crawler: '#8b5428',
        crawlerDark: '#5c3310',
        crawlerLight: '#c08048',
        drone: '#5a5a72',
        droneEye: '#ff4d6d',
        spike: '#3d3d4a',
        grass: '#1fbf3a',
        grassDark: '#148028',
        dirt: '#c84c0c',
        dirtDark: '#8a3408'
    };

    const LINKS = [
        { id: 'linkedin', url: 'https://www.linkedin.com/in/ashleymoran', label: 'in', name: 'LinkedIn' },
        { id: 'twitter', url: 'https://x.com/amoranio', label: 'X', name: 'X' },
        { id: 'github', url: 'https://github.com/amoranio', label: '<>', name: 'GitHub' },
        { id: 'exnoscan', url: 'https://exnoscan.com', label: 'EX', name: 'Exnoscan' },
        { id: 'clearqr', url: 'https://clearqr.exnoscan.com', label: 'QR', name: 'ClearQR' },
        { id: 'badmcp', url: 'https://amoranio.github.io/badMCP', label: 'bd', name: 'badMCP' }
    ];

    const overlays = {
        title: document.getElementById('titleOverlay'),
        character: document.getElementById('characterOverlay'),
        sites: document.getElementById('sitesOverlay'),
        pause: document.getElementById('pauseOverlay'),
        over: document.getElementById('overOverlay')
    };

    const worldChip = document.getElementById('worldChip');

    function anyOverlayOpen() {
        return Object.values(overlays).some((el) => el.classList.contains('active'));
    }

    const audio = {
        ctx: null,
        muted: localStorage.getItem('amoran-mute') === '1',
        ensure() {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (AC) this.ctx = new AC();
            }
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        },
        beep(freq, dur, type, vol) {
            if (this.muted || !this.ctx) return;
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = type || 'square';
            o.frequency.value = freq;
            g.gain.value = vol || 0.05;
            g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
            o.connect(g);
            g.connect(this.ctx.destination);
            o.start();
            o.stop(this.ctx.currentTime + dur);
        },
        jump() { this.beep(420, 0.12, 'square', 0.05); },
        stomp() { this.beep(180, 0.14, 'triangle', 0.07); },
        shoot() { this.beep(760, 0.08, 'square', 0.045); },
        hit() { this.beep(520, 0.16, 'square', 0.06); this.beep(880, 0.1, 'square', 0.04); },
        hurt() { this.beep(140, 0.22, 'sawtooth', 0.06); },
        coin() { this.beep(980, 0.08, 'square', 0.045); this.beep(1320, 0.12, 'square', 0.035); },
        pickup() { this.beep(600, 0.1, 'square', 0.05); this.beep(900, 0.16, 'square', 0.05); },
        flag() { this.beep(523, 0.12, 'square', 0.05); this.beep(659, 0.12, 'square', 0.05); this.beep(784, 0.22, 'square', 0.06); },
        death() { this.beep(200, 0.35, 'sawtooth', 0.07); }
    };

    function syncMuteUI() {
        const check = document.getElementById('muteCheck');
        if (check) check.checked = audio.muted;
        const icon = document.getElementById('muteIcon');
        if (icon) {
            icon.innerHTML = audio.muted
                ? '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>'
                : '<path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
        }
        localStorage.setItem('amoran-mute', audio.muted ? '1' : '0');
    }

    const keys = { left: false, right: false, jump: false, fire: false };
    let jumpPressed = false;
    let firePressed = false;
    let jumpBuffer = 0;

    const player = {
        x: 80,
        y: GAME_H - GROUND_HEIGHT - 48,
        width: 32,
        height: 48,
        vx: 0,
        vy: 0,
        onGround: true,
        facing: 1,
        frame: 0,
        frameTimer: 0,
        coyote: 0,
        invuln: 0,
        deadTimer: 0
    };

    let cameraX = 0;
    let currentCharacter = localStorage.getItem('amoran-char') || 'mario';
    let lives = 3;
    let coins = 0;
    let hasWeapon = false;
    let fireCooldown = 0;
    let levelIndex = 0;
    let started = false;
    let tick = 0;
    let shake = 0;
    let banner = null;
    let notification = null;
    let particles = [];
    let projectiles = [];
    let enemies = [];
    let coinsWorld = [];
    let pickups = [];
    let blocks = [];
    let bricks = [];
    let pipes = [];
    let movers = [];
    let pits = [];
    let clouds = [];
    let hills = [];
    let bushes = [];
    let worldWidth = 1800;
    let flagX = 1600;
    let levelName = '';
    let skyTop = '#3a6ee8';
    let skyBot = '#8ec8ff';
    let spawnX = 80;
    let levelLocked = false;

    function linkById(id) {
        return LINKS.find((l) => l.id === id);
    }

    function makeBlock(x, y, id) {
        const link = linkById(id);
        return {
            x, y, width: 48, height: 48, hit: false, bobY: 0, hitTimer: 0,
            id, label: link.label, name: link.name, url: link.url
        };
    }

    function makeBrick(x, y) {
        return { x, y, width: 48, height: 48 };
    }

    function makePipe(x, h) {
        return { x, y: GAME_H - GROUND_HEIGHT - h, width: 56, height: h, solid: true };
    }

    const LEVELS = [
        {
            name: 'PORTFOLIO PLAINS',
            chip: 'WORLD 1-1',
            width: 2700,
            skyTop: '#3a6ee8',
            skyBot: '#9ad4ff',
            flagX: 2480,
            pits: [],
            clouds: [
                { x: 120, y: 58, size: 1.2 }, { x: 430, y: 86, size: 1 }, { x: 760, y: 48, size: 1.4 },
                { x: 1100, y: 92, size: 0.9 }, { x: 1450, y: 64, size: 1.15 }, { x: 1880, y: 80, size: 1.3 },
                { x: 2300, y: 52, size: 1 }
            ],
            hills: [
                { x: 40, w: 220, h: 110 }, { x: 520, w: 250, h: 84 }, { x: 980, w: 180, h: 58 },
                { x: 1400, w: 230, h: 96 }, { x: 1900, w: 200, h: 72 }, { x: 2360, w: 170, h: 60 }
            ],
            bushes: [
                { x: 150, y: 38, r1: 18, r2: 12, off: 48 },
                { x: 680, y: 32, r1: 15, r2: 10, off: 54 },
                { x: 1520, y: 42, r1: 16, r2: 11, off: 50 },
                { x: 2100, y: 30, r1: 14, r2: 10, off: 46 }
            ],
            bricks: [152, 400, 448, 648, 696, 896, 944, 1144, 1192, 1392, 1640, 1688, 1980, 2028].map((x) => makeBrick(x, 220)),
            extraBricks: [makeBrick(560, 140), makeBrick(608, 140)],
            pipes: [makePipe(1750, 72)],
            blocks: [
                makeBlock(200, 220, 'linkedin'),
                makeBlock(496, 220, 'twitter'),
                makeBlock(744, 220, 'github'),
                makeBlock(992, 220, 'exnoscan'),
                makeBlock(1240, 220, 'clearqr'),
                makeBlock(1488, 220, 'badmcp')
            ],
            enemies: [
                { type: 'crawler', x: 640, y: 0, minX: 560, maxX: 760 },
                { type: 'crawler', x: 1080, y: 0, minX: 980, maxX: 1220 },
                { type: 'crawler', x: 1680, y: 0, minX: 1580, maxX: 1820 },
                { type: 'crawler', x: 2140, y: 0, minX: 2040, maxX: 2300 }
            ],
            pickups: [{ type: 'weapon', x: 584, y: 100 }],
            coins: [
                { x: 570, y: 100 }, { x: 600, y: 88 }, { x: 630, y: 100 },
                { x: 1768, y: 280 }, { x: 1880, y: 300 }, { x: 2200, y: 300 }
            ],
            movers: []
        },
        {
            name: 'PRODUCT RIDGE',
            chip: 'WORLD 1-2',
            width: 3100,
            skyTop: '#2d5ad8',
            skyBot: '#7ec0f8',
            flagX: 2880,
            pits: [{ x: 980, w: 170 }, { x: 1980, w: 210 }],
            clouds: [
                { x: 80, y: 50, size: 1.1 }, { x: 500, y: 78, size: 1.3 }, { x: 980, y: 44, size: 1 },
                { x: 1500, y: 90, size: 1.2 }, { x: 2100, y: 60, size: 1.4 }, { x: 2700, y: 72, size: 1 }
            ],
            hills: [
                { x: 20, w: 200, h: 90 }, { x: 600, w: 180, h: 70 }, { x: 1300, w: 240, h: 100 },
                { x: 2200, w: 210, h: 80 }, { x: 2800, w: 160, h: 64 }
            ],
            bushes: [
                { x: 220, y: 36, r1: 16, r2: 11, off: 44 },
                { x: 1600, y: 40, r1: 15, r2: 10, off: 50 },
                { x: 2500, y: 28, r1: 14, r2: 10, off: 42 }
            ],
            bricks: [
                makeBrick(300, 220), makeBrick(348, 220), makeBrick(396, 220),
                makeBrick(700, 180), makeBrick(748, 180),
                makeBrick(1280, 200), makeBrick(1328, 200), makeBrick(1376, 200),
                makeBrick(1680, 150), makeBrick(1728, 150),
                makeBrick(2300, 220), makeBrick(2348, 220)
            ],
            extraBricks: [],
            pipes: [makePipe(620, 88), makePipe(1540, 104), makePipe(2480, 72)],
            blocks: [
                makeBlock(348, 120, 'linkedin'),
                makeBlock(748, 80, 'twitter'),
                makeBlock(1328, 100, 'github'),
                makeBlock(1728, 50, 'exnoscan'),
                makeBlock(2348, 120, 'clearqr'),
                makeBlock(2640, 220, 'badmcp')
            ],
            enemies: [
                { type: 'crawler', x: 250, y: 0 },
                { type: 'crawler', x: 540, y: 0 },
                { type: 'drone', x: 860, y: 210 },
                { type: 'crawler', x: 1200, y: 0 },
                { type: 'drone', x: 1450, y: 160 },
                { type: 'crawler', x: 1800, y: 0 },
                { type: 'drone', x: 2150, y: 180 },
                { type: 'crawler', x: 2580, y: 0 }
            ],
            pickups: [{ type: 'weapon', x: 724, y: 140 }],
            coins: [
                { x: 320, y: 180 }, { x: 360, y: 180 }, { x: 1040, y: 240 },
                { x: 1700, y: 110 }, { x: 2080, y: 240 }, { x: 2500, y: 250 }
            ],
            movers: [{ x: 1000, y: 280, w: 96, h: 20, minX: 980, maxX: 1120, speed: 1.4, dir: 1 }]
        },
        {
            name: 'PROTOCOL PEAK',
            chip: 'WORLD 1-3',
            width: 3400,
            skyTop: '#1e3fa8',
            skyBot: '#6aa8e8',
            flagX: 3180,
            pits: [{ x: 760, w: 190 }, { x: 1680, w: 220 }, { x: 2500, w: 180 }],
            clouds: [
                { x: 100, y: 44, size: 1.3 }, { x: 620, y: 80, size: 1 }, { x: 1200, y: 52, size: 1.4 },
                { x: 1860, y: 88, size: 1.1 }, { x: 2460, y: 60, size: 1.2 }, { x: 3000, y: 70, size: 1 }
            ],
            hills: [
                { x: 30, w: 190, h: 80 }, { x: 500, w: 160, h: 60 }, { x: 1100, w: 220, h: 95 },
                { x: 2000, w: 200, h: 75 }, { x: 2900, w: 180, h: 88 }
            ],
            bushes: [
                { x: 180, y: 34, r1: 15, r2: 10, off: 40 },
                { x: 1400, y: 38, r1: 16, r2: 11, off: 48 },
                { x: 2800, y: 30, r1: 14, r2: 10, off: 44 }
            ],
            bricks: [
                makeBrick(280, 210), makeBrick(328, 210),
                makeBrick(900, 170), makeBrick(948, 170), makeBrick(996, 170),
                makeBrick(1280, 120), makeBrick(1328, 120),
                makeBrick(1960, 180), makeBrick(2008, 180),
                makeBrick(2280, 140), makeBrick(2328, 140),
                makeBrick(2760, 200), makeBrick(2808, 200)
            ],
            extraBricks: [makeBrick(480, 140), makeBrick(528, 140)],
            pipes: [makePipe(420, 96), makePipe(1480, 112), makePipe(2380, 88)],
            blocks: [
                makeBlock(328, 110, 'linkedin'),
                makeBlock(504, 40, 'twitter'),
                makeBlock(948, 70, 'github'),
                makeBlock(1328, 20, 'exnoscan'),
                makeBlock(2008, 80, 'clearqr'),
                makeBlock(2808, 100, 'badmcp')
            ],
            enemies: [
                { type: 'crawler', x: 220, y: 0 },
                { type: 'spike', x: 600, y: 0 },
                { type: 'drone', x: 840, y: 150 },
                { type: 'crawler', x: 1150, y: 0 },
                { type: 'drone', x: 1500, y: 140 },
                { type: 'spike', x: 1900, y: 0 },
                { type: 'drone', x: 2200, y: 160 },
                { type: 'crawler', x: 2680, y: 0 },
                { type: 'brute', x: 3000, y: 0 }
            ],
            pickups: [{ type: 'weapon', x: 504, y: 100 }],
            coins: [
                { x: 300, y: 170 }, { x: 500, y: 100 }, { x: 930, y: 130 },
                { x: 1760, y: 220 }, { x: 2300, y: 100 }, { x: 2900, y: 260 }
            ],
            movers: [
                { x: 780, y: 260, w: 88, h: 20, minX: 760, maxX: 930, speed: 1.6, dir: 1 },
                { x: 1720, y: 250, w: 96, h: 20, minX: 1680, maxX: 1880, speed: 1.8, dir: 1 }
            ]
        }
    ];

    function enemyStats(type) {
        if (type === 'drone') return { w: 32, h: 24, hp: 1, stompable: true };
        if (type === 'spike') return { w: 32, h: 28, hp: 1, stompable: false };
        if (type === 'brute') return { w: 48, h: 40, hp: 3, stompable: true };
        return { w: 32, h: 28, hp: 1, stompable: true };
    }

    function loadLevel(index) {
        const def = LEVELS[index];
        levelIndex = index;
        levelName = def.name;
        worldWidth = def.width;
        flagX = def.flagX;
        skyTop = def.skyTop;
        skyBot = def.skyBot;
        pits = def.pits.map((p) => ({ ...p }));
        clouds = def.clouds.map((c) => ({ ...c }));
        hills = def.hills.map((h) => ({ ...h }));
        bushes = def.bushes.map((b) => ({ ...b }));
        bricks = [...def.bricks, ...(def.extraBricks || [])].map((b) => ({ ...b }));
        pipes = def.pipes.map((p) => ({ ...p }));
        blocks = def.blocks.map((b) => ({ ...b, hit: false, bobY: 0 }));
        movers = def.movers.map((m) => ({ ...m }));
        pickups = def.pickups.map((p) => ({ ...p, taken: false }));
        coinsWorld = def.coins.map((c) => ({ ...c, taken: false, bob: Math.random() * Math.PI * 2 }));
        projectiles = [];
        particles = [];
        notification = null;
        enemies = def.enemies.map((e) => {
            const s = enemyStats(e.type);
            const grounded = e.type !== 'drone';
            return {
                type: e.type,
                x: e.x,
                y: grounded ? GAME_H - GROUND_HEIGHT - s.h : e.y,
                w: s.w,
                h: s.h,
                hp: s.hp,
                stompable: s.stompable,
                vx: e.type === 'drone' ? 1.4 : (e.type === 'brute' ? 1.05 : 1.15),
                facing: 1,
                minX: Math.max(e.minX != null ? e.minX : e.x - 90, 40),
                maxX: e.maxX != null ? e.maxX : e.x + 120,
                frame: 0,
                t: Math.random() * 100,
                alive: true,
                squash: 0,
                flash: 0,
                baseY: e.y || 180
            };
        });
        spawnX = 80;
        player.x = spawnX;
        player.y = GAME_H - GROUND_HEIGHT - player.height;
        player.vx = 0;
        player.vy = 0;
        player.onGround = true;
        player.invuln = 90;
        player.deadTimer = 0;
        cameraX = 0;
        fireCooldown = 0;
        levelLocked = false;
        if (worldChip) worldChip.textContent = def.chip;
    }

    function showBanner(text, timer) {
        banner = { text, timer, y: -40 };
    }

    function inPit(x, w) {
        const mid = x + w * 0.5;
        return pits.some((p) => mid > p.x && mid < p.x + p.w);
    }

    function burst(x, y, color, n, speed) {
        for (let i = 0; i < n; i++) {
            particles.push({
                x: x + Math.random() * 20 - 10,
                y: y,
                vx: (Math.random() - 0.5) * (speed || 7),
                vy: -Math.random() * (speed || 7) - 2,
                life: 22 + Math.random() * 14,
                max: 36,
                color,
                size: 4 + Math.random() * 4
            });
        }
    }

    function openLink(name, url) {
        notification = { text: name, link: url, timer: 70, y: -50 };
        audio.hit();
    }

    function activateBlock(block) {
        if (block.hit) return;
        block.hit = true;
        block.bobY = -14;
        block.hitTimer = 0;
        burst(block.x + 24, block.y, COLORS.coin, 10, 8);
        coins += 1;
        audio.coin();
        openLink(block.name, block.url);
    }

    function fireWeapon() {
        if (!hasWeapon || fireCooldown > 0 || player.deadTimer > 0) return;
        fireCooldown = 14;
        projectiles.push({
            x: player.x + (player.facing === 1 ? player.width : -12),
            y: player.y + 18,
            vx: 9 * player.facing,
            vy: 0,
            life: 55,
            spin: 0
        });
        audio.shoot();
    }

    function hurtPlayer(fromX) {
        if (player.invuln > 0 || player.deadTimer > 0) return;
        lives -= 1;
        player.invuln = 90;
        player.vy = -8;
        player.vx = fromX < player.x ? 5 : -5;
        player.onGround = false;
        shake = 10;
        audio.hurt();
        burst(player.x + 16, player.y + 20, '#ff6b6b', 8, 6);
        if (lives <= 0) {
            player.deadTimer = 50;
            audio.death();
        }
    }

    function killEnemy(e, stomp) {
        e.alive = false;
        e.squash = stomp ? 16 : 10;
        coins += e.type === 'brute' ? 5 : 1;
        burst(e.x + e.w / 2, e.y + e.h / 2, e.type === 'drone' ? '#ff8aa0' : COLORS.crawlerLight, 12, 8);
        audio.stomp();
        if (Math.random() < 0.4) {
            coinsWorld.push({ x: e.x + 8, y: e.y - 8, taken: false, bob: 0, pop: true });
        }
    }

    function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function solids() {
        return [
            ...pipes,
            ...movers.map((m) => ({ x: m.x, y: m.y, width: m.w, height: m.h, solid: true }))
        ];
    }

    function platforms() {
        return [
            ...blocks.map((b) => ({ x: b.x, y: b.y + b.bobY, width: b.width, height: b.height })),
            ...bricks
        ];
    }

    function resolveSolids() {
        const list = solids();
        for (const s of list) {
            if (!aabb(player.x, player.y, player.width, player.height, s.x, s.y, s.width || s.w, s.height || s.h)) continue;
            const sw = s.width || s.w;
            const sh = s.height || s.h;
            const overlapX = Math.min(player.x + player.width - s.x, s.x + sw - player.x);
            const overlapY = Math.min(player.y + player.height - s.y, s.y + sh - player.y);
            if (overlapX < overlapY) {
                if (player.x + player.width / 2 < s.x + sw / 2) player.x = s.x - player.width;
                else player.x = s.x + sw;
                player.vx = 0;
            } else if (player.y + player.height / 2 < s.y + sh / 2) {
                player.y = s.y - player.height;
                player.vy = 0;
                player.onGround = true;
            } else {
                player.y = s.y + sh;
                player.vy = Math.abs(player.vy) * 0.2;
            }
        }
    }

    function updateEnemies() {
        for (const e of enemies) {
            if (!e.alive) {
                if (e.squash > 0) e.squash--;
                continue;
            }
            e.t++;
            e.frame = ((e.t / 10) | 0) % 2;
            if (e.flash > 0) e.flash--;

            if (e.type === 'drone') {
                e.x += e.vx * e.facing;
                e.y = e.baseY + Math.sin(e.t / 18) * 28;
                if (e.x < 40 || e.x > worldWidth - 60) e.facing *= -1;
            } else {
                const next = e.x + e.vx * e.facing;
                const ledge = inPit(next, e.w);
                const wall = pipes.some((p) => aabb(next, e.y, e.w, e.h, p.x, p.y, p.width, p.height));
                if (ledge || wall || next < e.minX || next + e.w > e.maxX) e.facing *= -1;
                else e.x = next;
                e.y = GAME_H - GROUND_HEIGHT - e.h;
                if (inPit(e.x, e.w)) e.facing *= -1;
            }

            if (player.deadTimer > 0) continue;
            if (!aabb(player.x, player.y, player.width, player.height, e.x, e.y, e.w, e.h)) continue;

            const stomp = player.vy > 0.4 && (player.y + player.height) <= e.y + Math.max(20, e.h * 0.62);
            if (stomp && e.stompable) {
                e.hp -= 1;
                player.vy = -10.5;
                player.y = e.y - player.height - 2;
                player.invuln = Math.max(player.invuln, 18);
                shake = 6;
                if (e.hp <= 0) killEnemy(e, true);
                else {
                    e.flash = 12;
                    audio.stomp();
                }
            } else {
                hurtPlayer(e.x);
            }
        }
    }

    function updateProjectiles() {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            p.x += p.vx;
            p.spin += 0.4;
            p.life--;
            if (p.life <= 0 || p.x < cameraX - 40 || p.x > cameraX + GAME_W + 40) {
                projectiles.splice(i, 1);
                continue;
            }
            let used = false;
            for (const block of blocks) {
                if (!block.hit && aabb(p.x, p.y, 12, 12, block.x, block.y + block.bobY, block.width, block.height)) {
                    activateBlock(block);
                    used = true;
                    break;
                }
            }
            if (!used) {
                for (const e of enemies) {
                    if (!e.alive) continue;
                    if (aabb(p.x, p.y, 12, 12, e.x, e.y, e.w, e.h)) {
                        e.hp -= 1;
                        e.flash = 10;
                        burst(p.x, p.y, COLORS.coin, 6, 5);
                        if (e.hp <= 0) killEnemy(e, false);
                        else audio.stomp();
                        used = true;
                        break;
                    }
                }
            }
            if (used) projectiles.splice(i, 1);
        }
    }

    function update() {
        if (!started || anyOverlayOpen()) return;
        tick++;
        if (shake > 0) shake--;
        if (fireCooldown > 0) fireCooldown--;
        if (player.invuln > 0) player.invuln--;
        if (jumpBuffer > 0) jumpBuffer--;

        if (player.deadTimer > 0) {
            player.deadTimer--;
            player.vy += GRAVITY;
            player.y += player.vy;
            if (player.deadTimer <= 0) {
                overlays.over.classList.add('active');
                document.getElementById('overTitle').textContent = 'GAME OVER';
                document.getElementById('overSub').textContent = 'The crawlers got you. Continue this world?';
            }
            updateParticles();
            return;
        }

        if (keys.left) {
            player.vx = -MOVE_SPEED;
            player.facing = -1;
        } else if (keys.right) {
            player.vx = MOVE_SPEED;
            player.facing = 1;
        } else {
            player.vx *= 0.78;
            if (Math.abs(player.vx) < 0.2) player.vx = 0;
        }

        if (player.onGround && Math.abs(player.vx) > 1.5 && tick % 5 === 0) {
            particles.push({
                x: player.x + 10,
                y: player.y + player.height - 4,
                vx: -player.facing * 0.8,
                vy: -1.2,
                life: 12,
                max: 12,
                color: '#c08048',
                size: 3
            });
        }

        if (Math.abs(player.vx) > 0.5 && player.onGround) {
            player.frameTimer++;
            if (player.frameTimer > 7) {
                player.frameTimer = 0;
                player.frame = (player.frame + 1) % 2;
            }
        } else player.frame = 0;

        if (keys.jump) {
            if (!jumpPressed) jumpBuffer = JUMP_BUFFER;
            jumpPressed = true;
        } else {
            jumpPressed = false;
            if (player.vy < -5) player.vy *= 0.55;
        }

        if (keys.fire) fireWeapon();
        firePressed = keys.fire;

        if (player.onGround) player.coyote = COYOTE_FRAMES;
        else if (player.coyote > 0) player.coyote--;

        if (jumpBuffer > 0 && player.coyote > 0) {
            player.vy = JUMP_FORCE;
            player.onGround = false;
            player.coyote = 0;
            jumpBuffer = 0;
            audio.jump();
        }

        player.vy = Math.min(MAX_FALL, player.vy + GRAVITY);
        player.x += player.vx;
        player.y += player.vy;
        player.onGround = false;

        if (player.x < 0) player.x = 0;
        if (player.x > worldWidth - player.width) player.x = worldWidth - player.width;

        const groundY = GAME_H - GROUND_HEIGHT - player.height;
        if (!inPit(player.x, player.width) && player.y >= groundY) {
            player.y = groundY;
            player.vy = 0;
            player.onGround = true;
        }

        if (player.y > GAME_H + 40) {
            lives -= 1;
            shake = 12;
            audio.death();
            if (lives <= 0) {
                player.deadTimer = 1;
            } else {
                player.x = spawnX;
                player.y = groundY;
                player.vx = 0;
                player.vy = 0;
                player.invuln = 80;
                showBanner('TRY AGAIN', 70);
            }
        }

        resolveSolids();

        for (const m of movers) {
            m.x += m.speed * m.dir;
            if (m.x < m.minX || m.x + m.w > m.maxX) m.dir *= -1;
            if (player.onGround && aabb(player.x, player.y + 1, player.width, player.height, m.x, m.y, m.w, m.h)) {
                player.x += m.speed * m.dir;
            }
        }

        for (const block of blocks) {
            if (block.bobY < 0) {
                block.bobY += 1.6;
                if (block.bobY > 0) block.bobY = 0;
            }
            if (block.hit) {
                block.hitTimer = (block.hitTimer || 0) + 1;
                if (block.hitTimer > 900) {
                    block.hit = false;
                    block.hitTimer = 0;
                }
                continue;
            }
            const top = player.y;
            const bottom = block.y + block.bobY + block.height;
            const bTop = block.y + block.bobY;
            if (player.vy < 0 &&
                top <= bottom &&
                top >= bTop &&
                player.x + player.width > block.x + 6 &&
                player.x < block.x + block.width - 6) {
                activateBlock(block);
                player.vy = Math.abs(player.vy) * 0.28;
                player.y = bottom + 1;
            }
        }

        for (const plat of platforms()) {
            if (player.vy >= 0 &&
                player.y + player.height >= plat.y &&
                player.y + player.height <= plat.y + 16 &&
                player.x + player.width > plat.x + 4 &&
                player.x < plat.x + plat.width - 4) {
                player.y = plat.y - player.height;
                player.vy = 0;
                player.onGround = true;
            }
        }

        for (const p of pickups) {
            if (p.taken) continue;
            if (aabb(player.x, player.y, player.width, player.height, p.x, p.y, 28, 28)) {
                p.taken = true;
                hasWeapon = true;
                audio.pickup();
                showBanner('PULSE STAR GET', 90);
                burst(p.x + 14, p.y + 14, COLORS.coin, 14, 8);
            }
        }

        for (const c of coinsWorld) {
            c.bob += 0.12;
            if (c.taken) continue;
            if (aabb(player.x, player.y, player.width, player.height, c.x, c.y + Math.sin(c.bob) * 4, 16, 16)) {
                c.taken = true;
                coins += 1;
                audio.coin();
            }
        }

        if (!levelLocked && player.x + player.width > flagX && player.y < GAME_H - 40) {
            levelLocked = true;
            audio.flag();
            shake = 8;
            if (levelIndex < LEVELS.length - 1) {
                overlays.over.classList.add('active');
                document.getElementById('overTitle').textContent = 'WORLD CLEAR';
                document.getElementById('overSub').textContent = LEVELS[levelIndex + 1].name + ' is next. Keep the pulse star.';
                document.getElementById('continueBtn').textContent = 'NEXT WORLD';
                banner = { text: 'CLEAR', timer: 999, y: 20, next: true };
            } else {
                overlays.over.classList.add('active');
                document.getElementById('overTitle').textContent = 'YOU WIN';
                document.getElementById('overSub').textContent = 'Every block is a real door. Open them from the Sites panel.';
                document.getElementById('continueBtn').textContent = 'PLAY AGAIN';
                banner = { text: 'VICTORY', timer: 999, y: 20, win: true };
            }
        }

        updateEnemies();
        updateProjectiles();
        updateParticles();
        updateNotification();
        updateBanner();

        const target = player.x - GAME_W / 2 + player.width / 2;
        cameraX += (Math.max(0, Math.min(target, worldWidth - GAME_W)) - cameraX) * 0.12;
        if (cameraX < 0) cameraX = 0;
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.45;
            p.life--;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    function updateNotification() {
        if (!notification) return;
        notification.timer--;
        if (notification.y < 56) notification.y += 5;
        if (notification.timer <= 0) {
            window.open(notification.link, '_blank', 'noopener,noreferrer');
            notification = null;
        }
    }

    function updateBanner() {
        if (!banner) return;
        if (banner.y < 58) banner.y += 4;
        if (banner.timer < 900) banner.timer--;
        if (banner.timer <= 0) banner = null;
    }

    function drawCloud(x, y, size) {
        const s = 18 * size;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.arc(x + s * 1.45, y + 2, s * 1.25, 0, Math.PI * 2);
        ctx.arc(x + s * 2.85, y, s, 0, Math.PI * 2);
        ctx.arc(x + s * 0.7, y - s * 0.45, s * 0.85, 0, Math.PI * 2);
        ctx.arc(x + s * 2.1, y - s * 0.5, s * 0.95, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(210,230,255,0.35)';
        ctx.beginPath();
        ctx.arc(x + s * 1.4, y + 6, s * 0.9, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawHills() {
        const par = cameraX * 0.42;
        ctx.fillStyle = '#1aa01a';
        for (const hill of hills) {
            const x = hill.x - par;
            if (x + hill.w < -40 || x > GAME_W + 40) continue;
            ctx.beginPath();
            ctx.moveTo(x, GAME_H - GROUND_HEIGHT);
            ctx.quadraticCurveTo(x + hill.w / 2, GAME_H - GROUND_HEIGHT - hill.h, x + hill.w, GAME_H - GROUND_HEIGHT);
            ctx.fill();
            ctx.fillStyle = '#28c428';
            ctx.beginPath();
            ctx.moveTo(x + 18, GAME_H - GROUND_HEIGHT);
            ctx.quadraticCurveTo(x + hill.w / 2, GAME_H - GROUND_HEIGHT - hill.h + 18, x + hill.w - 10, GAME_H - GROUND_HEIGHT);
            ctx.fill();
            ctx.fillStyle = '#1aa01a';
        }
        ctx.fillStyle = '#21d03a';
        for (const b of bushes) {
            const x = b.x - par;
            if (x < -40 || x > GAME_W + 40) continue;
            ctx.beginPath();
            ctx.arc(x, GAME_H - GROUND_HEIGHT - b.y, b.r1, 0, Math.PI * 2);
            ctx.arc(x + b.off, GAME_H - GROUND_HEIGHT - b.y + 12, b.r2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawGround() {
        const gy = GAME_H - GROUND_HEIGHT;
        ctx.fillStyle = COLORS.dirt;
        ctx.fillRect(0, gy, GAME_W, GROUND_HEIGHT);
        const off = cameraX % 32;
        ctx.fillStyle = COLORS.dirtDark;
        for (let x = -off; x < GAME_W + 32; x += 32) {
            ctx.fillRect(x, gy + 18, 32, 2);
            ctx.fillRect(x, gy + 50, 32, 2);
            ctx.fillRect(x, gy, 2, GROUND_HEIGHT);
        }
        ctx.fillStyle = COLORS.grassDark;
        ctx.fillRect(0, gy, GAME_W, 16);
        ctx.fillStyle = COLORS.grass;
        ctx.fillRect(0, gy, GAME_W, 8);
        ctx.fillStyle = '#7dff7d';
        ctx.fillRect(0, gy, GAME_W, 3);
        for (const pit of pits) {
            const x = pit.x - cameraX;
            ctx.fillStyle = skyBot;
            ctx.fillRect(x, gy - 2, pit.w, GROUND_HEIGHT + 4);
            const g = ctx.createLinearGradient(0, gy, 0, GAME_H);
            g.addColorStop(0, 'rgba(8,10,24,0.15)');
            g.addColorStop(1, 'rgba(8,10,24,0.85)');
            ctx.fillStyle = g;
            ctx.fillRect(x, gy + 8, pit.w, GROUND_HEIGHT);
        }
    }

    function drawBrick(worldX, y, w, h) {
        const x = worldX - cameraX;
        if (x + w < 0 || x > GAME_W) return;
        ctx.fillStyle = COLORS.brick;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = COLORS.brickDark;
        ctx.fillRect(x, y, w, 2);
        ctx.fillRect(x, y, 2, h);
        ctx.fillRect(x + w / 2 - 1, y, 2, h / 2);
        ctx.fillRect(x, y + h / 2 - 1, w, 2);
        ctx.fillRect(x + w / 4 - 1, y + h / 2, 2, h / 2);
        ctx.fillRect(x + w * 0.75 - 1, y + h / 2, 2, h / 2);
        ctx.fillStyle = COLORS.brickLight;
        ctx.fillRect(x + 2, y + 2, w - 5, 3);
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y + h - 3, w, 3);
        ctx.fillRect(x + w - 3, y, 3, h);
    }

    function drawQuestionBlock(block) {
        const x = block.x - cameraX;
        const y = block.y + block.bobY;
        if (x + 48 < 0 || x > GAME_W) return;
        const pulse = block.hit ? 0 : (Math.sin(tick / 10) + 1) / 2;
        ctx.fillStyle = block.hit ? '#6b3a18' : COLORS.q;
        ctx.fillRect(x, y, 48, 48);
        ctx.fillStyle = '#000';
        ctx.fillRect(x, y, 48, 3);
        ctx.fillRect(x, y + 45, 48, 3);
        ctx.fillRect(x, y, 3, 48);
        ctx.fillRect(x + 45, y, 3, 48);
        if (!block.hit) {
            ctx.fillStyle = COLORS.qLight;
            ctx.fillRect(x + 4, y + 4, 30, 3);
            ctx.fillRect(x + 4, y + 4, 3, 30);
            ctx.fillStyle = COLORS.qDark;
            ctx.fillRect(x + 40, y + 8, 4, 32);
            ctx.fillRect(x + 8, y + 40, 32, 4);
            ctx.fillStyle = `rgba(255,255,220,${0.18 + pulse * 0.25})`;
            ctx.fillRect(x + 6, y + 6, 36, 36);
        }
        ctx.fillStyle = block.hit ? '#3d2412' : '#fff';
        ctx.font = 'bold 14px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(block.label, x + 24, y + 26);
        ctx.font = '8px "Press Start 2P"';
        ctx.fillStyle = '#fff';
        ctx.fillText(block.name, x + 24, y + 64);
    }

    function drawPipe(p) {
        const x = p.x - cameraX;
        if (x + p.width < -10 || x > GAME_W) return;
        ctx.fillStyle = COLORS.pipeDark;
        ctx.fillRect(x, p.y + 14, p.width, p.height - 14);
        ctx.fillStyle = COLORS.pipe;
        ctx.fillRect(x + 4, p.y + 14, p.width - 8, p.height - 14);
        ctx.fillStyle = COLORS.pipeLight;
        ctx.fillRect(x + 8, p.y + 14, 6, p.height - 14);
        ctx.fillStyle = COLORS.pipeDark;
        ctx.fillRect(x - 6, p.y, p.width + 12, 18);
        ctx.fillStyle = COLORS.pipe;
        ctx.fillRect(x - 3, p.y + 3, p.width + 6, 12);
        ctx.fillStyle = COLORS.pipeLight;
        ctx.fillRect(x + 6, p.y + 3, 8, 12);
    }

    function drawFlag() {
        const x = flagX - cameraX;
        if (x < -20 || x > GAME_W + 80) return;
        ctx.fillStyle = '#d0d0d8';
        ctx.fillRect(x, GAME_H - GROUND_HEIGHT - 220, 6, 220);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x + 3, GAME_H - GROUND_HEIGHT - 224, 7, 0, Math.PI * 2);
        ctx.fill();
        const wave = Math.sin(tick / 12) * 4;
        ctx.fillStyle = '#e52521';
        ctx.beginPath();
        ctx.moveTo(x + 6, GAME_H - GROUND_HEIGHT - 210);
        ctx.lineTo(x + 58 + wave, GAME_H - GROUND_HEIGHT - 192);
        ctx.lineTo(x + 6, GAME_H - GROUND_HEIGHT - 174);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '8px "Press Start 2P"';
        ctx.textAlign = 'left';
        ctx.fillText('GOAL', x + 10, GAME_H - GROUND_HEIGHT - 188);
    }

    function drawMario(context, x, y, facing, moving, frame, onGround) {
        context.save();
        if (facing === -1) { context.translate(x + 32, y); context.scale(-1, 1); }
        else context.translate(x, y);
        context.fillStyle = COLORS.marioRed;
        context.fillRect(6, 0, 20, 8);
        context.fillRect(2, 8, 28, 8);
        context.fillStyle = COLORS.marioBrown;
        context.fillRect(2, 12, 7, 8);
        context.fillStyle = COLORS.marioSkin;
        context.fillRect(4, 16, 24, 12);
        context.fillRect(24, 12, 8, 8);
        context.fillStyle = COLORS.black;
        context.fillRect(20, 18, 4, 4);
        context.fillStyle = '#fff';
        context.fillRect(21, 19, 2, 2);
        context.fillStyle = COLORS.marioBrown;
        context.fillRect(16, 24, 12, 4);
        context.fillRect(24, 20, 8, 4);
        context.fillStyle = COLORS.marioRed;
        context.fillRect(4, 28, 24, 8);
        context.fillStyle = COLORS.marioBlue;
        context.fillRect(2, 32, 28, 12);
        context.fillRect(8, 28, 4, 4);
        context.fillRect(20, 28, 4, 4);
        context.fillStyle = COLORS.coin;
        context.fillRect(14, 36, 4, 4);
        const run = frame === 1 && moving;
        context.fillStyle = COLORS.marioBlue;
        if (!onGround) {
            context.fillRect(0, 44, 12, 4);
            context.fillRect(20, 44, 12, 4);
        } else if (run) {
            context.fillRect(4, 44, 8, 4);
            context.fillRect(20, 44, 8, 4);
        } else {
            context.fillRect(4, 44, 10, 4);
            context.fillRect(18, 44, 10, 4);
        }
        context.fillStyle = COLORS.marioBrown;
        if (!onGround) {
            context.fillRect(0, 44, 6, 4);
            context.fillRect(26, 44, 6, 4);
        } else {
            context.fillRect(2, 44, 6, 4);
            context.fillRect(24, 44, 6, 4);
        }
        context.restore();
    }

    function drawAsh(context, x, y, facing, moving, frame, onGround) {
        context.save();
        if (facing === -1) { context.translate(x + 32, y); context.scale(-1, 1); }
        else context.translate(x, y);
        context.fillStyle = COLORS.ashBlack;
        context.fillRect(2, 0, 28, 8);
        context.fillRect(0, 8, 32, 6);
        context.fillStyle = COLORS.ashBrown;
        context.fillRect(4, 12, 8, 4);
        context.fillStyle = COLORS.ashSkin;
        context.fillRect(6, 14, 20, 12);
        context.fillRect(22, 10, 6, 8);
        context.fillStyle = COLORS.black;
        context.fillRect(18, 18, 4, 4);
        context.fillStyle = '#fff';
        context.fillRect(19, 19, 2, 2);
        context.fillStyle = COLORS.ashBlack;
        context.fillRect(2, 26, 28, 18);
        context.fillStyle = COLORS.ashDarkGrey;
        context.fillRect(8, 34, 16, 6);
        context.fillStyle = '#3a3a3a';
        context.fillRect(12, 28, 8, 3);
        const run = frame === 1 && moving;
        context.fillStyle = COLORS.ashBlack;
        if (!onGround) {
            context.fillRect(2, 44, 10, 4);
            context.fillRect(20, 44, 10, 4);
        } else if (run) {
            context.fillRect(4, 44, 8, 4);
            context.fillRect(20, 44, 8, 4);
        } else {
            context.fillRect(4, 44, 10, 4);
            context.fillRect(18, 44, 10, 4);
        }
        context.fillStyle = COLORS.ashShoe;
        context.fillRect(2, 44, 6, 4);
        context.fillRect(24, 44, 6, 4);
        context.restore();
    }

    function drawMaggie(context, x, y, facing, moving, frame, onGround) {
        context.save();
        if (facing === -1) { context.translate(x + 32, y); context.scale(-1, 1); }
        else context.translate(x, y);
        context.fillStyle = COLORS.maggieBlonde;
        context.fillRect(4, 0, 24, 10);
        context.fillRect(2, 6, 28, 10);
        context.fillRect(0, 10, 6, 16);
        context.fillRect(26, 10, 6, 16);
        context.fillStyle = COLORS.maggieBlondeDark;
        context.fillRect(2, 14, 4, 8);
        context.fillRect(26, 14, 4, 8);
        context.fillStyle = COLORS.maggieSkin;
        context.fillRect(6, 12, 20, 14);
        context.fillStyle = COLORS.black;
        context.fillRect(18, 16, 4, 4);
        context.fillStyle = '#fff';
        context.fillRect(19, 17, 2, 2);
        context.fillStyle = '#ff6b6b';
        context.fillRect(16, 22, 6, 2);
        context.fillStyle = COLORS.maggiePurple;
        context.fillRect(4, 26, 24, 14);
        context.fillStyle = COLORS.maggiePurpleDark;
        context.fillRect(10, 26, 12, 4);
        context.fillStyle = COLORS.maggieBlack;
        context.fillRect(4, 40, 24, 4);
        const run = frame === 1 && moving;
        if (!onGround) {
            context.fillRect(4, 44, 8, 4);
            context.fillRect(20, 44, 8, 4);
        } else if (run) {
            context.fillRect(6, 44, 6, 4);
            context.fillRect(20, 44, 6, 4);
        } else {
            context.fillRect(4, 44, 10, 4);
            context.fillRect(18, 44, 10, 4);
        }
        context.fillStyle = '#000';
        context.fillRect(2, 44, 6, 4);
        context.fillRect(24, 44, 6, 4);
        context.restore();
    }

    function drawPlayer() {
        const moving = Math.abs(player.vx) > 0.5;
        const sx = player.x - cameraX;
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(sx + 16, player.y + player.height - 2, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        if (player.invuln > 0 && Math.floor(player.invuln / 3) % 2 === 0 && player.deadTimer === 0) return;
        const fn = currentCharacter === 'ash' ? drawAsh : currentCharacter === 'maggie' ? drawMaggie : drawMario;
        fn(ctx, sx, player.y, player.facing, moving, player.frame, player.onGround);
        if (hasWeapon) {
            ctx.fillStyle = COLORS.coin;
            ctx.fillRect(sx + (player.facing === 1 ? 28 : -6), player.y + 22, 8, 8);
            ctx.fillStyle = '#fff';
            ctx.fillRect(sx + (player.facing === 1 ? 30 : -4), player.y + 24, 4, 4);
        }
    }

    function drawCrawler(e) {
        const x = e.x - cameraX;
        const y = e.y + (e.alive ? 0 : 12);
        const h = e.alive ? e.h : Math.max(8, e.h - 14);
        const brute = e.type === 'brute';
        if (e.flash) ctx.globalAlpha = 0.55;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(x + e.w / 2, y + h - 1, e.w * 0.42, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = brute ? '#6b2410' : COLORS.crawler;
        ctx.fillRect(x + 2, y + 6, e.w - 4, h - 8);
        ctx.fillStyle = brute ? '#8a3014' : COLORS.crawlerLight;
        ctx.fillRect(x + 4, y + 8, e.w - 10, 8);
        ctx.fillStyle = brute ? '#3d1208' : COLORS.crawlerDark;
        ctx.fillRect(x + 2, y + h - 10, e.w - 4, 6);
        ctx.fillStyle = '#1a0c04';
        ctx.fillRect(x + e.w / 2 - 2, y + 2, 4, 8);
        ctx.fillStyle = brute ? '#ffb347' : '#ffdc8a';
        ctx.fillRect(x + e.w / 2 - 3, y, 6, 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 6, y + 12, 8, 8);
        ctx.fillRect(x + e.w - 14, y + 12, 8, 8);
        ctx.fillStyle = brute ? COLORS.droneEye : '#1a0a00';
        const eye = e.facing === 1 ? 2 : 0;
        ctx.fillRect(x + 8 + eye, y + 14, 4, 4);
        ctx.fillRect(x + e.w - 12 + eye, y + 14, 4, 4);
        ctx.fillStyle = '#3a1c08';
        const foot = e.frame ? 4 : 0;
        ctx.fillRect(x + 2, y + h - 4, 10, 5 + (e.alive ? foot : 0));
        ctx.fillRect(x + e.w - 12, y + h - 4, 10, 5 + (e.alive ? 4 - foot : 0));
        ctx.globalAlpha = 1;
    }

    function drawSpike(e) {
        const x = e.x - cameraX;
        ctx.fillStyle = COLORS.spike;
        ctx.fillRect(x, e.y + 10, e.w, e.h - 10);
        ctx.fillStyle = '#8a8aa0';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(x + 4 + i * 8, e.y + 12);
            ctx.lineTo(x + 8 + i * 8, e.y);
            ctx.lineTo(x + 12 + i * 8, e.y + 12);
            ctx.fill();
        }
        ctx.fillStyle = COLORS.droneEye;
        ctx.fillRect(x + 8, e.y + 16, 6, 6);
        ctx.fillRect(x + 18, e.y + 16, 6, 6);
    }

    function drawDrone(e) {
        const x = e.x - cameraX;
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x - 6, e.y - 6, e.w + 12, 4);
        ctx.fillStyle = COLORS.drone;
        ctx.fillRect(x, e.y, e.w, e.h);
        ctx.fillStyle = '#2a2a38';
        ctx.fillRect(x + 4, e.y + 6, e.w - 8, 12);
        ctx.fillStyle = COLORS.droneEye;
        ctx.fillRect(x + 12, e.y + 8, 8, 8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 14, e.y + 10, 3, 3);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 8, e.y - 4);
        ctx.lineTo(x + e.w + 8, e.y - 4);
        ctx.stroke();
    }

    function drawEnemies() {
        for (const e of enemies) {
            if (!e.alive && e.squash <= 0) continue;
            const x = e.x - cameraX;
            if (x + e.w < -20 || x > GAME_W + 20) continue;
            if (e.type === 'drone') drawDrone(e);
            else if (e.type === 'spike') drawSpike(e);
            else drawCrawler(e);
        }
    }

    function drawPickups() {
        for (const p of pickups) {
            if (p.taken) continue;
            const x = p.x - cameraX;
            const bob = Math.sin(tick / 8) * 4;
            ctx.save();
            ctx.translate(x + 14, p.y + 14 + bob);
            ctx.rotate(tick / 16);
            ctx.fillStyle = COLORS.coin;
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const a = (i * Math.PI) / 5 - Math.PI / 2;
                const r = i % 2 === 0 ? 13 : 6;
                const px = Math.cos(a) * r;
                const py = Math.sin(a) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fff8c8';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        for (const c of coinsWorld) {
            if (c.taken) continue;
            const x = c.x - cameraX;
            const y = c.y + Math.sin(c.bob) * 4;
            ctx.fillStyle = COLORS.coin;
            ctx.beginPath();
            ctx.ellipse(x + 8, y + 8, 6, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff3a0';
            ctx.beginPath();
            ctx.ellipse(x + 7, y + 6, 2, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawProjectiles() {
        for (const p of projectiles) {
            const x = p.x - cameraX;
            ctx.save();
            ctx.translate(x + 6, p.y + 6);
            ctx.rotate(p.spin);
            ctx.fillStyle = COLORS.coin;
            ctx.fillRect(-6, -2, 12, 4);
            ctx.fillRect(-2, -6, 4, 12);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-2, -2, 4, 4);
            ctx.restore();
        }
    }

    function drawParticles() {
        for (const p of particles) {
            const x = p.x - cameraX;
            ctx.globalAlpha = Math.max(0, p.life / (p.max || 30));
            ctx.fillStyle = p.color;
            ctx.fillRect(x, p.y, p.size || 5, p.size || 5);
        }
        ctx.globalAlpha = 1;
    }

    function drawHeart(x, y, filled) {
        ctx.fillStyle = filled ? '#ff4d6d' : '#3a2430';
        ctx.fillRect(x + 2, y, 5, 5);
        ctx.fillRect(x + 9, y, 5, 5);
        ctx.fillRect(x, y + 3, 16, 6);
        ctx.fillRect(x + 3, y + 9, 10, 4);
        ctx.fillRect(x + 6, y + 13, 4, 3);
        if (filled) {
            ctx.fillStyle = '#ffd0d8';
            ctx.fillRect(x + 3, y + 2, 2, 2);
        }
    }

    function drawHUD() {
        ctx.fillStyle = 'rgba(8,8,16,0.52)';
        ctx.fillRect(0, 0, GAME_W, 40);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, 39, GAME_W, 1);

        ctx.fillStyle = COLORS.coin;
        ctx.beginPath();
        ctx.ellipse(22, 20, 7, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff3a0';
        ctx.fillRect(19, 16, 3, 5);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = '11px "Press Start 2P"';
        ctx.fillStyle = '#fff';
        ctx.fillText(String(coins).padStart(3, '0'), 36, 21);

        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '9px "Press Start 2P"';
        ctx.fillText(levelName, 110, 21);

        for (let i = 0; i < 3; i++) drawHeart(GAME_W - 228 + i * 22, 12, i < lives);

        if (hasWeapon) {
            ctx.fillStyle = COLORS.coin;
            ctx.font = '9px "Press Start 2P"';
            ctx.textAlign = 'right';
            ctx.fillText('PULSE', GAME_W - 28, 21);
        }
    }

    function drawNotification() {
        if (!notification) return;
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        roundRect(GAME_W / 2 - 210, notification.y, 420, 48, 8);
        ctx.fill();
        ctx.fillStyle = COLORS.gold || COLORS.coin;
        ctx.font = '11px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('Opening ' + notification.text + '...', GAME_W / 2, notification.y + 30);
    }

    function drawBanner() {
        if (!banner) return;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        roundRect(GAME_W / 2 - 230, banner.y, 460, 44, 8);
        ctx.fill();
        ctx.fillStyle = COLORS.coin;
        ctx.font = '12px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(banner.text, GAME_W / 2, banner.y + 28);
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function drawSky() {
        const g = ctx.createLinearGradient(0, 0, 0, GAME_H);
        g.addColorStop(0, skyTop);
        g.addColorStop(1, skyBot);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.arc(180 - cameraX * 0.06, 90, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(20, 40, 90, 0.22)';
        const mx = -cameraX * 0.15;
        for (let i = 0; i < 10; i++) {
            const bx = mx + i * 360 - 40;
            const peak = 58 + (i % 3) * 18;
            ctx.beginPath();
            ctx.moveTo(bx, GAME_H - GROUND_HEIGHT);
            ctx.lineTo(bx + 150, GAME_H - GROUND_HEIGHT - peak);
            ctx.lineTo(bx + 300, GAME_H - GROUND_HEIGHT);
            ctx.fill();
        }
    }

    function draw() {
        const camStore = cameraX;
        cameraX = Math.round(cameraX);
        ctx.save();
        if (shake) {
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }
        drawSky();
        const cloudPar = cameraX * 0.28;
        for (const c of clouds) {
            const x = c.x - cloudPar;
            if (x > -120 && x < GAME_W + 120) drawCloud(x, c.y, c.size);
        }
        drawHills();
        drawGround();
        for (const b of bricks) drawBrick(b.x, b.y, b.width, b.height);
        for (const m of movers) {
            const x = m.x - cameraX;
            ctx.fillStyle = '#4a4a62';
            ctx.fillRect(x, m.y, m.w, m.h);
            ctx.fillStyle = '#8d8dac';
            ctx.fillRect(x + 2, m.y + 2, m.w - 4, 4);
        }
        for (const p of pipes) drawPipe(p);
        for (const b of blocks) drawQuestionBlock(b);
        drawFlag();
        drawPickups();
        drawEnemies();
        drawParticles();
        drawProjectiles();
        drawPlayer();
        ctx.restore();
        drawHUD();
        drawNotification();
        drawBanner();
        const vg = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, 180, GAME_W / 2, GAME_H / 2, 620);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.22)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        cameraX = camStore;
    }

    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    function resizeCanvas() {
        const shell = document.querySelector('.stage-shell');
        const isCoarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        const isNarrow = window.innerWidth <= 768;
        const mobile = isCoarse || isNarrow;
        const reserved = mobile ? 260 : 200;
        const viewportH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const maxW = Math.max(220, Math.min(shell ? shell.clientWidth : window.innerWidth - 24, 1100));
        const maxH = Math.max(140, Math.min(viewportH - reserved, 560));
        const aspect = GAME_W / GAME_H;
        let w = maxW;
        let h = w / aspect;
        if (h > maxH) {
            h = maxH;
            w = h * aspect;
        }
        w = Math.floor(w);
        h = Math.round(w / aspect);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
    }

    function bindKey(code, down) {
        if (code === 'ArrowLeft' || code === 'KeyA') keys.left = down;
        if (code === 'ArrowRight' || code === 'KeyD') keys.right = down;
        if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
            keys.jump = down;
            if (down) return true;
        }
        if (code === 'KeyX' || code === 'KeyF' || code === 'ShiftLeft' || code === 'ShiftRight') {
            keys.fire = down;
        }
        return code === 'Space' || code.startsWith('Arrow');
    }

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && started && !overlays.title.classList.contains('active') && !overlays.character.classList.contains('active') && !overlays.sites.classList.contains('active') && !overlays.over.classList.contains('active')) {
            overlays.pause.classList.toggle('active');
            return;
        }
        if (anyOverlayOpen()) return;
        if (bindKey(e.code, true)) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => bindKey(e.code, false));

    function addHold(btn, key) {
        const on = (ev) => { ev.preventDefault(); keys[key] = true; audio.ensure(); };
        const off = (ev) => { ev.preventDefault(); keys[key] = false; };
        btn.addEventListener('touchstart', on, { passive: false });
        btn.addEventListener('touchend', off, { passive: false });
        btn.addEventListener('touchcancel', off, { passive: false });
        btn.addEventListener('mousedown', on);
        btn.addEventListener('mouseup', off);
        btn.addEventListener('mouseleave', off);
    }
    addHold(document.getElementById('btnUp'), 'jump');
    addHold(document.getElementById('btnLeft'), 'left');
    addHold(document.getElementById('btnRight'), 'right');
    addHold(document.getElementById('btnJump'), 'jump');
    addHold(document.getElementById('btnFire'), 'fire');

    function drawCharacterPreviews() {
        const map = [
            ['previewMario', drawMario],
            ['previewAsh', drawAsh],
            ['previewMaggie', drawMaggie]
        ];
        for (const [id, fn] of map) {
            const c = document.getElementById(id);
            const cctx = c.getContext('2d');
            cctx.clearRect(0, 0, 64, 96);
            cctx.save();
            cctx.scale(2, 2);
            fn(cctx, 0, 0, 1, false, 0, true);
            cctx.restore();
        }
    }

    function setCharacter(name) {
        currentCharacter = name;
        localStorage.setItem('amoran-char', name);
        document.querySelectorAll('.character-option').forEach((el) => {
            el.classList.toggle('selected', el.dataset.character === name);
        });
    }

    function clearInput() {
        keys.left = keys.right = keys.jump = keys.fire = false;
        jumpPressed = false;
        firePressed = false;
    }

    function beginPlay() {
        overlays.character.classList.remove('active');
        overlays.title.classList.remove('active');
        overlays.pause.classList.remove('active');
        clearInput();
        audio.ensure();
        if (!started) {
            lives = 3;
            coins = 0;
            hasWeapon = false;
            loadLevel(0);
            started = true;
        }
    }

    document.getElementById('playBtn').addEventListener('click', () => {
        audio.ensure();
        overlays.title.classList.remove('active');
        overlays.character.classList.add('active');
        drawCharacterPreviews();
    });
    document.getElementById('titleSitesBtn').addEventListener('click', () => {
        overlays.title.classList.remove('active');
        overlays.sites.classList.add('active');
        overlays.sites.dataset.from = 'title';
    });
    document.getElementById('settingsBtn').addEventListener('click', () => {
        audio.ensure();
        overlays.pause.classList.remove('active');
        overlays.character.classList.add('active');
        drawCharacterPreviews();
    });
    document.getElementById('closeOverlay').addEventListener('click', beginPlay);
    document.getElementById('sitesBtn').addEventListener('click', () => overlays.sites.classList.add('active'));
    document.getElementById('pauseSitesBtn').addEventListener('click', () => {
        overlays.pause.classList.remove('active');
        overlays.sites.classList.add('active');
    });
    document.getElementById('pauseCharBtn').addEventListener('click', () => {
        overlays.pause.classList.remove('active');
        overlays.character.classList.add('active');
        drawCharacterPreviews();
    });
    document.getElementById('resumeBtn').addEventListener('click', () => overlays.pause.classList.remove('active'));
    document.getElementById('closeSites').addEventListener('click', () => {
        overlays.sites.classList.remove('active');
        if (overlays.sites.dataset.from === 'title' && !started) overlays.title.classList.add('active');
        if (overlays.sites.dataset.from === 'over') overlays.over.classList.add('active');
        overlays.sites.dataset.from = '';
    });
    document.getElementById('overSitesBtn').addEventListener('click', () => {
        overlays.over.classList.remove('active');
        overlays.sites.classList.add('active');
        overlays.sites.dataset.from = 'over';
    });
    document.getElementById('continueBtn').addEventListener('click', () => {
        overlays.over.classList.remove('active');
        document.getElementById('continueBtn').textContent = 'CONTINUE';
        if (banner && banner.win) {
            lives = 3;
            coins = 0;
            hasWeapon = false;
            loadLevel(0);
            banner = null;
            return;
        }
        if (banner && banner.next) {
            loadLevel(levelIndex + 1);
            banner = null;
            return;
        }
        lives = 3;
        loadLevel(levelIndex);
        banner = null;
    });
    document.getElementById('muteBtn').addEventListener('click', () => {
        audio.muted = !audio.muted;
        audio.ensure();
        syncMuteUI();
    });
    document.getElementById('muteCheck').addEventListener('change', (e) => {
        audio.muted = e.target.checked;
        syncMuteUI();
    });

    document.querySelectorAll('.character-option').forEach((option) => {
        option.addEventListener('click', () => setCharacter(option.dataset.character));
    });

    canvas.addEventListener('click', (e) => {
        if (!notification) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (GAME_W / rect.width);
        const y = (e.clientY - rect.top) * (GAME_H / rect.height);
        if (x >= GAME_W / 2 - 210 && x <= GAME_W / 2 + 210 && y >= notification.y && y <= notification.y + 48) {
            window.open(notification.link, '_blank', 'noopener,noreferrer');
            notification = null;
        }
    });

    setCharacter(currentCharacter);
    syncMuteUI();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvas);
    loadLevel(0);
    started = false;
    drawCharacterPreviews();
    loop();
})();
