/**
 * Audio Module - Handles HTMLAudioElement, Web Audio API AnalyserNode,
 * volume-based amplitude extraction, and central AudioContext/SourceNode sharing.
 */

// Module State
let audioContext = null;
let audioElement = null;
let sourceNode = null;
let analyserNode = null;
let dataArray = null;
let isAudioInitialized = false;

// Audio Configuration Defaults
const CONFIG = {
    FFT_SIZE: 256,
    SMOOTHING: 0.8
};

/**
 * Initializes or retrieves the singleton HTMLAudioElement.
 * @returns {HTMLAudioElement}
 */
export function getAudioElement() {
    if (!audioElement) {
        audioElement = document.querySelector('audio') || new Audio();
        setupAudioElementListeners();
    }
    return audioElement;
}

/**
 * Singleton AudioContext Provider.
 * Safely handles webkit prefix for Safari compatibility.
 * @returns {AudioContext}
 */
export function getAudioContext() {
    if (!audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtx();
    }
    return audioContext;
}

/**
 * Creates or retrieves the single-instance MediaElementSourceNode.
 * Prevents "InvalidStateError: HTMLMediaElement already connected" errors.
 * @returns {MediaElementAudioSourceNode|null}
 */
export function getAudioSourceNode() {
    const el = getAudioElement();
    if (!el) return null;

    if (!sourceNode) {
        try {
            const ctx = getAudioContext();
            sourceNode = ctx.createMediaElementSource(el);
            
            // Central Speaker Connection (Connect only ONCE to destination)
            sourceNode.connect(ctx.destination);
        } catch (err) {
            console.error('Failed to create MediaElementSourceNode:', err);
            return null;
        }
    }
    return sourceNode;
}

/**
 * Sets up the Web Audio API pipeline with AnalyserNode for visualization/animation.
 */
export function setupWebAudioAPI() {
    if (isAudioInitialized && analyserNode) return analyserNode;

    const ctx = getAudioContext();
    const source = getAudioSourceNode();

    if (!source) return null;

    try {
        // Create Analyser Node for lip-sync / visualizer amplitude tracking
        analyserNode = ctx.createAnalyser();
        analyserNode.fftSize = CONFIG.FFT_SIZE;
        analyserNode.smoothingTimeConstant = CONFIG.SMOOTHING;

        dataArray = new Uint8Array(analyserNode.frequencyBinCount);

        // Tap into the existing source stream without reconnecting to ctx.destination
        source.connect(analyserNode);

        isAudioInitialized = true;
        return analyserNode;
    } catch (err) {
        console.error('Error setting up Web Audio Analyser API:', err);
        return null;
    }
}

/**
 * Standard Audio Element Listeners
 */
function setupAudioElementListeners() {
    if (!audioElement) return;

    audioElement.addEventListener('ended', () => {
        if (!audioElement.loop) {
            pauseAudio();
        }
    });
}

/**
 * Safely plays audio, auto-resuming AudioContext on user gesture (Safari/Chrome requirement).
 * @returns {Promise<void>}
 */
export async function playAudio() {
    const el = getAudioElement();
    const ctx = getAudioContext();

    if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
    }

    if (el) {
        return el.play();
    }
}

/**
 * Pauses active audio playback.
 */
export function pauseAudio() {
    const el = getAudioElement();
    if (el && !el.paused) {
        el.pause();
    }
}

/**
 * Stops audio and resets playhead to beginning.
 */
export function stopAudio() {
    const el = getAudioElement();
    if (el) {
        el.pause();
        el.currentTime = 0;
    }
}

/**
 * Calculates current normalized audio amplitude (0.0 to 1.0) for mouth animation / lip-sync.
 * @returns {number} Normalized amplitude value
 */
export function getAudioAmplitude() {
    if (!analyserNode || !dataArray) {
        // Fallback setup if called prior to explicit initialization
        if (!setupWebAudioAPI()) return 0;
    }

    const el = getAudioElement();
    if (!el || el.paused) return 0;

    analyserNode.getByteFrequencyData(dataArray);

    let sum = 0;
    const length = dataArray.length;

    for (let i = 0; i < length; i++) {
        sum += dataArray[i];
    }

    const average = sum / length;
    // Normalize 0-255 byte data to 0.0-1.0 float scale
    return Math.min(1.0, average / 128);
}

/**
 * Cleanup function to disconnect nodes and release Web Audio resources cleanly.
 */
export async function destroyAudio() {
    stopAudio();

    if (analyserNode) {
        try { analyserNode.disconnect(); } catch (e) {}
        analyserNode = null;
    }

    if (sourceNode) {
        try { sourceNode.disconnect(); } catch (e) {}
        sourceNode = null;
    }

    if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
        audioContext = null;
    }

    dataArray = null;
    isAudioInitialized = false;
}
