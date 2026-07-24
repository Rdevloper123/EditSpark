/**
 * Audio Module - Manages audio playback, timeline updates, volume/speed controls,
 * Web Audio API AnalyserNode, DOM caching, pointer capture dragging, and AbortController teardown.
 */

import { formatTime } from './utils.js';

let audioElement = null;
let audioContext = null;
let analyser = null;
let dataArray = null;
let sourceNode = null;
let currentAudioObjectURL = null;

let isMuted = false;

// Event Teardown Controller
let audioAbortController = null;

// DOM Cache Map
const dom = {};

export function initAudio() {
    // Clean any prior instance/listeners before binding
    destroyAudio();

    audioAbortController = new AbortController();
    cacheDOM();
    setupAudioElement();
    bindAudioControls();
}

/**
 * Caches DOM element references to avoid repetitive lookups during frame updates.
 */
function cacheDOM() {
    dom.fileInput = document.getElementById('audio-file-input');
    dom.fileNameDisplay = document.getElementById('audio-file-name');
    dom.playBtn = document.getElementById('play-btn');
    dom.pauseBtn = document.getElementById('pause-btn');
    dom.stopBtn = document.getElementById('stop-btn');
    dom.loopBtn = document.getElementById('loop-btn');
    dom.muteBtn = document.getElementById('mute-btn');
    dom.volumeSlider = document.getElementById('volume-slider');
    dom.speedSelect = document.getElementById('speed-select');
    dom.timelineSlider = document.getElementById('timeline-slider');
    dom.currentTimeDisplay = document.getElementById('current-time');
    dom.totalDurationDisplay = document.getElementById('total-duration');
}

/**
 * Initializes HTML5 Audio element instance and event listeners with signal management.
 */
function setupAudioElement() {
    if (!audioElement) {
        audioElement = new Audio();
    }

    const signal = audioAbortController?.signal;

    audioElement.addEventListener('loadedmetadata', () => {
        updateDurationDisplay();
        if (dom.timelineSlider) {
            dom.timelineSlider.max = audioElement.duration || 100;
            dom.timelineSlider.value = 0;
        }
    }, { signal });

    audioElement.addEventListener('timeupdate', () => {
        if (dom.currentTimeDisplay) {
            dom.currentTimeDisplay.textContent = formatTime(audioElement.currentTime);
        }

        if (dom.timelineSlider && !dom.timelineSlider.dataset.isDragging) {
            dom.timelineSlider.value = audioElement.currentTime;
        }
    }, { signal });

    audioElement.addEventListener('ended', () => {
        if (!audioElement.loop) {
            pauseAudio();
        }
    }, { signal });
}

/**
 * Sets up Web Audio API AnalyserNode for Time Domain data extraction.
 */
function setupWebAudioAPI() {
    if (audioContext) return;

    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtx();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;

        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        sourceNode = audioContext.createMediaElementSource(audioElement);
        sourceNode.connect(analyser);
        analyser.connect(audioContext.destination);
    } catch (err) {
        console.warn('Web Audio API setup notice:', err);
    }
}

/**
 * Returns current audio amplitude (0 to 1 range) based on Time-Domain Waveform data.
 * @returns {number}
 */
export function getAudioAmplitude() {
    if (!analyser || !dataArray || !audioElement || audioElement.paused) return 0;

    analyser.getByteTimeDomainData(dataArray);

    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / dataArray.length);
    return Math.min(rms * 2.5, 1);
}

/**
 * Binds DOM controls using Pointer Capture and AbortSignal for strict cleanup.
 */
