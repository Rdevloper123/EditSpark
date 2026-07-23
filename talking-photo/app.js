import { initUI } from './js/ui.js';
import { initCanvas } from './js/canvas.js';
import { initAudio } from './js/audio.js';
import { initAnimation } from './js/animation.js';
import { initExport } from './js/export.js';
import { initUtils } from './js/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize application sub-systems
    initUtils();
    initCanvas();
    initAudio();
    initAnimation();
    initExport();
    initUI();
});
