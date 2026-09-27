(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const profile = window.AMORAN_PROFILE || {};
    const person = profile.person || {};
    const work = profile.work || {};
    const FILES = [
        { id: 'about.py', slug: 'about', panel: 'panel-about', code: 'code-about', tail: 'Person', lang: 'Python' },
        { id: 'work.py', slug: 'work', panel: 'panel-work', code: 'code-work', tail: 'projects', lang: 'Python' },
        { id: 'social.py', slug: 'social', panel: 'panel-social', code: 'code-social', tail: 'profiles', lang: 'Python' },
        { id: 'game.py', slug: 'game', panel: 'panel-game', code: null, tail: 'Block Runner', lang: 'Block Runner' }
    ];
    const MODES = { classic: 'Classic', overclock: 'Overclock', training: 'Training' };
    let openTabs = FILES.map(file => file.id);
    let active = 'game.py';
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
    function field(name, value, href) {
        const tokens = [t('bi', 'self'), t('pn', '.'), t('vr', name), t('pn', ' = ')];
        if (value === null || value === undefined || value === '') tokens.push(t('bi', 'None'), t('cm', '  # EDIT: set this in js/profile.js, or leave None'));
        else tokens.push(q(value, href));
        return line(2, ...tokens);
    }
    function listReturn(lines, items) {
        const list = Array.isArray(items) ? items : [];
        lines.push(line(2, t('kw', 'return '), t('pn', '[')));
        if (!list.length) lines.push(line(3, t('cm', '# EDIT: add a string.')));
        list.forEach(item => lines.push(line(3, q(item), t('pn', ','))));
        lines.push(line(2, t('pn', ']')));
    }
    function aboutLines() {
        const lines = [
            line(0, t('str', '"""')),
            line(0, t('str', person.name || 'Ashley Moran')),
            line(0, person.site ? t('str', String(person.site), safeUrl(person.site)) : t('str', '')),
            line(0, t('str', '')),
            line(0, t('str', 'The lines marked EDIT are yours.')),
            line(0, t('str', 'Change them in js/profile.js.')),
            line(0, t('str', '"""')),
            line(0),
            line(0, t('kw', 'class '), t('cls', 'Person'), t('pn', ':')),
            line(1, t('kw', 'def '), t('fn', '__init__'), t('pn', '('), t('bi', 'self'), t('pn', '):')),
            field('name', person.name),
            field('handle', person.handle),
            field('site', person.site, safeUrl(person.site)),
            field('location', person.location),
            line(0),
            line(1, t('kw', 'def '), t('fn', 'summary'), t('pn', '('), t('bi', 'self'), t('pn', '):')),
            line(2, t('cm', '# EDIT: a sentence about you.')),
            line(2, t('kw', 'return '), q(person.summary || '')),
            line(0),
            line(1, t('kw', 'def '), t('fn', 'currently'), t('pn', '('), t('bi', 'self'), t('pn', '):')),
            line(2, t('cm', '# EDIT: add a string for each thing you are doing.'))
        ];
        listReturn(lines, person.currently);
        lines.push(line(0));
        lines.push(line(1, t('kw', 'def '), t('fn', 'interests'), t('pn', '('), t('bi', 'self'), t('pn', '):')));
        lines.push(line(2, t('cm', '# EDIT: add a key, or add items to a list.')));
        const interests = person.interests && typeof person.interests === 'object' ? person.interests : {};
        const keys = Object.keys(interests);
        lines.push(line(2, t('kw', 'return '), t('pn', '{')));
        if (!keys.length) lines.push(line(3, t('cm', '# EDIT: add a key and a list.')));
        keys.forEach((key, index) => {
            const last = index === keys.length - 1;
            const value = interests[key];
            if (Array.isArray(value)) {
                lines.push(line(3, q(key), t('pn', ': [')));
                if (!value.length) lines.push(line(4, t('cm', '# EDIT')));
                value.forEach(item => lines.push(line(4, q(item), t('pn', ','))));
                lines.push(line(3, t('pn', last ? ']' : '],')));
            } else lines.push(line(3, q(key), t('pn', ': '), q(value), t('pn', last ? '' : ',')));
        });
        lines.push(line(2, t('pn', '}')));
        lines.push(line(0));
        lines.push(line(0));
        lines.push(line(0, t('vr', 'ashley'), t('pn', ' = '), t('cls', 'Person'), t('pn', '()')));
        lines.push(line(0));
        lines.push(line(0));
        lines.push(line(0, t('kw', 'if '), t('bi', '__name__'), t('pn', ' == '), q('__main__'), t('pn', ':')));
        lines.push(line(1, t('fn', 'print'), t('pn', '('), t('vr', 'ashley'), t('pn', '.'), t('fn', 'summary'), t('pn', '())')));
        return lines;
    }
    function callBlock(lines, fn, rows) {
        lines.push(line(1, t('fn', fn), t('pn', '(')));
        rows.forEach(row => lines.push(line(2, row, t('pn', ','))));
        lines.push(line(1, t('pn', '),')));
    }
    function workLines() {
        const lines = [
            line(0, t('str', '"""')),
            line(0, t('str', 'Work')),
            line(0, t('str', '')),
            line(0, t('str', 'Edit the projects list in js/profile.js.')),
            line(0, t('str', '"""')),
            line(0),
            line(0, t('kw', 'def '), t('fn', 'project'), t('pn', '('), t('vr', 'name'), t('pn', ', '), t('vr', 'url'), t('pn', ', '), t('vr', 'note'), t('pn', '):')),
            line(1, t('kw', 'return '), t('pn', '{'), q('name'), t('pn', ': '), t('vr', 'name'), t('pn', ', '), q('url'), t('pn', ': '), t('vr', 'url'), t('pn', ', '), q('note'), t('pn', ': '), t('vr', 'note'), t('pn', '}')),
            line(0),
            line(0),
            line(0, t('kw', 'def '), t('fn', 'focus'), t('pn', '():')),
            line(1, t('cm', '# EDIT: what you are focused on.')),
            line(1, t('kw', 'return '), q(work.focus || '')),
            line(0),
            line(0),
            line(0, t('vr', 'projects'), t('pn', ' = [')),
        ];
        const projects = Array.isArray(work.projects) ? work.projects : [];
        if (!projects.length) lines.push(line(1, t('cm', '# EDIT: add a project() call.')));
        projects.forEach(project => {
            if (!project || typeof project !== 'object') return;
            callBlock(lines, 'project', [q(project.name || ''), qUrl(project.url || ''), q(project.note || '')]);
        });
        lines.push(line(0, t('pn', ']')));
        return lines;
    }
    function socialLines() {
        const lines = [
            line(0, t('str', '"""')),
            line(0, t('str', 'Social')),
            line(0, t('str', '')),
            line(0, t('str', 'Edit the profiles list in js/profile.js.')),
            line(0, t('str', '"""')),
            line(0),
            line(0, t('kw', 'def '), t('fn', 'link'), t('pn', '('), t('vr', 'name'), t('pn', ', '), t('vr', 'handle'), t('pn', ', '), t('vr', 'url'), t('pn', '):')),
            line(1, t('kw', 'return '), t('pn', '{'), q('name'), t('pn', ': '), t('vr', 'name'), t('pn', ', '), q('handle'), t('pn', ': '), t('vr', 'handle'), t('pn', ', '), q('url'), t('pn', ': '), t('vr', 'url'), t('pn', '}')),
            line(0),
            line(0),
            line(0, t('vr', 'profiles'), t('pn', ' = [')),
        ];
        const profiles = Array.isArray(profile.social) ? profile.social : [];
        if (!profiles.length) lines.push(line(1, t('cm', '# EDIT: add a link() call.')));
        profiles.forEach(item => {
            if (!item || typeof item !== 'object') return;
            callBlock(lines, 'link', [q(item.name || ''), q(item.handle || ''), qUrl(item.url || '')]);
        });
        lines.push(line(0, t('pn', ']')));
        return lines;
    }
    function paint() {
        $('code-about').innerHTML = renderLines(aboutLines());
        $('code-work').innerHTML = renderLines(workLines());
        $('code-social').innerHTML = renderLines(socialLines());
    }
    function ancestor(node, className) {
        while (node && node !== document) {
            if (node.classList && node.classList.contains(className)) return node;
            node = node.parentElement || null;
        }
        return null;
    }
    function fileById(id) {
        return FILES.find(file => file.id === id) || null;
    }
    function modeLabel() {
        return MODES[$('modeSelect').value] || 'Classic';
    }
    function hashFile() {
        try {
            const value = decodeURIComponent((location.hash || '').replace(/^#/, ''));
            return fileById(value) ? value : null;
        } catch {
            return null;
        }
    }
    function writeHistory(mode) {
        const history = window.history;
        if (!mode || mode === 'none' || !history || !history.replaceState) return;
        const url = active ? '#' + encodeURI(active) : (location.pathname || '#');
        if (mode === 'push' && history.pushState) history.pushState({ file: active }, '', url);
        else history.replaceState({ file: active }, '', url);
    }
    function sync(opts = {}) {
        const root = document.documentElement;
        const file = fileById(active);
        $('workspace').dataset.active = active || '';
        $('emptyState').hidden = Boolean(file);
        FILES.forEach(item => {
            const on = item.id === active;
            $(item.panel).hidden = !on;
            $('tabwrap-' + item.slug).hidden = !openTabs.includes(item.id);
            const tab = $('tab-' + item.slug);
            tab.classList.toggle('is-active', on);
            tab.setAttribute('aria-selected', on ? 'true' : 'false');
            tab.tabIndex = on ? 0 : -1;
            const explorer = $('file-' + item.slug);
            explorer.classList.toggle('is-active', on);
            explorer.setAttribute('aria-current', on ? 'true' : 'false');
        });
        if (file) {
            const hint = file.id === 'game.py' ? '' : '<span class="crumb-hint">edit js/profile.js</span>';
            $('breadcrumb').innerHTML = `<span class="crumb">amoran.io</span><span class="sep" aria-hidden="true">›</span><span class="crumb current">${esc(file.id)}</span><span class="sep" aria-hidden="true">›</span><span class="crumb">${esc(file.tail)}</span>${hint}`;
            $('windowTitle').textContent = file.id + ' — amoran.io';
            document.title = file.id + ' — amoran.io';
            $('statusFile').textContent = file.id;
            $('statusLang').textContent = file.lang;
            $('statusDetail').textContent = file.id === 'game.py' ? modeLabel() : 'js/profile.js';
            if (file.id === 'game.py') $('statusPos').textContent = 'Running';
            else if (!$('statusPos').dataset.pinned) $('statusPos').textContent = 'Ln 1, Col 1';
            $('editorStatus').textContent = file.id + ' is open';
        } else {
            $('breadcrumb').textContent = '';
            $('windowTitle').textContent = 'amoran.io';
            document.title = 'amoran.io';
            $('statusFile').textContent = 'No file';
            $('statusLang').textContent = 'Plain Text';
            $('statusDetail').textContent = 'Explorer';
            $('statusPos').textContent = '';
            $('editorStatus').textContent = 'No file is open';
        }
        if (!file || file.id !== 'game.py') window.Platformer.setEnabled(false);
        if ($('palette').hidden) window.Platformer.setMenuOpen(false);
        if (file && file.id === 'game.py') window.Platformer.setEnabled(true);
        else if (file) $(file.code).focus({ preventScroll: true });
        if (root && root.dataset) $('explorerToggle').setAttribute('aria-pressed', String(root.dataset.sidebar !== 'closed'));
        writeHistory(opts.history);
    }
    function open(id, opts = {}) {
        if (!fileById(id)) return;
        const changed = id !== active || !openTabs.includes(id);
        if (!openTabs.includes(id)) openTabs.push(id);
        active = id;
        $('palette').hidden = true;
        $('statusPos').dataset.pinned = '';
        sync({ history: opts.history || (changed ? 'push' : 'none') });
    }
    function closeFile(id) {
        const index = openTabs.indexOf(id);
        if (index < 0) return;
        openTabs.splice(index, 1);
        if (active === id) active = openTabs[Math.min(index, openTabs.length - 1)] || null;
        $('palette').hidden = true;
        sync({ history: 'push' });
    }
    function cycle(step) {
        if (!openTabs.length) return;
        const index = Math.max(0, openTabs.indexOf(active));
        open(openTabs[(index + step + openTabs.length) % openTabs.length]);
    }
    function filteredFiles() {
        const query = ($('paletteInput').value || '').trim().toLowerCase();
        return FILES.filter(file => !query || file.id.toLowerCase().includes(query) || file.lang.toLowerCase().includes(query));
    }
    function renderPalette() {
        const list = filteredFiles();
        if (paletteIndex >= list.length) paletteIndex = Math.max(0, list.length - 1);
        if (!list.length) {
            $('paletteList').innerHTML = '<p class="palette-empty">No matching file</p>';
            return;
        }
        $('paletteList').innerHTML = list.map((file, index) => {
            const selected = index === paletteIndex ? ' is-selected' : '';
            return `<button type="button" class="palette-row${selected}" data-file="${esc(file.id)}" role="option" aria-selected="${index === paletteIndex ? 'true' : 'false'}"><span class="file-name">${esc(file.id)}</span><small>amoran.io</small></button>`;
        }).join('');
    }
    function openPalette() {
        window.Platformer.setMenuOpen(true);
        $('palette').hidden = false;
        $('paletteInput').value = '';
        paletteIndex = Math.max(0, filteredFiles().findIndex(file => file.id === active));
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
        if (active === 'game.py' && window.Platformer.resize) window.Platformer.resize();
    }
    function markLine(event, pin) {
        if (!active || active === 'game.py') return;
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
    ['code-about', 'code-work', 'code-social'].forEach(id => {
        const el = $(id);
        el.addEventListener('click', event => markLine(event, true));
        el.addEventListener('mousemove', event => markLine(event, false));
    });
    document.querySelectorAll('[data-file]').forEach(el => {
        el.addEventListener('click', () => open(el.dataset.file));
    });
    document.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', event => {
            if (event.stopPropagation) event.stopPropagation();
            closeFile(el.dataset.close);
        });
    });
    FILES.forEach(file => {
        $('tab-' + file.slug).addEventListener('keydown', event => {
            if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return;
            if (!openTabs.length) return;
            event.preventDefault();
            const index = Math.max(0, openTabs.indexOf(file.id));
            const next = openTabs[(index + (event.code === 'ArrowRight' ? 1 : -1) + openTabs.length) % openTabs.length];
            open(next);
            const target = fileById(next);
            if (target) $('tab-' + target.slug).focus();
        });
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
        const list = filteredFiles();
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
    $('runActivity').addEventListener('click', () => open('game.py'));
    $('explorerToggle').addEventListener('click', () => {
        const root = document.documentElement;
        const openNow = !root || !root.dataset || root.dataset.sidebar !== 'closed';
        setSidebar(!openNow);
    });
    $('sidebarBackdrop').addEventListener('click', () => setSidebar(false));
    $('folderToggle').addEventListener('click', () => {
        const expanded = $('folderToggle').getAttribute('aria-expanded') === 'true';
        $('folderToggle').setAttribute('aria-expanded', String(!expanded));
        $('fileTree').hidden = expanded;
    });
    $('modeSelect').addEventListener('change', () => {
        if (active === 'game.py') $('statusDetail').textContent = modeLabel();
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
        if (mod && !event.repeat && /^Digit[1-4]$/.test(event.code)) {
            event.preventDefault();
            open(FILES[Number(event.code.slice(5)) - 1].id);
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
        const file = hashFile();
        if (!file) return;
        if (!openTabs.includes(file)) openTabs.push(file);
        active = file;
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
        if (active === 'game.py' && window.Platformer.resize) window.Platformer.resize();
    }).observe($('arcade'));
})();
