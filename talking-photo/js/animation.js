/**
 * Animation Module - Manages character idle floating motion, eye blinking cycles,
 * dynamic lip-sync mouth scaling driven by audio amplitude, and preset selection.
 */

import { getAudioAmplitude } from './audio.js';
import { updateCharacterTransform } from './canvas.js';

// Configuration & Constants
const CONFIG = {
    TIME_RESET_THRESHOLD: 10000,
    LIP_SYNC: {
        ENABLED: true,
        AMPLITUDE_BOOST: 0.15,
        SCALE_WHOLE_CHARACTER: true // Temporary: Set to false when mouth layer is rendered independently
    },
    BLINK: {
        INTERVAL_MIN: 3.0,
        INTERVAL_MAX: 5.0,
        DURATION: 0.15
    }
};

// Motion Presets Object Map (Scalable Strategy Pattern)
const PRESETS = {
    none: () => ({ x: 0, y: 0, rotation: 0 }),
    gentle: (t, amp) => ({
        y: Math.sin(t * 2 * animationSpeed) * 6 - amp * 8,
        x: Math.cos(t * 1.2 * animationSpeed) * 3,
        rotation: Math.sin(t * 1.5 * animationSpeed) * 1.2
    }),
    energetic: (t, amp) => ({
        y: Math.sin(t * 4 * animationSpeed) * 12 - amp * 12,
        x: Math.cos(t * 2.5 * animationSpeed) * 6,
        rotation: Math.sin(t * 3 * animationSpeed) * 2.5
    }),
    bounce: (t, amp) => ({
        y: Math.abs(Math.sin(t * 5 * animationSpeed)) * -15 - amp * 8,
        x: 0,
        rotation: Math.sin(t * 2.5 * animationSpeed) * 1
    })
};

// State Variables
let isAnimating = false;
let isPaused = false;
let isLipSyncEnabled = true;
let animationSpeed = 1.0;

let animationFrameId = null;
let animationAbortController = null;

let activePresetKey = 'gentle';
let timeElapsed = 0;

// Eye Blink Tracker
let timeUntilNextBlink = getRandomBlinkInterval();
let blinkTimer = 0;
let isBlinking = false;

// User Inspector Transforms (Base Values)
let inspectorTransforms = {
    scale: 1,
    rotation: 0,
    posX: 0,
    posY: 0
};

// Transform Delta Cache for Performance Optimization
let lastTransform = {
    scale: null,
    posX: null,
    posY: null,
    rotation: null
};

export function initAnimation() {
    destroyAnimation();

    animationAbortController = new AbortController();
    bindAnimationControls();
    startAnimationLoop();
}

/**
 * Calculates a random time interval for natural eye blinking.
 * @returns {number}
 */
function getRandomBlinkInterval() {
    return CONFIG.BLINK.INTERVAL_MIN + 
        Math.random() * (CONFIG.BLINK.INTERVAL_MAX - CONFIG.BLINK.INTERVAL_MIN);
}

/**
 * Main animation loop driven by performance timestamp.
 */
function startAnimationLoop() {
    if (isAnimating) return;
    isAnimating = true;

    let lastTime = performance.now();

    function loop(now) {
        if (!isAnimating) return;

        if (!isPaused) {
            const deltaTime = (now - lastTime) / 1000;
            timeElapsed += deltaTime;

            // Reset timeElapsed to prevent float precision degradation over hours
            if (timeElapsed > CONFIG.TIME_RESET_THRESHOLD) {
                timeElapsed = 0;
            }

            updateBlinkCycle(deltaTime);
            updateMotion();
        }

        lastTime = now;
        animationFrameId = requestAnimationFrame(loop);
    }

    animationFrameId = requestAnimationFrame(loop);
}

/**
 * Stops animation loop completely.
 */
