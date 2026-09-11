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
    // Retire preferences from the previous site without affecting scores or sound.
    storage.remove('amoran-persona');
    storage.remove('amoran-theme');
})();