function bindAudioControls() {
    if (!audioAbortController) return;
    const { signal } = audioAbortController;

    if (dom.fileInput) {
        dom.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                loadAudioFile(file);
            }
        }, { signal });
    }

    if (dom.playBtn) dom.playBtn.addEventListener('click', () => playAudio(), { signal });
    if (dom.pauseBtn) dom.pauseBtn.addEventListener('click', () => pauseAudio(), { signal });
    if (dom.stopBtn) dom.stopBtn.addEventListener('click', () => stopAudio(), { signal });

    if (dom.loopBtn) {
        dom.loopBtn.addEventListener('click', () => {
            if (!audioElement) return;
            audioElement.loop = !audioElement.loop;
            dom.loopBtn.classList.toggle('active', audioElement.loop);
        }, { signal });
    }

    if (dom.muteBtn) {
        dom.muteBtn.addEventListener('click', () => {
            if (!audioElement) return;
            isMuted = !isMuted;
            audioElement.muted = isMuted;
            dom.muteBtn.classList.toggle('active', isMuted);
        }, { signal });
    }

    if (dom.volumeSlider) {
        dom.volumeSlider.addEventListener('input', (e) => {
            if (!audioElement) return;
            const rawVal = parseFloat(e.target.value);
            const normalizedVol = rawVal > 1 ? rawVal / 100 : rawVal;
            
            audioElement.volume = Math.max(0, Math.min(1, normalizedVol));
            isMuted = audioElement.volume === 0;
            if (dom.muteBtn) dom.muteBtn.classList.toggle('active', isMuted);
        }, { signal });
    }

    if (dom.speedSelect) {
        dom.speedSelect.addEventListener('change', (e) => {
            if (!audioElement) return;
            audioElement.playbackRate = parseFloat(e.target.value);
        }, { signal });
    }

    if (dom.timelineSlider) {
        const stopDrag = (e) => {
            if (dom.timelineSlider.dataset.isDragging) {
                delete dom.timelineSlider.dataset.isDragging;
                if (audioElement) {
                    audioElement.currentTime = parseFloat(dom.timelineSlider.value);
                }
            }
            if (e.target.hasPointerCapture && e.target.hasPointerCapture(e.pointerId)) {
                e.target.releasePointerCapture(e.pointerId);
            }
        };

        dom.timelineSlider.addEventListener('pointerdown', (e) => {
            dom.timelineSlider.dataset.isDragging = 'true';
            e.target.setPointerCapture(e.pointerId);
        }, { signal });

        dom.timelineSlider.addEventListener('pointerup', stopDrag, { signal });
        dom.timelineSlider.addEventListener('pointercancel', stopDrag, { signal });
        dom.timelineSlider.addEventListener('lostpointercapture', stopDrag, { signal });

        dom.timelineSlider.addEventListener('input', (e) => {
            if (dom.currentTimeDisplay) {
                dom.currentTimeDisplay.textContent = formatTime(parseFloat(e.target.value));
            }
        }, { signal });
    }
}

/**
 * Loads selected File object into the audio player and revokes old Object URLs.
 * @param {File} file
 */
export function loadAudioFile(file) {
    if (!file) return;

    if (currentAudioObjectURL) {
        URL.revokeObjectURL(currentAudioObjectURL);
    }

    currentAudioObjectURL = URL.createObjectURL(file);
    if (audioElement) {
        audioElement.src = currentAudioObjectURL;
        audioElement.load();
    }

    if (dom.fileNameDisplay) {
        dom.fileNameDisplay.textContent = file.name;
    }
}

/**
 * Async audio play trigger with AudioContext resume safety (handles 'suspended' and Safari 'interrupted' states).
 */
export async function playAudio() {
    if (!audioElement || !audioElement.src) return;

    setupWebAudioAPI();

    try {
        if (audioContext && (audioContext.state === 'suspended' || audioContext.state === 'interrupted')) {
            await audioContext.resume();
        }
        await audioElement.play();
    } catch (err) {
        console.error('Audio playback failed or policy restricted:', err);
    }
}

/**
 * Pauses active audio playback.
 */
export function pauseAudio() {
    if (audioElement) {
        audioElement.pause();
    }
}

/**
 * Stops audio playback and resets timeline.
 */
export function stopAudio() {
    if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
    }

    if (dom.timelineSlider) {
        dom.timelineSlider.value = 0;
    }

    if (dom.currentTimeDisplay) {
        dom.currentTimeDisplay.textContent = '00:00';
    }
}

/**
 * Complete Audio Module teardown: revokes Object URLs, closes AudioContext, and unbinds all listeners via AbortController.
 */
export async function destroyAudio() {
    stopAudio();

    if (audioAbortController) {
        audioAbortController.abort();
        audioAbortController = null;
    }

    if (currentAudioObjectURL) {
        URL.revokeObjectURL(currentAudioObjectURL);
        currentAudioObjectURL = null;
    }

    if (audioContext) {
        try {
            await audioContext.close();
        } catch (err) {
            console.warn('Error closing AudioContext:', err);
        }
        audioContext = null;
        analyser = null;
        dataArray = null;
        sourceNode = null;
    }

    if (audioElement) {
        audioElement.src = '';
        audioElement.load();
    }
}

/**
 * Updates UI total duration text display.
 */
function updateDurationDisplay() {
    if (dom.totalDurationDisplay && audioElement) {
        dom.totalDurationDisplay.textContent = formatTime(audioElement.duration || 0);
    }
}
