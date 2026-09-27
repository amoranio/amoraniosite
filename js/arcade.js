(() => {
    'use strict';
    const modeSelect = document.getElementById('modeSelect');
    modeSelect.addEventListener('change', () => window.Platformer.setMode(modeSelect.value));
    document.getElementById('restartGame').addEventListener('click', () => window.Platformer.restart());
    document.getElementById('pauseGame').addEventListener('click', () => window.Platformer.togglePause());
})();
