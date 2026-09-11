const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const urls = ['https://www.linkedin.com/in/ashleymoran', 'https://x.com/amoranio', 'https://github.com/amoranio', 'https://exnoscan.com', 'https://clearqr.exnoscan.com', 'https://amoranio.github.io/badMCP'];

test('the arcade homepage retains every existing link', () => {
    for (const file of ['index.html']) for (const url of urls) assert.ok(read(file).includes(`href="${url}"`), `${file}: ${url}`);
});
test('all local HTML and CSS asset references exist, with no duplicate IDs', () => {
    for (const file of ['index.html', 'professional.html', 'play.html', 'css/arcade.css']) {
        const content = read(file).replace(/url\("data:[^"]*"\)/g, '');
        const ids = [...content.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
        assert.equal(ids.length, new Set(ids).size, `Duplicate ID in ${file}`);
        const refs = [...content.matchAll(/(?:src|href)="([^"]+)"|url\(['"]?([^'"\)]+)['"]?\)/g)].map(m => m[1] || m[2]);
        for (const ref of refs) {
            if (/^(?:https?:|data:|#)/.test(ref)) continue;
            const clean = ref.split(/[?#]/)[0];
            assert.ok(fs.existsSync(path.resolve(root, path.dirname(file), clean)), `Missing ${ref} from ${file}`);
        }
    }
});
test('old preference values cannot redirect the homepage and optional storage may be blocked', () => {
    for (const blocked of [false, true]) {
        const values = new Map([['amoran-persona', 'professional'], ['amoran-theme', 'anime'], ['amoran-best-snake-classic', '80']]);
        const context = { window: {}, location: { replace() { assert.fail('Homepage must not redirect'); } }, localStorage: {
            getItem(key) { if (blocked) throw Error('blocked'); return values.get(key); },
            setItem(key, value) { if (blocked) throw Error('blocked'); values.set(key, value); },
            removeItem(key) { if (blocked) throw Error('blocked'); values.delete(key); }
        }, document: { querySelectorAll: () => [] } };
        vm.runInNewContext(read('js/site.js'), context);
        assert.equal(context.window.amoranStorage.get('amoran-best-snake-classic'), blocked ? null : '80');
        assert.doesNotThrow(() => context.window.amoranStorage.set('amoran-mute', '1'));
        if (!blocked) { assert.equal(values.has('amoran-persona'), false); assert.equal(values.has('amoran-theme'), false); }
    }
});
test('old page bookmarks lead to the single homepage', () => {
    for (const file of ['professional.html', 'play.html']) {
        assert.ok(read(file).includes('content="0; url=index.html"'));
        assert.ok(read(file).includes('href="index.html"'));
    }
    assert.ok(read('index.html').includes('id="gameCanvas"'));
    assert.ok(!read('index.html').includes('http-equiv="refresh"'));
});

test('HTML tag structure is balanced and interactive elements are not nested', () => {
    const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
    for (const file of ['index.html', 'professional.html', 'play.html']) {
        const stack = [];
        for (const match of read(file).matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/g)) {
            const [, closing, tag] = match;
            if (voids.has(tag) || match[0].endsWith('/>')) continue;
            if (closing) assert.equal(stack.pop(), tag, `Unbalanced closing ${tag} in ${file}`);
            else {
                if (['a', 'button'].includes(tag)) assert.ok(!stack.some(t => ['a','button'].includes(t)), `Nested interactive ${tag} in ${file}`);
                stack.push(tag);
            }
        }
        assert.deepEqual(stack, [], file);
    }
});
