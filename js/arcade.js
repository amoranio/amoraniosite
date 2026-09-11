(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const core = window.ArcadeCore;
    const storage = window.amoranStorage;
    const portal = $('gamePortal');
    const sessions = {};
    let resumeMiniOnClose = false;
    let selected = 'platformer';
    let mode = 'classic';
    let snake = core.createSnake();
    let memory = core.createMemory();
    let running = false;
    let paused = false;
    let snakeTimer = null;
    const memoryTimers = new Set();
    const pads = [];
    const canvas = $('snakeCanvas');
    const ctx = canvas.getContext('2d');
    const descriptions = {
        platformer: {classic: 'Three lives. Three worlds. Collect coins and reach the flag.', overclock: '90 seconds per world. Faster runners and bots. Start with the pulse weapon.', training: 'No damage or life loss. Start armed and explore at your own pace.'},
        snake: {classic: 'Collect packets, grow your trace, and avoid walls and your tail.', overclock: 'Faster packets. The route gets quicker as your score grows.', training: 'A slower pace. Wrap through walls; your own trace still ends the run.'},
        memory: {classic: 'Watch the sequence, then repeat it. Each round adds one more node.', overclock: 'Shorter signals. The same growing sequence, with less time to memorise it.', training: 'Slower signals. A missed node replays the same sequence for another try.'}
    };
    const notes = {
        platformer: 'WASD / arrows to move · Space to jump · F to fire after collecting the pulse star. Hit question blocks to open links.',
        snake: 'Arrow keys or WASD to steer. Touch the direction buttons on mobile. Each packet adds 10 points.',
        memory: 'Watch the numbered nodes, then repeat their order. Click, tap, or press 1–9.'
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
        const accent = '#8ef5ac';
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
            ctx.fillStyle = '#8ef5ac';
            ctx.fillRect(snake.food.x * 20 + 4, snake.food.y * 20 + 4, 12, 12);
            ctx.strokeStyle = '#8ef5ac';
            ctx.strokeRect(snake.food.x * 20 + 1, snake.food.y * 20 + 1, 18, 18);
        }
    }
    function finish(message) {
        running = false;
        paused = false;
        clearTimers();
        lockPads(true);
        $('miniStatus').textContent = message;
        $('miniStart').textContent = 'Play again';
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
        if (selected === 'snake') snake = core.createSnake(mode);
        if (selected === 'memory') memory = core.createMemory(mode);
        lockPads(true);
        $('miniStart').hidden = false;
        $('miniStart').textContent = 'Start game';
        $('miniStatus').textContent = selected === 'snake' ? 'Collect packets. Avoid the walls and your tail.' : 'Watch the numbers, then repeat the sequence.';
        $('pauseGame').textContent = 'Pause';
        score(0);
        drawSnake();
    }
    function startMini() {
        resetMini();
        running = true;
        $('miniStart').hidden = true;
        if (selected === 'snake') {
            $('miniStatus').textContent = 'Collect the green packets.';
            canvas.focus({preventScroll: true});
            snakeTimer = setTimeout(snakeStep, core.snakeDelay(mode, 0));
        } else nextRound();
    }
    function pauseMini(force = false) {
        if (!running || (force && paused)) return;
        paused = force || !paused;
        clearTimers();
        $('pauseGame').textContent = paused ? 'Resume' : 'Pause';
        $('miniStart').hidden = !paused;
        $('miniStart').textContent = 'Resume';
        if (paused) { lockPads(true); $('miniStatus').textContent = 'Paused'; }
        else if (selected === 'snake') {
            $('miniStatus').textContent = 'Collect the green packets.';
            canvas.focus({preventScroll: true});
            snakeTimer = setTimeout(snakeStep, core.snakeDelay(mode, snake.score));
        } else if (memory.phase === 'complete' || memory.round === 0) nextRound();
        else replayMemory();
    }
    function describe() {
        $('modeDescription').textContent = descriptions[selected][mode];
        $('fieldNote').textContent = notes[selected];
    }
    function previewGames() {
        window.Platformer.preview($('runnerPreview'));
        $('snakePreview').getContext('2d').drawImage(canvas, 0, 0, 480, 240);
        const preview = $('memoryPreview').getContext('2d');
        preview.fillStyle = '#030b10'; preview.fillRect(0, 0, 480, 240);
        for (let i = 0; i < 9; i++) {
            const x = 65 + (i % 3) * 120, y = 12 + Math.floor(i / 3) * 75;
            preview.fillStyle = pads[i].classList.contains('lit') ? '#8ef5ac' : '#142c24';
            preview.fillRect(x, y, 110, 65);
            preview.fillStyle = '#c4e2d3'; preview.font = '18px monospace'; preview.textAlign = 'center';
            preview.fillText(String(i + 1).padStart(2, '0'), x + 55, y + 39);
        }
    }
    function openPortal() {
        if (portal.open || $('linkDialog').open) return;
        resumeMiniOnClose = selected !== 'platformer' && running && !paused;
        window.Platformer.setMenuOpen(true);
        if (selected !== 'platformer') {
            pauseMini(true);
            $('pauseGame').textContent = running && !resumeMiniOnClose ? 'Resume' : 'Pause';
        }
        previewGames();
        portal.showModal();
        $('portalTrigger').setAttribute('aria-expanded', 'true');
        document.querySelectorAll('[data-game]').forEach(button => {
            if (button.dataset.game === selected) button.focus({preventScroll: true});
        });
    }
    function closePortal(resume = true) {
        if (portal.open) portal.close();
        $('portalTrigger').setAttribute('aria-expanded', 'false');
        window.Platformer.setMenuOpen(false);
        if (resume && resumeMiniOnClose && selected !== 'platformer' && running && paused) pauseMini();
        else if (selected !== 'platformer') {
            if (!running || paused) $('miniStart').focus({preventScroll: true});
            else if (selected === 'snake') canvas.focus({preventScroll: true});
        }
        resumeMiniOnClose = false;
    }
    $('portalTrigger').addEventListener('click', openPortal);
    $('closePortal').addEventListener('click', () => closePortal());
    portal.addEventListener('cancel', e => { e.preventDefault(); closePortal(); });
    portal.addEventListener('click', e => {
        if (e.target !== portal) return;
        const rect = portal.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closePortal();
    });
    function chooseGame(game) {
        if (game === selected) { closePortal(); return; }
        if (selected !== 'platformer') {
            sessions[selected] = {state: selected === 'snake' ? snake : memory, running, paused: portal.open ? !resumeMiniOnClose : paused};
        }
        clearTimers();
        closePortal(false);
        selected = game;
        $('platformerPanel').hidden = game !== 'platformer';
        $('miniPanel').hidden = game === 'platformer';
        $('runnerSettings').hidden = game !== 'platformer';
        $('snakeSurface').hidden = game !== 'snake';
        $('snakeControls').hidden = game !== 'snake';
        $('memorySurface').hidden = game !== 'memory';
        $('miniTitle').textContent = titles[game];
        window.Platformer.setEnabled(game === 'platformer');
        document.querySelectorAll('[data-game]').forEach(button => {
            button.classList.toggle('selected', button.dataset.game === game);
            button.setAttribute('aria-pressed', String(button.dataset.game === game));
        });
        if (game === 'platformer') {
            running = paused = false;
            $('pauseGame').textContent = window.Platformer.isPaused() ? 'Resume' : 'Pause';
        } else if (sessions[game]) {
            const saved = sessions[game];
            if (game === 'snake') snake = saved.state;
            else memory = saved.state;
            running = saved.running;
            paused = true;
            score(game === 'snake' ? snake.score : Math.max(0, memory.round - (memory.phase === 'complete' ? 0 : 1)));
            drawSnake();
            $('miniStart').hidden = false;
            $('miniStart').textContent = running ? 'Resume' : 'Play again';
            $('miniStatus').textContent = running ? 'Paused' : 'Start another run.';
            $('pauseGame').textContent = running ? 'Resume' : 'Pause';
            if (running && !saved.paused) pauseMini();
            else $('miniStart').focus({preventScroll: true});
        } else startMini();
        describe();
    }
    document.querySelectorAll('[data-game]').forEach(button => button.addEventListener('click', () => chooseGame(button.dataset.game)));
    $('modeSelect').addEventListener('change', e => {
        mode = e.target.value;
        for (const key of Object.keys(sessions)) delete sessions[key];
        window.Platformer.setMode(mode);
        if (selected !== 'platformer') {
            resetMini();
            if (portal.open) { running = paused = true; resumeMiniOnClose = true; }
            else startMini();
        }
        describe();
    });
    $('restartGame').addEventListener('click', () => {
        closePortal(false);
        if (selected === 'platformer') window.Platformer.restart();
        else { delete sessions[selected]; startMini(); }
    });
    $('pauseGame').addEventListener('click', () => {
        // Opening the portal suspends a live mini-game without changing whether
        // it should resume. The explicit Pause button changes that intention.
        const shouldResume = portal.open && selected !== 'platformer' ? !resumeMiniOnClose : paused;
        closePortal(false);
        if (selected === 'platformer') window.Platformer.togglePause();
        else if (running && paused === shouldResume) pauseMini();
    });
    ['settingsBtn', 'sitesBtn'].forEach(id => $(id).addEventListener('click', () => closePortal(false)));
    $('miniStart').addEventListener('click', () => running && paused ? pauseMini() : startMini());
    document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => {
        if (running && !paused && selected === 'snake') core.turnSnake(snake, button.dataset.direction);
    }));
    const directions = {ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'};
    document.addEventListener('keydown', e => {
        if (e.code === 'KeyG' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName)) {
            e.preventDefault();
            if (portal.open) closePortal(); else openPortal();
            return;
        }
        if (portal.open || $('linkDialog').open) return;
        if (e.code === 'Escape' && !e.repeat) {
            if (selected !== 'platformer') pauseMini();
            return;
        }
        if (/^(SELECT|INPUT|TEXTAREA|A)$/.test(e.target.tagName)) return;
        if (selected === 'snake' && running && !paused && document.activeElement === canvas && directions[e.code]) {
            e.preventDefault(); core.turnSnake(snake, directions[e.code]);
        }
        if (selected === 'memory' && /^Digit[1-9]$/.test(e.code) && !e.repeat) { e.preventDefault(); choosePad(Number(e.code.slice(-1)) - 1); }
    });
    function suspend() { resumeMiniOnClose = false; clearTimers(); if (selected !== 'platformer') pauseMini(true); window.Platformer.pause(); }
    window.addEventListener('blur', suspend);
    window.addEventListener('pagehide', suspend);
    document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
    drawSnake();
})();