export function stopAnimationLoop() {
    isAnimating = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

/**
 * Calculates current frame transforms without overwriting user inspector values.
 */
function updateMotion() {
    // 1. Fetch Real-time Audio Amplitude
    const amplitude = (isLipSyncEnabled && CONFIG.LIP_SYNC.ENABLED) ? getAudioAmplitude() : 0;

    // 2. Compute Offset from active preset strategy
    const presetFn = PRESETS[activePresetKey] || PRESETS.none;
    const offsets = presetFn(timeElapsed, amplitude);

    // 3. Compute Scale modifier
    let scaleModifier = 1;
    if (CONFIG.LIP_SYNC.SCALE_WHOLE_CHARACTER && amplitude > 0) {
        scaleModifier += amplitude * CONFIG.LIP_SYNC.AMPLITUDE_BOOST;
    }

    const nextScale = inspectorTransforms.scale * scaleModifier;
    const nextPosX = inspectorTransforms.posX + offsets.x;
    const nextPosY = inspectorTransforms.posY + offsets.y;
    const nextRotation = inspectorTransforms.rotation + offsets.rotation;

    // Delta Optimization Check: Skip canvas update if transforms haven't changed significantly
    const EPSILON = 0.0001;
    if (
        lastTransform.scale !== null &&
        Math.abs(lastTransform.scale - nextScale) < EPSILON &&
        Math.abs(lastTransform.posX - nextPosX) < EPSILON &&
        Math.abs(lastTransform.posY - nextPosY) < EPSILON &&
        Math.abs(lastTransform.rotation - nextRotation) < EPSILON
    ) {
        return;
    }

    // Cache current transform
    lastTransform.scale = nextScale;
    lastTransform.posX = nextPosX;
    lastTransform.posY = nextPosY;
    lastTransform.rotation = nextRotation;

    // 4. Update Canvas Layer Transforms
    updateCharacterTransform({
        scale: nextScale,
        posX: nextPosX,
        posY: nextPosY,
        rotation: nextRotation
    });
}

/**
 * Handles realistic eye blink timing cycles.
 */
function updateBlinkCycle(deltaTime) {
    if (isBlinking) {
        blinkTimer += deltaTime;
        if (blinkTimer >= CONFIG.BLINK.DURATION) {
            isBlinking = false;
            blinkTimer = 0;
            timeUntilNextBlink = getRandomBlinkInterval();
        }
    } else {
        timeUntilNextBlink -= deltaTime;
        if (timeUntilNextBlink <= 0) {
            isBlinking = true;
            blinkTimer = 0;
        }
    }
}

/**
 * Returns current eye blink state for render layer evaluation.
 * @returns {boolean}
 */
export function getIsBlinking() {
    return isBlinking;
}

/**
 * Binds DOM control listeners using AbortController for clean teardown.
 */
function bindAnimationControls() {
    if (!animationAbortController) return;
    const { signal } = animationAbortController;

    // Preset selection cards
    const presetCards = document.querySelectorAll('.preset-card');
    presetCards.forEach(card => {
        card.addEventListener('click', () => {
            presetCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            activePresetKey = card.getAttribute('data-preset') || 'gentle';
        }, { signal });
    });

    // Inspector Sliders Linkage
    const scaleRange = document.getElementById('scale-range');
    const rotationRange = document.getElementById('rotation-range');
    const posXRange = document.getElementById('pos-x-range');
    const posYRange = document.getElementById('pos-y-range');

    if (scaleRange) {
        scaleRange.addEventListener('input', (e) => {
            inspectorTransforms.scale = parseFloat(e.target.value) / 100;
        }, { signal });
    }

    if (rotationRange) {
        rotationRange.addEventListener('input', (e) => {
            inspectorTransforms.rotation = parseFloat(e.target.value);
        }, { signal });
    }

    if (posXRange) {
        posXRange.addEventListener('input', (e) => {
            inspectorTransforms.posX = parseFloat(e.target.value);
        }, { signal });
    }

    if (posYRange) {
        posYRange.addEventListener('input', (e) => {
            inspectorTransforms.posY = parseFloat(e.target.value);
        }, { signal });
    }
}

// Control Public APIs
export function pauseAnimation() { isPaused = true; }
export function resumeAnimation() { isPaused = false; }
export function setAnimationSpeed(speed) { animationSpeed = Math.max(0.1, speed); }
export function enableLipSync() { isLipSyncEnabled = true; }
export function disableLipSync() { isLipSyncEnabled = false; }
export function setIdlePreset(preset) { if (PRESETS[preset]) activePresetKey = preset; }

/**
 * Complete Animation Module teardown and state reset.
 */
export function destroyAnimation() {
    stopAnimationLoop();

    if (animationAbortController) {
        animationAbortController.abort();
        animationAbortController = null;
    }

    timeElapsed = 0;
    isPaused = false;
    isBlinking = false;
    blinkTimer = 0;
    timeUntilNextBlink = getRandomBlinkInterval();

    inspectorTransforms = { scale: 1, rotation: 0, posX: 0, posY: 0 };
    lastTransform = { scale: null, posX: null, posY: null, rotation: null };
}
