(() => {
    'use strict';
    // Preferences must never prevent loading in private/restricted browsers.
    const storage = {
        get(key) { try { return localStorage.getItem(key); } catch { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch { /* Optional preference. */ } },
        remove(key) { try { localStorage.removeItem(key); } catch { /* Optional preference. */ } }
    };
    window.amoranStorage = storage;
    document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
    if (document.body.dataset.page === 'chooser') {
        const persona = storage.get('amoran-persona');
        if (!new URLSearchParams(location.search).has('choose') && ['professional', 'play'].includes(persona)) location.replace(persona + '.html');
        document.querySelectorAll('[data-persona]').forEach(link => link.addEventListener('click', () => {
            if (document.getElementById('rememberPersona').checked) storage.set('amoran-persona', link.dataset.persona);
            else storage.remove('amoran-persona');
        }));
    }
})();
