/* amoran.io — themes and level data. */
(function (global) {
    'use strict';

    const AMO = (global.AMO = global.AMO || {});

    const GROUND_TOP = 444;
    const TILE = 48;

    /* ---------------------------------------------------------------- links */

    const LINKS = {
        linkedin: {
            id: 'linkedin',
            label: 'in',
            title: 'LinkedIn',
            url: 'https://www.linkedin.com/in/ashleymoran',
            tint: '#38bdf8'
        },
        x: {
            id: 'x',
            label: 'X',
            title: 'X / Twitter',
            url: 'https://x.com/amoranio',
            tint: '#e2e8f5'
        },
        github: {
            id: 'github',
            label: '{}',
            title: 'GitHub',
            url: 'https://github.com/amoranio',
            tint: '#c4b5fd'
        },
        exnoscan: {
            id: 'exnoscan',
            label: 'EX',
            title: 'Exnoscan',
            url: 'https://exnoscan.com',
            tint: '#5eead4'
        },
        clearqr: {
            id: 'clearqr',
            label: 'QR',
            title: 'clearQR',
            url: 'https://clearqr.exnoscan.com',
            tint: '#fcd34d'
        },
        badmcp: {
            id: 'badmcp',
            label: '!!',
            title: 'badMCP',
            url: 'https://amoranio.github.io/badMCP',
            tint: '#fb7185'
        }
    };

    /* --------------------------------------------------------------- themes */

    const THEMES = {
        grass: {
            name: 'GRASSLANDS',
            backdrop: 'hills',
            sky: ['#7ec8f5', '#a8dcf7', '#dff0fb'],
            sun: '#fff6d8',
            far: '#79b06a',
            farDark: '#5d9155',
            mid: '#4f9f4a',
            midDark: '#3d8340',
            ground: '#a9603a',
            groundDark: '#7d4326',
            groundTop: '#5fb257',
            groundTopDark: '#43904a',
            brick: '#c1673d',
            brickDark: '#8d4526',
            brickLight: '#e08e5f',
            metal: '#8b93a8',
            metalDark: '#5a6178',
            accent: '#ffd166',
            haze: 'rgba(255,246,214,0.16)',
            motes: 'pollen',
            moteColour: 'rgba(255,255,200,0.85)'
        },
        neon: {
            name: 'NEON CITY',
            backdrop: 'city',
            sky: ['#0b0b23', '#1d1440', '#3a1c4d'],
            sun: '#ff8fd0',
            far: '#241a49',
            farDark: '#1a1236',
            mid: '#33215c',
            midDark: '#241543',
            ground: '#2b2050',
            groundDark: '#1b1436',
            groundTop: '#7c4dff',
            groundTopDark: '#4d2ea8',
            brick: '#4b2f7a',
            brickDark: '#2f1d51',
            brickLight: '#8b5cf6',
            metal: '#5d6a8c',
            metalDark: '#39425c',
            accent: '#22d3ee',
            haze: 'rgba(139,92,246,0.14)',
            motes: 'rain',
            moteColour: 'rgba(140,220,255,0.6)'
        },
        core: {
            name: 'CIRCUIT CORE',
            backdrop: 'circuit',
            sky: ['#050810', '#0a1420', '#0f2029'],
            sun: '#5eead4',
            far: '#0d1b26',
            farDark: '#081218',
            mid: '#122a33',
            midDark: '#0c1d24',
            ground: '#1b2b33',
            groundDark: '#0f1b21',
            groundTop: '#2dd4bf',
            groundTopDark: '#0f766e',
            brick: '#274a52',
            brickDark: '#16303a',
            brickLight: '#5eead4',
            metal: '#4c5b6b',
            metalDark: '#2c3846',
            accent: '#fb7185',
            haze: 'rgba(45,212,191,0.12)',
            motes: 'embers',
            moteColour: 'rgba(94,234,212,0.7)'
        }
    };

    /* -------------------------------------------------------------- helpers */

    function solid(x, y, w, h, kind) {
        return { x: x, y: y, w: w, h: h, kind: kind || 'brick' };
    }

    function run(x, y, count, kind) {
        const out = [];
        for (let i = 0; i < count; i++) out.push(solid(x + i * TILE, y, TILE, TILE, kind));
        return out;
    }

    function stairs(x, count, kind, dir) {
        const out = [];
        const step = dir === -1 ? -1 : 1;
        for (let i = 0; i < count; i++) {
            const idx = step === 1 ? i : count - 1 - i;
            const h = (idx + 1) * TILE;
            out.push(solid(x + i * TILE, GROUND_TOP - h, TILE, h, kind || 'brick'));
        }
        return out;
    }

    function coinRow(x, y, count, step) {
        const out = [];
        const gap = step || 34;
        for (let i = 0; i < count; i++) out.push({ x: x + i * gap, y: y });
        return out;
    }

    function coinArc(x, y, count, spanX, lift) {
        const out = [];
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0 : i / (count - 1);
            out.push({ x: x + t * spanX, y: y - Math.sin(t * Math.PI) * lift });
        }
        return out;
    }

    /* --------------------------------------------------------------- levels */

    const LEVELS = [
        /* ============================== 1 — GRASSLANDS ============================== */
        {
            name: 'GRASSLANDS',
            hint: 'Stomp the bugs. Punch the blocks. Collect the links.',
            theme: 'grass',
            width: 3480,
            ground: [[-200, 1120], [1260, 2180], [2320, 3480]],
            solids: [].concat(
                run(432, 252, 1, 'brick'),
                run(528, 252, 1, 'brick'),
                [solid(816, 324, 144, 24, 'platform')],
                // Gap at 1056 leaves room to punch the heart crate.
                run(1008, 252, 1, 'brick'),
                run(1104, 252, 1, 'brick'),
                [solid(1320, 336, 132, 24, 'platform')],
                run(1512, 300, 1, 'brick'),
                [solid(1656, 348, 216, 24, 'platform')],
                run(1680, 216, 1, 'brick'),
                run(1776, 216, 1, 'brick'),
                [solid(2000, 300, 120, 24, 'platform')],
                stairs(2400, 3, 'brick', 1),
                [solid(2688, 288, 168, 24, 'platform')],
                // Gap at 2928 leaves room to punch the coin crate.
                run(2880, 216, 1, 'brick'),
                run(2976, 216, 2, 'brick'),
                stairs(3120, 4, 'brick', 1)
            ),
            movers: [
                { x: 1120, y: 360, w: 120, h: 22, axis: 'x', range: 150, speed: 0.55, phase: 0 }
            ],
            blocks: [
                { x: 288, y: 252, kind: 'crate', reward: 'weapon:blaster' },
                { x: 480, y: 252, kind: 'link', link: 'linkedin' },
                { x: 1056, y: 252, kind: 'crate', reward: 'heart' },
                { x: 1728, y: 216, kind: 'link', link: 'x' },
                { x: 2928, y: 216, kind: 'crate', reward: 'coins' }
            ],
            coins: [].concat(
                coinArc(360, 398, 5, 120, 62),
                coinRow(840, 280, 4),
                coinArc(1140, 320, 5, 110, 50),
                coinRow(1690, 300, 5),
                coinArc(2180, 398, 6, 140, 72),
                coinRow(2710, 240, 4),
                coinRow(3040, 300, 4)
            ),
            enemies: [
                { type: 'bug', x: 700, y: 400, patrol: [620, 1000] },
                { type: 'bug', x: 1020, y: 400, patrol: [960, 1110] },
                { type: 'bug', x: 1420, y: 400, patrol: [1300, 1700] },
                { type: 'hopper', x: 1900, y: 400, patrol: [1780, 2120] },
                { type: 'drone', x: 2260, y: 250, patrol: [2140, 2420], amp: 46 },
                { type: 'bug', x: 2560, y: 400, patrol: [2420, 2760] },
                { type: 'hopper', x: 3000, y: 400, patrol: [2900, 3160] }
            ],
            hazards: [],
            goal: { x: 3352, y: GROUND_TOP - 240 }
        },

        /* =============================== 2 — NEON CITY ============================== */
        {
            name: 'NEON CITY',
            hint: 'Sentries shoot back. Keep moving and use cover.',
            theme: 'neon',
            width: 3960,
            ground: [[-200, 780], [900, 1560], [1700, 2540], [2700, 3960]],
            solids: [].concat(
                run(336, 288, 2, 'metal'),
                [solid(624, 336, 120, 22, 'platform')],
                [solid(792, 264, 120, 22, 'platform')],
                // Gap at 1080 leaves room to punch the GitHub link block.
                run(1032, 252, 1, 'brick'),
                run(1128, 252, 1, 'brick'),
                [solid(1272, 336, 144, 22, 'platform')],
                run(1440, 288, 2, 'metal'),
                [solid(1584, 384, 110, 22, 'platform')],
                [solid(1752, 300, 168, 22, 'platform')],
                // Gap at 2016 leaves room to punch the heart crate.
                run(1968, 228, 1, 'brick'),
                run(2064, 228, 1, 'brick'),
                [solid(2256, 348, 144, 22, 'platform')],
                run(2400, 264, 1, 'metal'),
                [solid(2544, 396, 120, 22, 'platform')],
                [solid(2736, 312, 192, 22, 'platform')],
                // Gap at 3048 leaves room to punch the Exnoscan link block.
                run(3000, 240, 1, 'brick'),
                run(3096, 240, 2, 'brick'),
                [solid(3264, 348, 144, 22, 'platform')],
                stairs(3480, 3, 'metal', 1),
                // Gap at 3720 leaves room to punch the coin crate.
                run(3672, 240, 1, 'brick'),
                run(3768, 240, 1, 'brick')
            ),
            movers: [
                { x: 780, y: 372, w: 120, h: 22, axis: 'x', range: 130, speed: 0.6, phase: 0 },
                { x: 1600, y: 300, w: 110, h: 22, axis: 'y', range: 120, speed: 0.5, phase: 1.2 },
                { x: 2560, y: 372, w: 130, h: 22, axis: 'x', range: 150, speed: 0.7, phase: 2.1 }
            ],
            blocks: [
                // Clear of the metal step at 336, which left no headroom under it,
                // and low enough that a tap jump reaches the level's weapon.
                { x: 264, y: 252, kind: 'crate', reward: 'weapon:spread' },
                { x: 1080, y: 252, kind: 'link', link: 'github' },
                { x: 2016, y: 228, kind: 'crate', reward: 'heart' },
                { x: 3048, y: 240, kind: 'link', link: 'exnoscan' },
                { x: 3720, y: 240, kind: 'crate', reward: 'coins' }
            ],
            coins: [].concat(
                coinRow(420, 340, 4),
                coinArc(660, 300, 5, 120, 50),
                coinRow(1100, 320, 4),
                coinArc(1580, 350, 5, 130, 60),
                coinRow(1790, 260, 5),
                coinArc(2160, 398, 6, 150, 72),
                coinRow(2780, 270, 5),
                coinArc(3140, 340, 6, 140, 60),
                coinRow(3700, 320, 4)
            ),
            enemies: [
                { type: 'bug', x: 480, y: 400, patrol: [380, 760] },
                { type: 'drone', x: 700, y: 220, patrol: [600, 900], amp: 40 },
                { type: 'hopper', x: 1150, y: 400, patrol: [960, 1520] },
                { type: 'sentry', x: 1450, y: 244, patrol: null },
                { type: 'bug', x: 1900, y: 400, patrol: [1740, 2200] },
                { type: 'drone', x: 2100, y: 200, patrol: [1960, 2400], amp: 55 },
                { type: 'hopper', x: 2360, y: 300, patrol: [2260, 2390] },
                { type: 'sentry', x: 2764, y: 264, patrol: null },
                { type: 'bug', x: 2900, y: 400, patrol: [2740, 3160] },
                { type: 'drone', x: 3300, y: 230, patrol: [3180, 3520], amp: 48 },
                { type: 'hopper', x: 3620, y: 400, patrol: [3520, 3860] }
            ],
            hazards: [
                { type: 'saw', x: 1180, y: 392, axis: 'x', range: 160, speed: 1.3, phase: 0 },
                { type: 'saw', x: 2460, y: 260, axis: 'y', range: 130, speed: 1.1, phase: 0.8 }
            ],
            goal: { x: 3852, y: GROUND_TOP - 240 }
        },

        /* ============================= 3 — CIRCUIT CORE ============================= */
        {
            name: 'CIRCUIT CORE',
            hint: 'Something big is guarding the last two links.',
            theme: 'core',
            width: 4560,
            ground: [[-200, 640], [760, 1300], [1420, 2020], [2160, 2760], [2880, 4560]],
            solids: [].concat(
                run(288, 300, 2, 'metal'),
                [solid(480, 372, 110, 22, 'platform')],
                run(672, 252, 2, 'brick'),
                [solid(912, 336, 130, 22, 'platform')],
                run(1104, 276, 2, 'metal'),
                [solid(1296, 384, 110, 22, 'platform')],
                [solid(1464, 300, 168, 22, 'platform')],
                // Gap at 1728 leaves room to punch the clearQR link block; the row
                // sits at 252 so a tap jump reaches it.
                run(1680, 252, 1, 'brick'),
                run(1776, 252, 1, 'brick'),
                [solid(1968, 348, 130, 22, 'platform')],
                run(2160, 288, 2, 'metal'),
                [solid(2352, 372, 120, 22, 'platform')],
                [solid(2544, 288, 168, 22, 'platform')],
                // Gap at 2832 leaves room to punch the heart crate.
                run(2784, 240, 1, 'brick'),
                run(2880, 240, 1, 'brick'),
                [solid(3072, 348, 144, 22, 'platform')],
                stairs(3264, 3, 'metal', 1),
                // Gap at 3504 leaves room to punch the coin crate.
                run(3456, 252, 1, 'brick'),
                // boss arena floor furniture
                [solid(3960, 336, 168, 24, 'metal')],
                [solid(4248, 336, 168, 24, 'metal')],
                [solid(4104, 228, 168, 24, 'metal')]
            ),
            movers: [
                { x: 660, y: 384, w: 110, h: 22, axis: 'x', range: 140, speed: 0.7, phase: 0 },
                { x: 1320, y: 288, w: 110, h: 22, axis: 'y', range: 130, speed: 0.6, phase: 0.6 },
                { x: 2020, y: 384, w: 120, h: 22, axis: 'x', range: 150, speed: 0.8, phase: 1.5 },
                { x: 2760, y: 312, w: 110, h: 22, axis: 'y', range: 110, speed: 0.55, phase: 2.4 }
            ],
            blocks: [
                // Clear of the metal step at 288, which left no headroom under it,
                // and low enough that a tap jump reaches the level's weapon.
                { x: 216, y: 252, kind: 'crate', reward: 'weapon:pulse' },
                { x: 1728, y: 252, kind: 'link', link: 'clearqr' },
                // Was hanging over the pit at 2760-2880 with nowhere to stand.
                { x: 2352, y: 240, kind: 'crate', reward: 'heart' },
                { x: 3504, y: 252, kind: 'crate', reward: 'coins' }
            ],
            coins: [].concat(
                coinRow(360, 350, 4),
                coinArc(520, 320, 5, 120, 50),
                coinRow(940, 280, 4),
                coinArc(1300, 330, 5, 130, 60),
                coinRow(1500, 250, 5),
                coinArc(1900, 398, 6, 150, 72),
                coinRow(2580, 240, 5),
                coinArc(2980, 330, 6, 140, 60),
                coinRow(3300, 300, 4)
            ),
            enemies: [
                { type: 'bug', x: 420, y: 400, patrol: [320, 620] },
                { type: 'sentry', x: 336, y: 256, patrol: null },
                { type: 'drone', x: 820, y: 220, patrol: [700, 1080], amp: 50 },
                { type: 'hopper', x: 1000, y: 400, patrol: [800, 1280] },
                { type: 'bug', x: 1500, y: 400, patrol: [1440, 2000] },
                { type: 'sentry', x: 1512, y: 256, patrol: null },
                { type: 'drone', x: 1850, y: 190, patrol: [1700, 2100], amp: 58 },
                { type: 'hopper', x: 2300, y: 400, patrol: [2180, 2740] },
                { type: 'bug', x: 2600, y: 400, patrol: [2400, 2740] },
                { type: 'sentry', x: 2592, y: 244, patrol: null },
                { type: 'drone', x: 3000, y: 210, patrol: [2900, 3300], amp: 52 },
                { type: 'hopper', x: 3400, y: 400, patrol: [3300, 3620] }
            ],
            hazards: [
                { type: 'saw', x: 900, y: 392, axis: 'x', range: 150, speed: 1.4, phase: 0 },
                { type: 'saw', x: 1980, y: 268, axis: 'y', range: 140, speed: 1.2, phase: 0.9 },
                { type: 'saw', x: 3120, y: 392, axis: 'x', range: 170, speed: 1.5, phase: 1.7 }
            ],
            arena: { trigger: 3760, left: 3720, right: 4530 },
            boss: {
                x: 4260,
                y: 200,
                link: 'badmcp',
                name: 'THE NULL POINTER'
            },
            goal: null
        }
    ];

    AMO.levels = {
        GROUND_TOP: GROUND_TOP,
        TILE: TILE,
        LINKS: LINKS,
        THEMES: THEMES,
        LEVELS: LEVELS,
        linkOrder: ['linkedin', 'x', 'github', 'exnoscan', 'clearqr', 'badmcp']
    };
})(window);
