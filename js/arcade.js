(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const core = window.ArcadeCore;
    const storage = window.amoranStorage;
    let selected = 'platformer';
    let mode = 'classic';
    let snake = core.createSnake();
    let memory = core.createMemory();
    let running = false;
    let paused = false;
    let snakeTimer = null;
    const memoryTimers = new Set();
    let corruptionTimer = null;
    const pads = [];
    const canvas = $('snakeCanvas');
    const ctx = canvas.getContext('2d');
    const descriptions = {
        platformer: {classic: 'Three lives. Explore all three worlds and unlock the links.', overclock: '90 seconds per world. Faster runners and bots. Start with the pulse weapon.', training: 'No damage or life loss. Start armed and explore at your own pace.'},
        snake: {classic: 'Collect packets, grow your trace, and avoid walls and your tail.', overclock: 'Faster packets. The route gets quicker as your score grows.', training: 'A slower pace. Wrap through walls; your own trace still ends the run.'},
        memory: {classic: 'Watch the sequence, then repeat it. Each round adds one more node.', overclock: 'Shorter signals. The same growing sequence, with less time to memorise it.', training: 'Slower signals. A missed node replays the same sequence for another try.'}
    };
    const notes = {
        platformer: 'Collect the pulse star to fire. Every question block leads to a real project or profile.',
        snake: 'Arrow keys or WASD to steer. Touch the direction buttons on mobile. Each packet adds 10 points.',
        memory: 'Watch the numbered nodes light up, then repeat their order. Click, tap, or press 1–9. This is a memory game, not a real AI attack.'
    };
    const titles = {platformer: 'BLOCK RUNNER', snake: 'PACKET SNAKE', memory: 'NEURAL BREACH'};
    const bestKey = () => `amoran-best-${selected}-${mode}`;
    const readBest = () => Math.max(0, Number(storage.get(bestKey())) || 0);
    function score(value) {
        if (value > readBest()) storage.set(bestKey(), String(value));
        $('miniScore').textContent = (selected === 'memory' ? 'ROUNDS ' : 'SCORE ') + value;
        $('miniBest').textContent = 'BEST ' + Math.max(value, readBest());
    }
    function later(fn, delay) {
        const timer = setTimeout(() => { memoryTimers.delete(timer); fn(); }, delay);
        memoryTimers.add(timer);
    }
    function clearTimers() {
        clearTimeout(snakeTimer);
        snakeTimer = null;
        memoryTimers.forEach(clearTimeout);
        memoryTimers.clear();
        pads.forEach(p => p.classList.remove('lit'));
    }
    function lockPads(locked) { pads.forEach(p => { p.disabled = locked; }); }
    function drawSnake() {
        const accent = document.body.dataset.theme === 'anime' ? '#dcafff' : document.body.dataset.theme === 'classic' ? '#ffd24a' : '#c3f87c';
        ctx.fillStyle = '#091015';
        ctx.fillRect(0, 0, 600, 400);
        ctx.strokeStyle = '#1d2c2c'; ctx.lineWidth = 1;
        for (let x = 0; x <= 600; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 400); ctx.stroke(); }
        for (let y = 0; y <= 400; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke(); }
        snake.snake.forEach((p, i) => {
            ctx.fillStyle = i === 0 ? '#e9ffe1' : accent;
            ctx.globalAlpha = i === 0 ? 1 : .75;
            ctx.fillRect(p.x * 20 + 2, p.y * 20 + 2, 16, 16);
        });
        ctx.globalAlpha = 1;
        if (snake.food) {
            ctx.fillStyle = '#e3a2ff';
            ctx.fillRect(snake.food.x * 20 + 4, snake.food.y * 20 + 4, 12, 12);
            ctx.strokeStyle = '#e3a2ff';
            ctx.strokeRect(snake.food.x * 20 + 1, snake.food.y * 20 + 1, 18, 18);
        }
    }
    function finish(message) {
        running = false;
        paused = false;
        clearTimers();
        lockPads(true);
        $('miniStatus').textContent = message;
        $('miniStart').textContent = 'Play again →';
        $('miniStart').hidden = false;
        $('pauseGame').textContent = 'Pause';
        $('miniStart').focus({preventScroll: true});
    }
    function snakeStep() {
        if (!running || paused || selected !== 'snake') return;
        core.stepSnake(snake);
        score(snake.score);
        drawSnake();
        if (!snake.alive) { finish(snake.won ? 'Network mapped. Every packet collected.' : `Trace lost. ${snake.score} points. Try another route.`); return; }
        snakeTimer = setTimeout(snakeStep, core.snakeDelay(mode, snake.score));
    }
    function replayMemory() {
        clearTimers();
        lockPads(true);
        memory.phase = 'showing';
        memory.cursor = 0;
        $('miniStatus').textContent = `Round ${memory.round} · Watch the sequence.`;
        const spacing = mode === 'overclock' ? 480 : mode === 'training' ? 1000 : 760;
        memory.sequence.forEach((pad, i) => {
            later(() => pads[pad].classList.add('lit'), 450 + i * spacing);
            later(() => pads[pad].classList.remove('lit'), 450 + i * spacing + spacing * .6);
        });
        later(() => {
            memory.phase = 'input';
            lockPads(false);
            $('miniStatus').textContent = `Your turn · Repeat ${memory.sequence.length} node${memory.sequence.length === 1 ? '' : 's'}.`;
            pads[0].focus({preventScroll: true});
        }, 450 + memory.sequence.length * spacing);
    }
    function nextRound() { core.nextMemoryRound(memory); replayMemory(); }
    function choosePad(index) {
        if (!running || paused || selected !== 'memory') return;
        const result = core.inputMemory(memory, index);
        if (result === 'ignored') return;
        pads[index].classList.add('lit');
        later(() => pads[index].classList.remove('lit'), 180);
        if (result === 'over') {
            score(memory.round - 1);
            finish(`Connection lost. ${memory.round - 1} round${memory.round === 2 ? '' : 's'} completed.`);
        } else if (result === 'retry') {
            lockPads(true);
            $('miniStatus').textContent = 'Training · Watch this sequence once more.';
            later(replayMemory, 1000);
        } else if (result === 'complete') {
            score(memory.round);
            lockPads(true);
            $('miniStatus').textContent = `Layer ${memory.round} breached. Next sequence incoming…`;
            later(nextRound, 950);
        } else $('miniStatus').textContent = `Sequence ${memory.cursor} / ${memory.sequence.length}`;
    }
    for (let i = 0; i < 9; i++) {
        const pad = document.createElement('button');
        pad.className = 'memory-pad';
        pad.type = 'button';
        pad.textContent = String(i + 1).padStart(2, '0');
        pad.setAttribute('aria-label', 'Node ' + (i + 1));
        pad.disabled = true;
        pad.addEventListener('click', () => choosePad(i));
        $('memoryGrid').append(pad);
        pads.push(pad);
    }
    function resetMini() {
        clearTimers();
        running = paused = false;
        snake = core.createSnake(mode);
        memory = core.createMemory(mode);
        lockPads(true);
        $('miniStart').hidden = false;
        $('miniStart').textContent = 'Start run →';
        $('miniStatus').textContent = selected === 'snake' ? 'Route the packets. Don’t cross your own trace.' : 'Watch the nodes. Repeat the sequence. Breach the next layer.';
        $('pauseGame').textContent = 'Pause';
        score(0);
        drawSnake();
    }
    function startMini() {
        resetMini();
        running = true;
        $('miniStart').hidden = true;
        if (selected === 'snake') {
            $('miniStatus').textContent = 'Route active · Collect the violet packets.';
            canvas.focus({preventScroll: true});
            snakeTimer = setTimeout(snakeStep, core.snakeDelay(mode, 0));
        } else nextRound();
    }
    function pauseMini(force = false) {
        if (!running || (force && paused)) return;
        paused = force || !paused;
        clearTimers();
        $('pauseGame').textContent = paused ? 'Resume' : 'Pause';
        if (paused) { lockPads(true); $('miniStatus').textContent = 'Paused · Resume when you’re ready.'; }
        else if (selected === 'snake') {
            $('miniStatus').textContent = 'Route active · Collect the violet packets.';
            canvas.focus({preventScroll: true});
            snakeTimer = setTimeout(snakeStep, core.snakeDelay(mode, snake.score));
        } else if (memory.phase === 'complete') nextRound();
        else replayMemory();
    }
    function describe() {
        $('modeDescription').textContent = `${mode[0].toUpperCase() + mode.slice(1)} · ${descriptions[selected][mode]}`;
        $('fieldNote').textContent = notes[selected];
    }
    function chooseGame(game) {
        selected = game;
        window.Platformer.setEnabled(game === 'platformer');
        $('platformerPanel').hidden = game !== 'platformer';
        $('miniPanel').hidden = game === 'platformer';
        $('snakeSurface').hidden = game !== 'snake';
        $('snakeControls').hidden = game !== 'snake';
        $('memorySurface').hidden = game !== 'memory';
        $('miniTitle').textContent = titles[game];
        document.querySelectorAll('[data-game]').forEach(button => {
            button.classList.toggle('selected', button.dataset.game === game);
            button.setAttribute('aria-pressed', String(button.dataset.game === game));
        });
        resetMini();
        if (game === 'platformer') $('pauseGame').textContent = window.Platformer.isPaused() ? 'Resume' : 'Pause';
        describe();
        restoreCorruption();
    }
    document.querySelectorAll('[data-game]').forEach(button => button.addEventListener('click', () => chooseGame(button.dataset.game)));
    $('modeSelect').addEventListener('change', e => {
        mode = e.target.value;
        window.Platformer.setMode(mode);
        resetMini();
        describe();
    });
    function setTheme(theme) {
        if (!['neon', 'anime', 'classic'].includes(theme)) theme = 'neon';
        document.body.dataset.theme = theme;
        $('themeSelect').value = theme;
        window.Platformer.setTheme(theme);
        storage.set('amoran-theme', theme);
        drawSnake();
    }
    $('themeSelect').addEventListener('change', e => setTheme(e.target.value));
    $('restartGame').addEventListener('click', () => {
        restoreCorruption();
        if (selected === 'platformer') window.Platformer.restart();
        else resetMini();
    });
    $('pauseGame').addEventListener('click', () => selected === 'platformer' ? window.Platformer.togglePause() : pauseMini());
    $('miniStart').addEventListener('click', startMini);
    document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => {
        if (running && !paused && selected === 'snake') core.turnSnake(snake, button.dataset.direction);
    }));
    const directions = {ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'};
    document.addEventListener('keydown', e => {
        if (e.code === 'Escape') {
            restoreCorruption();
            if (selected !== 'platformer') pauseMini();
            return;
        }
        if (/^(SELECT|INPUT|TEXTAREA|A)$/.test(e.target.tagName)) return;
        if (selected === 'snake' && running && !paused && document.activeElement === canvas && directions[e.code]) {
            e.preventDefault(); core.turnSnake(snake, directions[e.code]);
        }
        if (selected === 'memory' && /^Digit[1-9]$/.test(e.code) && !e.repeat) { e.preventDefault(); choosePad(Number(e.code.slice(-1)) - 1); }
    });
    function restoreCorruption() {
        clearTimeout(corruptionTimer);
        const restoreFocused = document.activeElement === $('restorePage');
        document.body.classList.remove('is-corrupt');
        $('corruptionLayer').hidden = true;
        $('restorePage').hidden = true;
        $('corruptToggle').setAttribute('aria-pressed', 'false');
        $('corruptToggle').textContent = 'Corrupt: OFF';
        if (restoreFocused) $('corruptToggle').focus({preventScroll: true});
    }
    $('corruptToggle').addEventListener('click', () => {
        if (!$('corruptionLayer').hidden) { restoreCorruption(); return; }
        document.body.classList.add('is-corrupt');
        $('corruptionLayer').hidden = false;
        $('restorePage').hidden = false;
        $('corruptToggle').setAttribute('aria-pressed', 'true');
        $('corruptToggle').textContent = 'Corrupt: ON';
        $('corruptionLog').textContent = '> sandbox boundary: decorative\n> rendering rogue pixels…\n> reality: unaffected_';
        corruptionTimer = setTimeout(() => {
            $('corruptionLog').textContent = '> containment: artistically compromised\n> rogue pixels entered the page\n> restore available / ESC_';
        }, 3500);
    });
    $('restorePage').addEventListener('click', restoreCorruption);
    function suspend() { clearTimers(); if (selected !== 'platformer') pauseMini(true); window.Platformer.pause(); restoreCorruption(); }
    window.addEventListener('blur', suspend);
    window.addEventListener('pagehide', suspend);
    document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
    setTheme(storage.get('amoran-theme') || 'neon');
    drawSnake();
})();
