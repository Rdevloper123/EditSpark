/**
 * Canvas Module - Handles main stage rendering, dynamic background rendering,
 * auto-fit character transformation, High-DPI support, and clean lifecycle management.
 */

import { degToRad } from './utils.js';

let canvas = null;
let ctx = null;

// Lifecycle Controller for Event Cleanups
let canvasAbortController = null;

// Render State
let currentBgType = 'solid';
let currentBgColor = '#0f172a';

let currentCharacterImage = null;
let characterTransform = {
    scale: 1,
    rotation: 0,
    posX: 0,
    posY: 0
};

// Animation & Performance Metrics
let animationFrameId = null;
let frameCount = 0;
let fpsTimer = performance.now();
let currentFps = 60;
let isRendering = false;

export function initCanvas() {
    // If canvas is initialized again, clean previous instances/listeners
    destroyCanvas();

    canvas = document.getElementById('main-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    canvasAbortController = new AbortController();

    setupHiDPI();
    bindCanvasControls();
    startRenderLoop();
}

/**
 * Handles High-DPI / Retina Screen Scaling safely without transform matrix accumulation.
 */
function setupHiDPI() {
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    
    // Set explicit internal resolution (Bitmap)
    canvas.width = 1280 * dpr;
    canvas.height = 720 * dpr;

    // Set CSS display dimensions to avoid mismatch
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // Absolute transform set (prevents scaling accumulation bugs)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Returns the 2D context for external modules.
 */
export function getCanvasContext() {
    return ctx;
}

/**
 * Returns the raw canvas element.
 */
export function getCanvasElement() {
    return canvas;
}

/**
 * Sets or updates the active character image.
 * @param {HTMLImageElement|Image} img
 */
export function setCharacterImage(img) {
    currentCharacterImage = img;
}

/**
 * Updates character transform parameters from inspector inputs.
 * @param {Object} transform
 */
export function updateCharacterTransform(transform) {
    if (transform.scale !== undefined) characterTransform.scale = transform.scale;
    if (transform.rotation !== undefined) characterTransform.rotation = transform.rotation;
    if (transform.posX !== undefined) characterTransform.posX = transform.posX;
    if (transform.posY !== undefined) characterTransform.posY = transform.posY;
}

/**
 * Binds DOM listeners safely using AbortController to prevent duplicate bindings.
 */
function bindCanvasControls() {
    if (!canvasAbortController) return;
    const { signal } = canvasAbortController;

    // Background Presets
    const bgCards = document.querySelectorAll('.bg-preset-card');
    bgCards.forEach(card => {
        card.addEventListener('click', () => {
            bgCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            currentBgType = card.getAttribute('data-bg') || 'solid';
            currentBgColor = card.getAttribute('data-color') || '#0f172a';
        }, { signal });
    });

    // Transform Sliders
    const scaleRange = document.getElementById('scale-range');
    const rotationRange = document.getElementById('rotation-range');
    const posXRange = document.getElementById('pos-x-range');
    const posYRange = document.getElementById('pos-y-range');

    if (scaleRange) {
        scaleRange.addEventListener('input', (e) => {
            characterTransform.scale = parseFloat(e.target.value) / 100;
        }, { signal });
    }

    if (rotationRange) {
        rotationRange.addEventListener('input', (e) => {
            characterTransform.rotation = parseFloat(e.target.value);
        }, { signal });
    }

    if (posXRange) {
        posXRange.addEventListener('input', (e) => {
            characterTransform.posX = parseFloat(e.target.value);
        }, { signal });
    }

    if (posYRange) {
        posYRange.addEventListener('input', (e) => {
            characterTransform.posY = parseFloat(e.target.value);
        }, { signal });
    }
}

/**
 * Main continuous render loop.
 */
export function startRenderLoop() {
    if (isRendering) return;
    isRendering = true;

    function render(now) {
        if (!isRendering) return;
        calculateFps(now);
        draw();
        animationFrameId = requestAnimationFrame(render);
    }
    animationFrameId = requestAnimationFrame(render);
}

/**
 * Stops continuous rendering loop cleanly.
 */
export function stopRenderLoop() {
    isRendering = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

/**
 * Full cleanup method for destroying canvas instances and unbinding event listeners.
 */
export function destroyCanvas() {
    stopRenderLoop();

    if (canvasAbortController) {
        canvasAbortController.abort();
        canvasAbortController = null;
    }

    currentCharacterImage = null;

    if (ctx && canvas) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, 1280, 720);
    }
}

/**
 * Renders the full scene frame: background + character.
 */
function draw() {
    if (!ctx || !canvas) return;

    // Logical stage size
    const stageWidth = 1280;
    const stageHeight = 720;

    // Clear Canvas
    ctx.clearRect(0, 0, stageWidth, stageHeight);

    // 1. Render Background
    renderBackground(stageWidth, stageHeight);

    // 2. Render Character Layer
    if (currentCharacterImage && currentCharacterImage.complete) {
        renderCharacter(stageWidth, stageHeight);
    }
}

/**
 * Flexible & Scalable Background Renderer parsing hex colors and CSS linear gradients.
 */
function renderBackground(width, height) {
    ctx.save();

    if (currentBgType === 'gradient' && currentBgColor.includes('gradient')) {
        const hexMatches = currentBgColor.match(/#[a-fA-F0-9]{3,6}/g);
        
        if (hexMatches && hexMatches.length >= 2) {
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            const step = 1 / (hexMatches.length - 1);
            hexMatches.forEach((color, index) => {
                gradient.addColorStop(index * step, color);
            });
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = '#0f172a';
        }
    } else {
        ctx.fillStyle = currentBgColor || '#0f172a';
    }

    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}

/**
 * Draws character with position, rotation, and aspect-ratio aware fit-to-stage scale.
 */
function renderCharacter(stageWidth, stageHeight) {
    ctx.save();

    const centerX = stageWidth / 2 + characterTransform.posX;
    const centerY = stageHeight / 2 + characterTransform.posY;

    const imgWidth = currentCharacterImage.width || currentCharacterImage.naturalWidth;
    const imgHeight = currentCharacterImage.height || currentCharacterImage.naturalHeight;

    // Fit-To-Stage Aspect Ratio Logic (Max 80% of Canvas Viewport)
    const maxAllowedWidth = stageWidth * 0.8;
    const maxAllowedHeight = stageHeight * 0.8;
    const baseScale = Math.min(maxAllowedWidth / imgWidth, maxAllowedHeight / imgHeight, 1);

    const renderWidth = imgWidth * baseScale;
    const renderHeight = imgHeight * baseScale;

    ctx.translate(centerX, centerY);
    ctx.rotate(degToRad(characterTransform.rotation));
    ctx.scale(characterTransform.scale, characterTransform.scale);

    ctx.drawImage(
        currentCharacterImage,
        -renderWidth / 2,
        -renderHeight / 2,
        renderWidth,
        renderHeight
    );

    ctx.restore();
}

/**
 * Calculates current FPS and updates `#fps-display`.
 * @param {number} now
 */
function calculateFps(now) {
    frameCount++;
    if (now - fpsTimer >= 1000) {
        currentFps = Math.round((frameCount * 1000) / (now - fpsTimer));
        frameCount = 0;
        fpsTimer = now;

        const fpsDisplay = document.getElementById('fps-display');
        if (fpsDisplay) {
            fpsDisplay.textContent = String(currentFps);
        }
    }
}
