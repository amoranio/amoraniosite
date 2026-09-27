(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const profile = window.AMORAN_PROFILE || {};
    const person = profile.person || {};
    const work = profile.work || {};
    const skill = profile.skill || {};
    const CHATS = [
        { id: 'block-runner', slug: 'game', title: 'Block Runner', file: 'Block Runner', panel: 'panel-game', code: null, tail: 'Running', lang: 'Block Runner', game: true },
        { id: 'about.json', slug: 'about', title: 'About me', file: 'about.json', panel: 'panel-about', code: 'code-about', tail: 'about.json', lang: 'JSON' },
        { id: 'work.json', slug: 'work', title: 'Work', file: 'work.json', panel: 'panel-work', code: 'code-work', tail: 'work.json', lang: 'JSON' },
        { id: 'skills.md', slug: 'skills', title: 'Skills', file: 'skills.md', panel: 'panel-skills', code: 'code-skills', tail: 'skills.md', lang: 'Markdown' },
        { id: 'links.lnk', slug: 'links', title: 'Links', file: 'links.lnk', panel: 'panel-links', code: 'code-links', tail: 'links.lnk', lang: 'Shortcut' }
    ];
    const MODES = { classic: 'Classic', overclock: 'Overclock', training: 'Training' };
    let active = 'block-runner';
    let paletteIndex = 0;

    function esc(value) {
        return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }
    function safeUrl(url) {
        try {
            const parsed = new URL(String(url));
            if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
        } catch { /* Leave non-links as plain text. */ }
        return null;
    }
    function t(kind, text, href) {
        return href ? { kind, text, href } : { kind, text };
    }
    function q(value, href) {
        const text = '"' + String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
        return t('str', text, href || null);
    }
    function qUrl(url) {
        return q(url, safeUrl(url));
    }
    function line(indent, ...tokens) {
        return { indent, tokens };
    }
    function renderLines(lines) {
        return lines.map((entry, index) => {
            const indent = entry.indent || 0;
            const body = (entry.tokens || []).map(tok => {
                const cls = 'tok ' + (tok.kind || 'tx');
                if (tok.href) return `<a class="${cls}" href="${esc(tok.href)}" target="_blank" rel="noopener noreferrer">${esc(tok.text)}</a>`;
                return `<span class="${cls}">${esc(tok.text)}</span>`;
            }).join('');
            const caret = index === lines.length - 1 ? '<span class="caret" aria-hidden="true"></span>' : '';
            return `<div class="line" data-ln="${index + 1}"><span class="gutter" aria-hidden="true">${index + 1}</span><span class="source i${indent}" style="--indent:${indent}">${body}${caret}</span></div>`;
        }).join('');
    }
    function isPlain(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }
    function scalar(value) {
        if (value === null || value === undefined) return [t('bi', 'null')];
        if (typeof value === 'number' && Number.isFinite(value)) return [t('num', String(value))];
        if (typeof value === 'boolean') return [t('bi', value ? 'true' : 'false')];
        return [qUrl(String(value))];
    }
    function jsonKey(key) {
        return t('key', '"' + String(key).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
    }
    function emitKeyed(lines, indent, key, value, comma) {
        const keyTok = jsonKey(key);
        if (Array.isArray(value)) {
            if (!value.length) {
                lines.push(line(indent, keyTok, t('pn', ': []' + comma)));
                return;
            }
            lines.push(line(indent, keyTok, t('pn', ': [')));
            value.forEach((item, index) => emitJson(lines, indent + 1, item, index === value.length - 1 ? '' : ','));
            lines.push(line(indent, t('pn', ']' + comma)));
            return;
        }
        if (isPlain(value)) {
            const keys = Object.keys(value);
            if (!keys.length) {
                lines.push(line(indent, keyTok, t('pn', ': {}' + comma)));
                return;
            }
            lines.push(line(indent, keyTok, t('pn', ': {')));
            keys.forEach((child, index) => emitKeyed(lines, indent + 1, child, value[child], index === keys.length - 1 ? '' : ','));
            lines.push(line(indent, t('pn', '}' + comma)));
            return;
        }
        const tokens = [keyTok, t('pn', ': '), ...scalar(value)];
        if (comma) tokens.push(t('pn', comma));
        lines.push(line(indent, ...tokens));
    }
    function emitJson(lines, indent, value, suffix) {
        if (Array.isArray(value)) {
            if (!value.length) {
                lines.push(line(indent, t('pn', '[]' + suffix)));
                return;
            }
            lines.push(line(indent, t('pn', '[')));
            value.forEach((item, index) => emitJson(lines, indent + 1, item, index === value.length - 1 ? '' : ','));
            lines.push(line(indent, t('pn', ']' + suffix)));
            return;
        }
        if (isPlain(value)) {
            const keys = Object.keys(value);
            lines.push(line(indent, t('pn', '{')));
            if (!keys.length) lines.push(line(indent + 1, t('cm', '// EDIT')));
            keys.forEach((key, index) => emitKeyed(lines, indent + 1, key, value[key], index === keys.length - 1 ? '' : ','));
            lines.push(line(indent, t('pn', '}' + suffix)));
            return;
        }
        const tokens = scalar(value);
        if (suffix) tokens.push(t('pn', suffix));
        lines.push(line(indent, ...tokens));
    }
    function jsonDocument(value) {
        const lines = [line(0, t('cm', '// Edit js/profile.js'))];
        emitJson(lines, 0, value && typeof value === 'object' ? value : {}, '');
        return lines;
    }
    function heading(text) {
        const label = String(text || '').replace(/-/g, ' ');
        return label.charAt(0).toUpperCase() + label.slice(1);
    }
    function skillLines() {
        const lines = [
            line(0, t('pn', '---')),
            line(0, t('key', 'name'), t('pn', ': '), t('str', skill.name || 'ashley-moran')),
            line(0, t('key', 'description'), t('pn', ': '), q(skill.description || 'EDIT: when an agent should use this skill.')),
            line(0, t('pn', '---')),
            line(0),
            line(0, t('hd', '# ' + (person.name || 'Ashley Moran'))),
            line(0),
            line(0, t('hd', '## Summary')),
            line(0),
            line(0, t('tx', person.summary || 'EDIT: a sentence about you.')),
            line(0),
            line(0, t('hd', '## Currently')),
            line(0)
        ];
        const current = Array.isArray(person.currently) ? person.currently : [];
        if (!current.length) lines.push(line(0, t('cm', '<!-- EDIT: add a currently item in js/profile.js -->')));
        current.forEach(item => lines.push(line(0, t('pn', '- '), t('tx', String(item)))));
        lines.push(line(0));
        lines.push(line(0, t('hd', '## Interests')));
        const interests = isPlain(person.interests) ? person.interests : {};
        const keys = Object.keys(interests);
        if (!keys.length) {
            lines.push(line(0));
            lines.push(line(0, t('cm', '<!-- EDIT: add an interest in js/profile.js -->')));
        }
        keys.forEach(key => {
            lines.push(line(0));
            lines.push(line(0, t('hd', '### ' + heading(key))));
            lines.push(line(0));
            const value = interests[key];
            const items = Array.isArray(value) ? value : [value];
            if (!items.length) lines.push(line(0, t('cm', '<!-- EDIT -->')));
            items.forEach(item => lines.push(line(0, t('pn', '- '), t('tx', String(item ?? '')))));
        });
        lines.push(line(0));
        if (skill.notes) lines.push(line(0, t('tx', String(skill.notes))));
        else lines.push(line(0, t('cm', '<!-- EDIT: optional notes in js/profile.js, skill.notes -->')));
        return lines;
    }
    function lnkName(name) {
        const base = String(name || 'link').replace(/[\\/:*?"<>|]/g, '').trim() || 'link';
        return /\.lnk$/i.test(base) ? base : base + '.lnk';
    }
    function shortcut(lines, name, target, comment) {
        const file = lnkName(name);
        lines.push(line(0, t('cm', '; ' + file)));
        lines.push(line(0, t('cls', '[' + file + ']')));
        lines.push(line(1, t('key', 'Target'), t('pn', '='), qUrl(target || '')));
        lines.push(line(1, t('key', 'Comment'), t('pn', '='), q(comment || '')));
        lines.push(line(1, t('key', 'Window'), t('pn', '='), q('Normal')));
        lines.push(line(0));
    }
    function linkLines() {
        const lines = [
            line(0, t('cm', '; Shortcut properties. A Windows .lnk file is binary, so this buffer shows the fields.')),
            line(0, t('cm', '; Edit social and projects in js/profile.js.')),
            line(0)
        ];
        const social = Array.isArray(profile.social) ? profile.social : [];
        const projects = Array.isArray(work.projects) ? work.projects : [];
        if (!social.length && !projects.length) lines.push(line(0, t('cm', '; EDIT: add a profile or a project.')));
        social.forEach(item => {
            if (!item || typeof item !== 'object') return;
            shortcut(lines, item.name, item.url, item.handle || '');
        });
        projects.forEach(item => {
            if (!item || typeof item !== 'object') return;
            shortcut(lines, item.name, item.url, item.note || '');
        });
        return lines;
    }
    function paint() {
        $('code-about').innerHTML = renderLines(jsonDocument(person));
        $('code-work').innerHTML = renderLines(jsonDocument(work));
        $('code-skills').innerHTML = renderLines(skillLines());
        $('code-links').innerHTML = renderLines(linkLines());
    }
    function ancestor(node, className) {
        while (node && node !== document) {
            if (node.classList && node.classList.contains(className)) return node;
            node = node.parentElement || null;
        }
        return null;
    }
    function chatById(id) {
        return CHATS.find(chat => chat.id === id) || null;
    }
    function isGame(chat) {
        return Boolean(chat && chat.game);
    }
    function modeLabel() {
        return MODES[$('modeSelect').value] || 'Classic';
    }
    function hashFile() {
        try {
            const value = decodeURIComponent((location.hash || '').replace(/^#/, ''));
            return chatById(value) ? value : null;
        } catch {
            return null;
        }
    }
    function writeHistory(mode) {
        const history = window.history;
        if (!mode || mode === 'none' || !history || !history.replaceState) return;
        const url = '#' + encodeURI(active);
        if (mode === 'push' && history.pushState) history.pushState({ file: active }, '', url);
        else history.replaceState({ file: active }, '', url);
    }
    function sync(opts = {}) {
        const root = document.documentElement;
        const chat = chatById(active);
        $('workspace').dataset.active = active || '';
        $('emptyState').hidden = Boolean(chat);
        CHATS.forEach(item => {
            const on = item.id === active;
            $(item.panel).hidden = !on;
            const button = $('chat-' + item.slug);
            button.classList.toggle('is-active', on);
            button.setAttribute('aria-current', on ? 'true' : 'false');
        });
        if (chat) {
            const label = isGame(chat) ? chat.title : chat.file;
            const hint = isGame(chat) ? '' : '<span class="crumb-hint">edit js/profile.js</span>';
            $('breadcrumb').innerHTML = `<span class="crumb">amoran.io</span><span class="sep" aria-hidden="true">›</span><span class="crumb current">${esc(chat.title)}</span><span class="sep" aria-hidden="true">›</span><span class="crumb">${esc(chat.tail)}</span>${hint}`;
            $('windowTitle').textContent = label + ' — amoran.io';
            document.title = label + ' — amoran.io';
            $('statusFile').textContent = label;
            $('statusLang').textContent = chat.lang;
            $('statusDetail').textContent = isGame(chat) ? modeLabel() : 'js/profile.js';
            if (isGame(chat)) $('statusPos').textContent = 'Running';
            else if (!$('statusPos').dataset.pinned) $('statusPos').textContent = 'Ln 1, Col 1';
            $('editorStatus').textContent = chat.title + ' is open';
        }
        if (!isGame(chat)) window.Platformer.setEnabled(false);
        if ($('palette').hidden) window.Platformer.setMenuOpen(false);
        if (isGame(chat)) window.Platformer.setEnabled(true);
        else if (chat) $(chat.code).focus({ preventScroll: true });
        if (root && root.dataset) $('explorerToggle').setAttribute('aria-pressed', String(root.dataset.sidebar !== 'closed'));
        writeHistory(opts.history);
    }
    function open(id, opts = {}) {
        if (!chatById(id)) return;
        const changed = id !== active;
        active = id;
        $('palette').hidden = true;
        $('statusPos').dataset.pinned = '';
        sync({ history: opts.history || (changed ? 'push' : 'none') });
    }
    function cycle(step) {
        const index = Math.max(0, CHATS.findIndex(chat => chat.id === active));
        open(CHATS[(index + step + CHATS.length) % CHATS.length].id);
    }
    function filteredChats() {
        const query = ($('paletteInput').value || '').trim().toLowerCase();
        return CHATS.filter(chat => !query || chat.title.toLowerCase().includes(query) || chat.file.toLowerCase().includes(query) || chat.lang.toLowerCase().includes(query));
    }
    function renderPalette() {
        const list = filteredChats();
        if (paletteIndex >= list.length) paletteIndex = Math.max(0, list.length - 1);
        if (!list.length) {
            $('paletteList').innerHTML = '<p class="palette-empty">No matching chat</p>';
            return;
        }
        $('paletteList').innerHTML = list.map((chat, index) => {
            const selected = index === paletteIndex ? ' is-selected' : '';
            return `<button type="button" class="palette-row${selected}" data-file="${esc(chat.id)}" role="option" aria-selected="${index === paletteIndex ? 'true' : 'false'}"><span class="file-name">${esc(chat.title)}</span><small>${esc(chat.file)}</small></button>`;
        }).join('');
    }
    function openPalette() {
        window.Platformer.setMenuOpen(true);
        $('palette').hidden = false;
        $('paletteInput').value = '';
        paletteIndex = Math.max(0, filteredChats().findIndex(chat => chat.id === active));
        renderPalette();
        $('paletteInput').focus();
        if ($('paletteInput').select) $('paletteInput').select();
    }
    function closePalette() {
        if ($('palette').hidden) return;
        $('palette').hidden = true;
        window.Platformer.setMenuOpen(false);
    }
    function togglePalette() {
        if ($('palette').hidden) openPalette();
        else closePalette();
    }
    function setSidebar(openSidebar) {
        const root = document.documentElement;
        if (root && root.dataset) root.dataset.sidebar = openSidebar ? 'open' : 'closed';
        $('explorerToggle').setAttribute('aria-pressed', String(openSidebar));
        if (isGame(chatById(active)) && window.Platformer.resize) window.Platformer.resize();
    }
    function markLine(event, pin) {
        if (isGame(chatById(active))) return;
        const row = ancestor(event.target, 'line');
        if (!row) return;
        if (pin && row.parentElement && row.parentElement.children) {
            Array.from(row.parentElement.children).forEach(sib => {
                if (sib.classList) sib.classList.toggle('current', sib === row);
            });
            $('statusPos').dataset.pinned = '1';
        }
        let col = 1;
        const source = ancestor(event.target, 'source');
        if (source && event.clientX && source.getBoundingClientRect) {
            const rect = source.getBoundingClientRect();
            let width = 8;
            if (window.getComputedStyle) {
                const size = parseFloat(window.getComputedStyle(source).fontSize);
                if (size) width = size * 0.52;
            }
            col = Math.max(1, Math.round((event.clientX - rect.left) / width));
        }
        $('statusPos').textContent = 'Ln ' + (row.dataset.ln || '1') + ', Col ' + col;
    }
    function sidebarStartsClosed() {
        return Boolean(window.matchMedia && window.matchMedia('(max-width: 800px), (max-height: 520px)').matches);
    }

    paint();
    ['code-about', 'code-work', 'code-skills', 'code-links'].forEach(id => {
        const el = $(id);
        el.addEventListener('click', event => markLine(event, true));
        el.addEventListener('mousemove', event => markLine(event, false));
    });
    document.querySelectorAll('[data-file]').forEach(el => {
        el.addEventListener('click', () => open(el.dataset.file));
    });
    $('paletteList').addEventListener('click', event => {
        const row = ancestor(event.target, 'palette-row');
        const id = row && row.dataset ? row.dataset.file : (event.target.dataset && event.target.dataset.file);
        if (id) open(id);
    });
    $('paletteInput').addEventListener('input', () => {
        paletteIndex = 0;
        renderPalette();
    });
    $('paletteInput').addEventListener('keydown', event => {
        const list = filteredChats();
        if (event.code === 'ArrowDown') {
            event.preventDefault();
            paletteIndex = Math.min(list.length - 1, paletteIndex + 1);
            renderPalette();
        } else if (event.code === 'ArrowUp') {
            event.preventDefault();
            paletteIndex = Math.max(0, paletteIndex - 1);
            renderPalette();
        } else if (event.code === 'Enter') {
            event.preventDefault();
            if (list[paletteIndex]) open(list[paletteIndex].id);
        } else if (event.code === 'Escape') {
            event.preventDefault();
            closePalette();
        }
    });
    $('commandCenter').addEventListener('click', togglePalette);
    $('searchActivity').addEventListener('click', togglePalette);
    $('runActivity').addEventListener('click', () => open('block-runner'));
    $('explorerToggle').addEventListener('click', () => {
        const root = document.documentElement;
        const openNow = !root || !root.dataset || root.dataset.sidebar !== 'closed';
        setSidebar(!openNow);
    });
    $('sidebarBackdrop').addEventListener('click', () => setSidebar(false));
    $('modeSelect').addEventListener('change', () => {
        if (isGame(chatById(active))) $('statusDetail').textContent = modeLabel();
    });
    document.addEventListener('keydown', event => {
        const mod = event.ctrlKey || event.metaKey;
        if (mod && event.code === 'KeyP') {
            event.preventDefault();
            if (event.repeat) return;
            togglePalette();
            return;
        }
        if (mod && event.code === 'Tab') {
            event.preventDefault();
            cycle(event.shiftKey ? -1 : 1);
            return;
        }
        if (mod && !event.repeat && /^Digit[1-5]$/.test(event.code)) {
            event.preventDefault();
            open(CHATS[Number(event.code.slice(5)) - 1].id);
            return;
        }
        if (event.code === 'Escape' && !$('palette').hidden) {
            event.preventDefault();
            closePalette();
        }
    });
    document.addEventListener('pointerdown', event => {
        if ($('palette').hidden) return;
        if (ancestor(event.target, 'palette') || ancestor(event.target, 'opens-palette')) return;
        closePalette();
    });
    window.addEventListener('popstate', () => {
        const id = hashFile();
        if (!id) return;
        active = id;
        sync({ history: 'none' });
    });
    const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test((navigator.platform || navigator.userAgent || ''));
    document.querySelectorAll('[data-mod]').forEach(el => { el.textContent = mac ? '⌘' : 'Ctrl'; });
    const root = document.documentElement;
    if (root && root.dataset && !root.dataset.sidebar) root.dataset.sidebar = sidebarStartsClosed() ? 'closed' : 'open';
    const hashed = hashFile();
    if (hashed) active = hashed;
    sync({ history: 'replace' });
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => {
        if (isGame(chatById(active)) && window.Platformer.resize) window.Platformer.resize();
    }).observe($('arcade'));
})();
