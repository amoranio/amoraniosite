const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/arcade-core.js');

test('snake grows and scores only when a packet is collected', () => {
    const s = core.createSnake();
    s.food = {x: 7, y: 10};
    core.stepSnake(s, () => 0);
    assert.equal(s.score, 10);
    assert.equal(s.snake.length, 4);
    assert.ok(!s.snake.some(p => p.x === s.food.x && p.y === s.food.y));
    core.stepSnake(s);
    assert.equal(s.snake.length, 4);
    assert.equal(s.score, 10);
});
test('snake prevents reversals and multiple turns within one tick', () => {
    const s = core.createSnake();
    assert.equal(core.turnSnake(s, 'left'), false);
    assert.equal(core.turnSnake(s, 'up'), true);
    assert.equal(core.turnSnake(s, 'left'), false);
    core.stepSnake(s);
    assert.deepEqual(s.snake[0], {x: 6, y: 9});
    assert.equal(core.turnSnake(s, 'left'), true);
});
test('classic walls end a run; training wraps without ending it', () => {
    for (const mode of ['classic', 'training']) {
        const s = core.createSnake(mode);
        s.snake = [{x: 29, y: 0}];
        core.stepSnake(s);
        assert.equal(s.alive, mode === 'training');
        if (s.alive) assert.deepEqual(s.snake[0], {x: 0, y: 0});
    }
});
test('tail collision ends a run, but moving into a vacated tail cell is legal', () => {
    const s = core.createSnake();
    s.snake = [{x: 2, y: 2}, {x: 2, y: 3}, {x: 3, y: 3}, {x: 3, y: 2}];
    s.food = {x: 20, y: 15};
    core.stepSnake(s);
    assert.equal(s.alive, true);
    s.snake = [{x: 2, y: 2}, {x: 3, y: 2}, {x: 3, y: 3}, {x: 2, y: 3}];
    core.stepSnake(s);
    assert.equal(s.alive, false);
});
test('a full grid is a win and food placement cannot loop forever', () => {
    const s = {cols: 2, rows: 2, snake: [{x: 0, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}], direction: 'right', queued: null, food: {x: 1, y: 0}, score: 0, alive: true, mode: 'classic'};
    core.stepSnake(s);
    assert.equal(s.won, true);
    assert.equal(s.alive, false);
    assert.equal(s.food, null);
});
test('overclock is faster and training speed stays stable', () => {
    assert.ok(core.snakeDelay('overclock', 0) < core.snakeDelay('classic', 0));
    assert.equal(core.snakeDelay('training', 9000), 180);
    assert.equal(core.snakeDelay('overclock', 9000), 60);
});
test('memory ignores input during demonstration and advances after the whole sequence', () => {
    const s = core.createMemory();
    core.nextMemoryRound(s, () => .4);
    assert.equal(core.inputMemory(s, 3), 'ignored');
    s.phase = 'input';
    assert.equal(core.inputMemory(s, 3), 'complete');
    core.nextMemoryRound(s, () => .8);
    assert.deepEqual(s.sequence, [3, 7]);
    s.phase = 'input';
    assert.equal(core.inputMemory(s, 3), 'correct');
    assert.equal(core.inputMemory(s, 7), 'complete');
    assert.equal(s.round, 2);
});
test('memory mistakes end classic runs and replay training runs', () => {
    for (const mode of ['classic', 'overclock', 'training']) {
        const s = core.createMemory(mode);
        core.nextMemoryRound(s, () => 0);
        s.phase = 'input';
        assert.equal(core.inputMemory(s, 8), mode === 'training' ? 'retry' : 'over');
        assert.equal(s.cursor, 0);
        assert.deepEqual(s.sequence, [0]);
    }
});
