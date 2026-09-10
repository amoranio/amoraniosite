const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const urls = ['https://www.linkedin.com/in/ashleymoran', 'https://x.com/amoranio', 'https://github.com/amoranio', 'https://exnoscan.com', 'https://clearqr.exnoscan.com', 'https://amoranio.github.io/badMCP'];

test('both personas retain every existing link', () => {
    for (const file of ['professional.html', 'play.html']) for (const url of urls) assert.ok(read(file).includes(`href="${url}"`), `${file}: ${url}`);
});
test('all local HTML and CSS asset references exist, with no duplicate IDs', () => {
    for (const file of ['index.html', 'professional.html', 'play.html', 'css/site.css', 'css/style.css', 'css/arcade.css']) {
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
function personaContext(saved, search = '', blocked = false) {
    let redirect;
    const listeners = [];
    const checkbox = {checked: true};
    const store = new Map(saved ? [['amoran-persona', saved]] : []);
    const storage = {getItem: k => {if (blocked) throw Error('disabled'); return store.get(k);}, setItem: (k,v) => {if (blocked) throw Error('disabled'); store.set(k,v);}, removeItem: k => {if (blocked) throw Error('disabled'); store.delete(k);}};
    const context = {window: {}, URLSearchParams, location: {search, replace: value => {redirect = value;}}, localStorage: storage, document: {body: {dataset: {page: 'chooser'}}, getElementById: () => checkbox, querySelectorAll: selector => selector === '[data-persona]' ? [{dataset: {persona: 'play'}, addEventListener: (_, callback) => listeners.push(callback)}] : []}};
    vm.runInNewContext(read('js/site.js'), context);
    return {get redirect() {return redirect;}, listeners, checkbox, store};
}
test('first visit offers a choice, remembered persona routes only to valid local pages', () => {
    assert.equal(personaContext().redirect, undefined);
    assert.equal(personaContext('play').redirect, 'play.html');
    assert.equal(personaContext('professional').redirect, 'professional.html');
    assert.equal(personaContext('https://evil.example').redirect, undefined);
    assert.equal(personaContext('play', '?choose').redirect, undefined);
});
test('remember can be enabled, disabled, or unavailable without breaking navigation', () => {
    const c = personaContext();
    c.listeners[0](); assert.equal(c.store.get('amoran-persona'), 'play');
    c.checkbox.checked = false;
    c.listeners[0](); assert.equal(c.store.has('amoran-persona'), false);
    assert.doesNotThrow(() => personaContext('play', '', true).listeners[0]());
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
