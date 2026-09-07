/* amoran.io — pixel art sprite factory.
 * Sprites are authored as character grids (one char per pixel) and baked into
 * offscreen canvases once, then blitted with smoothing disabled. */
(function (global) {
    'use strict';

    const AMO = (global.AMO = global.AMO || {});

    const cache = new Map();

    /** Bake a grid of characters into an offscreen canvas, 1 char = 1 pixel. */
    function bake(key, rows, palette) {
        if (cache.has(key)) return cache.get(key);

        const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
        const height = rows.length;
        const surface = document.createElement('canvas');
        surface.width = width;
        surface.height = height;
        const g = surface.getContext('2d');

        for (let y = 0; y < height; y++) {
            const row = rows[y];
            for (let x = 0; x < row.length; x++) {
                const ch = row[x];
                if (ch === '.' || ch === ' ') continue;
                const colour = palette[ch];
                if (!colour) continue;
                g.fillStyle = colour;
                g.fillRect(x, y, 1, 1);
            }
        }

        cache.set(key, surface);
        return surface;
    }

    /* ---------------------------------------------------------------- heads */

    const HEADS = {
        mario: [
            '.....oooooo.....',
            '....oKKKKKKo....',
            '...oKKKKKKKKo...',
            '..oKKKKKKKKKKo..',
            '..ohhKKKKKKKoo..',
            '..ohhssEsssso...',
            '..ohsssMMMMso...',
            '...osSMMMMsso...',
            '....oosssoo.....'
        ],
        ash: [
            '.....oooooo.....',
            '....oAAAAAAo....',
            '...oAAAAAAAAo...',
            '..oAAAAAAAAAAo..',
            '..oAAhhssssso...',
            '..oAhhssEssso...',
            '..oAhssssssso...',
            '...oAsSssssso...',
            '....oAsssoo.....'
        ],
        maggie: [
            '.....oooooo.....',
            '....oHHHHHHo....',
            '...oHHHHHHHHo...',
            '..oHHhhhhhHHo...',
            '..oHhssssssHo...',
            '..oHhssEsssHo...',
            '..oHhssssLLHo...',
            '..oHHsSsssHHo...',
            '..oHHoosssoHo...'
        ]
    };

    /* --------------------------------------------------------------- torsos */

    const TORSO = [
        '...oAAAAAAo.....',
        '..oCAAAAAACo....',
        '.osAAAAAAAAso...',
        '.osAAABBAAAso...',
        '.ooAAABBAAAoo...',
        '..oAAAAAAAAo....',
        '..oAAAAAAAAo....',
        '...oPPPPPPo.....'
    ];

    /* Long hair spilling over the shoulders. */
    const TORSO_LONGHAIR = [
        '..HoAAAAAAoH....',
        '..HoAAAAAAoH....',
        '.osAAAAAAAAso...',
        '.osAAABBAAAso...',
        '.ooAAABBAAAoo...',
        '..oAAAAAAAAo....',
        '..oAAAAAAAAo....',
        '...oPPPPPPo.....'
    ];

    /* ---------------------------------------------------------------- legs */

    const LEGS = {
        idle: [
            '...oPPPPPPo.....',
            '...oPPoPPPo.....',
            '...oPPoPPPo.....',
            '...opPoPppo.....',
            '..obbboobbbo....',
            '..obbboobbbo....',
            '...ooo..ooo.....'
        ],
        runA: [
            '...oPPPPPPo.....',
            '...oPPPPPPo.....',
            '..oPPo.oPPo.....',
            '.oPPo...oPPo....',
            'obbbo....obbbo..',
            '.ooo......ooo...',
            '................'
        ],
        runB: [
            '...oPPPPPPo.....',
            '...oPPPPPPo.....',
            '...oPPoPPo......',
            '..oPPo.oPPPo....',
            '.obbbo..obbo....',
            '..ooo....oo.....',
            '................'
        ],
        jump: [
            '...oPPPPPPo.....',
            '..oPPPPPPPo.....',
            '..oPPo.oPPo.....',
            '.oPPo...oPPo....',
            '.obbo....obbbo..',
            '..oo......ooo...',
            '................'
        ],
        hurt: [
            '...oPPPPPPo.....',
            '..oPPPPPPPo.....',
            '.oPPo...oPPo....',
            'oPPo.....oPPo...',
            'obbo......obbo..',
            '.oo........oo...',
            '................'
        ]
    };

    /* ------------------------------------------------------------ palettes */

    const OUTLINE = '#0d0d16';

    const CHARACTERS = {
        mario: {
            name: 'M@rio',
            head: 'mario',
            longHair: false,
            palette: {
                o: OUTLINE,
                K: '#e5342b', // cap
                h: '#6b3f22', // hair
                s: '#ffc39a', // skin
                S: '#d99a72',
                E: '#20202e',
                M: '#5a3418', // moustache
                A: '#e5342b', // shirt
                B: '#b3221c',
                C: '#ff6a5c',
                P: '#2f6fd0', // dungarees
                p: '#22508f',
                b: '#8a5a2b', // boots
                L: '#ff7a8a',
                H: '#6b3f22'
            }
        },
        ash: {
            name: 'Ash',
            head: 'ash',
            longHair: false,
            palette: {
                o: OUTLINE,
                K: '#1c1c24',
                h: '#4a3222',
                s: '#ffc39a',
                S: '#d99a72',
                E: '#20202e',
                M: '#4a3222',
                A: '#22232e', // hoodie
                B: '#15161f',
                C: '#3a3c4c',
                P: '#1a1b23',
                p: '#101118',
                b: '#3f4250',
                L: '#ff7a8a',
                H: '#4a3222'
            }
        },
        maggie: {
            name: 'Maggie',
            head: 'maggie',
            longHair: true,
            palette: {
                o: OUTLINE,
                K: '#f2d15c',
                h: '#d9ab35',
                s: '#ffd0b4',
                S: '#e0a685',
                E: '#20202e',
                M: '#d9ab35',
                A: '#9b6bf2', // top
                B: '#7a4bd6',
                C: '#c3a3ff',
                P: '#1c1c26',
                p: '#12121a',
                b: '#2a2a36',
                L: '#ff6b7f',
                H: '#f2d15c'
            }
        }
    };

    const FRAMES = ['idle', 'runA', 'runB', 'jump', 'hurt'];

    /** Character sprite: 16x24 grid, blitted at 2x into a 32x48 box. */
    function character(id, frame) {
        const def = CHARACTERS[id] || CHARACTERS.mario;
        const pose = FRAMES.indexOf(frame) >= 0 ? frame : 'idle';
        const rows = [].concat(
            HEADS[def.head],
            def.longHair ? TORSO_LONGHAIR : TORSO,
            LEGS[pose]
        );
        return bake('char:' + id + ':' + pose, rows, def.palette);
    }

    /* ------------------------------------------------------------- enemies */

    const ENEMY_SPRITES = {
        // Crawler — "bug". 14x12
        bugA: {
            rows: [
                '..o........o..',
                '...o......o...',
                '....oooooo....',
                '..oo111111oo..',
                '.o1111111111o.',
                '.o1eE1111Ee1o.',
                '.o1111111111o.',
                '.o1122112211o.',
                '..o11111111o..',
                '...oooooooo...',
                '...oo....oo...',
                '..oooo..oooo..'
            ]
        },
        bugB: {
            rows: [
                '..o........o..',
                '.o..o....o..o.',
                '....oooooo....',
                '..oo111111oo..',
                '.o1111111111o.',
                '.o1eE1111Ee1o.',
                '.o1111111111o.',
                '.o1122112211o.',
                '..o11111111o..',
                '...oooooooo...',
                '..oo......oo..',
                '.oooo......ooo'
            ]
        },
        // Hopper — springy blob. 16x14
        hopA: {
            rows: [
                '.....oooo.....',
                '...oo1111oo...',
                '..o11111111o..',
                '.o1111111111o.',
                '.o11eE11Ee11o.',
                '.o1111111111o.',
                '.o1122221111o.',
                '.o1111111111o.',
                '..o11111111o..',
                '...oo1111oo...',
                '....oooooo....',
                '...oo....oo...',
                '..ooo....ooo..',
                '..............'
            ]
        },
        hopB: {
            rows: [
                '..............',
                '..............',
                '....oooooo....',
                '..oo111111oo..',
                '.o1111111111o.',
                'o11eE1111Ee11o',
                'o111111111111o',
                'o111222211111o',
                'o111111111111o',
                '.o1111111111o.',
                '..oo111111oo..',
                '..o.oooooo.o..',
                '.ooo......ooo.',
                '..............'
            ]
        },
        // Drone — hovering flyer. 20x14
        droneA: {
            rows: [
                '..oooo......oooo....',
                '.o2222o....o2222o...',
                '..oooo......oooo....',
                '....o2o....o2o......',
                '...oo1oooooo1oo.....',
                '..o111111111111o....',
                '.o11111111111111o...',
                '.o11eEE1111EEe11o...',
                '.o11111111111111o...',
                '..o11122211111o.....',
                '...oo1111111oo......',
                '.....ooooooo........',
                '......o333o.........',
                '.......ooo..........'
            ]
        },
        droneB: {
            rows: [
                '...oo........oo.....',
                '..o22o......o22o....',
                '...oo........oo.....',
                '....o2o....o2o......',
                '...oo1oooooo1oo.....',
                '..o111111111111o....',
                '.o11111111111111o...',
                '.o11eEE1111EEe11o...',
                '.o11111111111111o...',
                '..o11122211111o.....',
                '...oo1111111oo......',
                '.....ooooooo........',
                '......o333o.........',
                '.......ooo..........'
            ]
        },
        // Sentry — stationary turret, spiked top. 20x24
        sentry: {
            rows: [
                '...o..o....o..o.....',
                '..o3oo3oooo3oo3o....',
                '..o333333333333o....',
                '.o33333333333333o...',
                '.o33111111113333o...',
                '.o331eEE11eEE133o...',
                '.o33111111111133o...',
                '.o33111111111133o...',
                '.o33333333333333o...',
                '..o333333333333o....',
                '...oo33333333oo.....',
                '.....o333333o.......',
                '....o222222o........',
                '...o22222222o.......',
                '..o2222222222o......',
                '..o2211111122o......',
                '..o2222222222o......',
                '...o22222222o.......',
                '....oooooooo........',
                '...o22o..o22o.......',
                '..o2222oo2222o......',
                '..o2222oo2222o......',
                '...oooo..oooo.......',
                '....................'
            ]
        },
        // Shredder — invulnerable rotating hazard. 18x18
        sawA: {
            rows: [
                '.......oo.........',
                '......o22o........',
                '..o...o22o...o....',
                '.o2oooo22oooo2o...',
                '.o222222222222o...',
                '..o22222222222o...',
                'oo222222222222oo..',
                'o22222oooo22222o..',
                'o2222o1111o2222o..',
                'o2222o1111o2222o..',
                'o22222oooo22222o..',
                'oo222222222222oo..',
                '..o22222222222o...',
                '.o222222222222o...',
                '.o2oooo22oooo2o...',
                '..o...o22o...o....',
                '......o22o........',
                '.......oo.........'
            ]
        }
    };

    const ENEMY_PALETTES = {
        bug: {
            o: OUTLINE,
            1: '#8b5cf6',
            2: '#6d28d9',
            3: '#c4b5fd',
            e: '#ffffff',
            E: '#1b1b26'
        },
        hopper: {
            o: OUTLINE,
            1: '#f97362',
            2: '#c8402f',
            3: '#ffb3a5',
            e: '#ffffff',
            E: '#1b1b26'
        },
        drone: {
            o: OUTLINE,
            1: '#3fb9c9',
            2: '#9be7f2',
            3: '#ffd166',
            e: '#ffffff',
            E: '#1b1b26'
        },
        sentry: {
            o: OUTLINE,
            1: '#ffd166',
            2: '#5b6478',
            3: '#8e99b0',
            e: '#ffffff',
            E: '#1b1b26'
        },
        saw: {
            o: OUTLINE,
            1: '#ffd166',
            2: '#aab4c8',
            3: '#e2e8f5',
            e: '#ffffff',
            E: '#1b1b26'
        }
    };

    /* ----------------------------------------------------------------- props */

    const PROPS = {
        coin: {
            rows: [
                '...ooooo...',
                '..o11111o..',
                '.o1122111o.',
                'o112211111o',
                'o112o1o111o',
                'o112o1o111o',
                'o112o1o111o',
                'o112211111o',
                '.o1122111o.',
                '..o11111o..',
                '...ooooo...'
            ],
            palette: { o: '#7a4a06', 1: '#ffd23d', 2: '#fff3b0' }
        }
    };

    function prop(key) {
        const def = PROPS[key];
        if (!def) return null;
        return bake('prop:' + key, def.rows, def.palette);
    }

    function enemy(spriteKey, paletteKey) {
        const def = ENEMY_SPRITES[spriteKey];
        if (!def) return null;
        return bake('enemy:' + spriteKey + ':' + paletteKey, def.rows, ENEMY_PALETTES[paletteKey]);
    }

    AMO.sprites = {
        bake,
        character,
        enemy,
        prop,
        characters: CHARACTERS,
        characterIds: Object.keys(CHARACTERS)
    };
})(window);
