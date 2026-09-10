/* Pure game rules shared by the arcade UI and Node tests. No network or DOM access. */
(function (root, factory) {
    const core = factory();
    if (typeof module === 'object' && module.exports) module.exports = core;
    else root.ArcadeCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';
    const DIRECTIONS = { up: {x: 0, y: -1}, down: {x: 0, y: 1}, left: {x: -1, y: 0}, right: {x: 1, y: 0} };
    function placeFood(state, random = Math.random) {
        const free = [];
        for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) {
            if (!state.snake.some(p => p.x === x && p.y === y)) free.push({x, y});
        }
        return free.length ? free[Math.min(free.length - 1, Math.floor(random() * free.length))] : null;
    }
    function createSnake(mode = 'classic', random = Math.random) {
        const state = { cols: 30, rows: 20, snake: [{x: 6, y: 10}, {x: 5, y: 10}, {x: 4, y: 10}], direction: 'right', queued: null, score: 0, alive: true, won: false, mode };
        state.food = placeFood(state, random);
        return state;
    }
    function turnSnake(state, direction) {
        if (!state.alive || state.queued || !DIRECTIONS[direction]) return false;
        const a = DIRECTIONS[state.direction], b = DIRECTIONS[direction];
        if (a.x + b.x === 0 && a.y + b.y === 0) return false;
        state.queued = direction;
        return true;
    }
    function stepSnake(state, random = Math.random) {
        if (!state.alive) return state;
        state.direction = state.queued || state.direction;
        state.queued = null;
        const dir = DIRECTIONS[state.direction];
        const head = {x: state.snake[0].x + dir.x, y: state.snake[0].y + dir.y};
        if (state.mode === 'training') {
            head.x = (head.x + state.cols) % state.cols;
            head.y = (head.y + state.rows) % state.rows;
        }
        const eats = state.food && head.x === state.food.x && head.y === state.food.y;
        const body = eats ? state.snake : state.snake.slice(0, -1);
        if (head.x < 0 || head.x >= state.cols || head.y < 0 || head.y >= state.rows || body.some(p => p.x === head.x && p.y === head.y)) {
            state.alive = false;
            return state;
        }
        state.snake.unshift(head);
        if (eats) {
            state.score += 10;
            state.food = placeFood(state, random);
            if (!state.food) { state.won = true; state.alive = false; }
        } else state.snake.pop();
        return state;
    }
    function snakeDelay(mode, score) {
        return mode === 'training' ? 180 : Math.max(60, (mode === 'overclock' ? 105 : 155) - Math.floor(score / 30) * 5);
    }
    function createMemory(mode = 'classic') { return { sequence: [], cursor: 0, round: 0, phase: 'idle', mode }; }
    function nextMemoryRound(state, random = Math.random) {
        state.sequence.push(Math.min(8, Math.floor(random() * 9)));
        state.cursor = 0;
        state.round++;
        state.phase = 'showing';
    }
    function inputMemory(state, pad) {
        if (state.phase !== 'input') return 'ignored';
        if (state.sequence[state.cursor] !== pad) {
            state.cursor = 0;
            state.phase = state.mode === 'training' ? 'retry' : 'over';
            return state.phase;
        }
        state.cursor++;
        if (state.cursor === state.sequence.length) { state.phase = 'complete'; return 'complete'; }
        return 'correct';
    }
    return { createSnake, placeFood, turnSnake, stepSnake, snakeDelay, createMemory, nextMemoryRound, inputMemory };
});
