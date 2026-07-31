/**
 * Talking Photo Video Maker - Ultra High-Performance Architecture
 * Optimized for low memory footprint, Offscreen Canvas Caching & Zero Garbage Collection.
 */
document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------
    // 1. DYNAMIC CANVAS RESOLUTIONS (Preview vs Export)
    // ------------------------------------------------------------------
    const PREVIEW_WIDTH = 360;
    const PREVIEW_HEIGHT = 640;
    const EXPORT_WIDTH = 720;
    const EXPORT_HEIGHT = 1280;

    const canvas = document.getElementById('animCanvas');
    // Enabled alpha channel to correctly composite transparent PNG overlays
    const ctx = canvas.getContext('2d');

    // Set initial preview resolution
    canvas.width = PREVIEW_WIDTH;
    canvas.height = PREVIEW_HEIGHT;

    // UI Element References
    const charThumbs = document.querySelectorAll('.char-thumb');
    const customCharInput = document.getElementById('customCharInput');
    const audioFileInput = document.getElementById('audioFileInput');
    const audioInfo = document.getElementById('audioInfo');
    const seekBar = document.getElementById('seekBar');
    const currentTimeEl = document.getElementById('currentTime');
    const durationTimeEl = document.getElementById('durationTime');
    const mouthScaleSlider = document.getElementById('mouthScale');
    const mouthOpacitySlider = document.getElementById('mouthOpacity');
    const mirrorMouthBtn = document.getElementById('mirrorMouthBtn');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const exportBtn = document.getElementById('exportBtn');

    // ------------------------------------------------------------------
    // 2. OFFSCREEN CANVAS CACHING & REUSABLE BUFFERS
    // ------------------------------------------------------------------
    const charImage = new Image();
    const offscreenCharCanvas = document.createElement('canvas');
    const offscreenCharCtx = offscreenCharCanvas.getContext('2d');

    // Reduced to only 4 essential mouth shapes
    const mouthImages = {
        closed: new Image(),
        small: new Image(),
        medium: new Image(),
        large: new Image()
    };
    const mouthPaths = {
        closed: 'assets/mouths/mouth_closed.png',
        small: 'assets/mouths/mouth_small.png',
        medium: 'assets/mouths/mouth_medium.png',
        large: 'assets/mouths/mouth_large.png'
    };

    Object.keys(mouthPaths).forEach(key => {
        mouthImages[key].crossOrigin = "anonymous";
        mouthImages[key].onload = () => drawCanvas();
        mouthImages[key].src = mouthPaths[key];
    });

    // Application States
    let currentMouthKey = 'closed';
    let isMouthMirrored = false;
    let mouthScale = 1;
    let mouthOpacity = 1;

    // Normalized Transforms (0 to 1 relative ratios for dynamic resolution switching)
    let charTransform = { xRatio: 0, yRatio: 0, scaleRatio: 1 };
    let mouthTransform = { xRatio: 0.5, yRatio: 0.58 }; // Centered relative ratio

    // Interaction Drag States
    let isDragging = false;
    let dragTarget = null;
    let startX = 0;
    let startY = 0;

    // Web Audio API & Single Pre-allocated Buffer
    let audioContext = null;
    let audioAnalyser = null;
    let audioSource = null;
    let audioDataArray = null; // Reused Uint8Array to avoid Garbage Collection
    const audioElement = new Audio();

    // Export & Animation Loop Controls
    let mediaRecorder = null;
    let recordedChunks = [];
    let isExporting = false;
    let lastFrameTime = 0;
    const previewFPS = 20; // 20 FPS for smooth preview on mobile
    const exportFPS = 24;  // 24 FPS optimal for Shorts/Reels

    // Initial Load
    loadCharacter('assets/characters/boy.png');

    // ------------------------------------------------------------------
    // 3. CHARACTER CACHING ENGINE
    // ------------------------------------------------------------------
    function loadCharacter(src) {
        charImage.crossOrigin = "anonymous";
        charImage.onload = () => {
            // Cache loaded image into OffscreenCanvas at base resolution
            offscreenCharCanvas.width = charImage.naturalWidth;
            offscreenCharCanvas.height = charImage.naturalHeight;
            offscreenCharCtx.clearRect(0, 0, offscreenCharCanvas.width, offscreenCharCanvas.height);
            offscreenCharCtx.drawImage(charImage, 0, 0);

            // Compute relative aspect ratio transforms
            const currentW = canvas.width;
            const currentH = canvas.height;
            const hRatio = currentW / charImage.naturalWidth;
            const vRatio = currentH / charImage.naturalHeight;
            const scale = Math.max(hRatio, vRatio);
            charTransform.scaleRatio = scale / currentW;
            charTransform.xRatio = ((currentW - charImage.naturalWidth * scale) / 2) / currentW;
            charTransform.yRatio = ((currentH - charImage.naturalHeight * scale) / 2) / currentH;

            drawCanvas();
        };
        charImage.src = src;
    }

    // ------------------------------------------------------------------
    // 4. RENDERING ENGINE (Resolution Independent)
    // ------------------------------------------------------------------
    function drawCanvas() {
        const curW = canvas.width;
        const curH = canvas.height;
        ctx.clearRect(0, 0, curW, curH);

        // Draw Cached Character from Offscreen Canvas
        if (offscreenCharCanvas.width > 0) {
            const drawX = charTransform.xRatio * curW;
            const drawY = charTransform.yRatio * curH;
            const drawW = offscreenCharCanvas.width * (charTransform.scaleRatio * curW);
            const drawH = offscreenCharCanvas.height * (charTransform.scaleRatio * curW);
            ctx.drawImage(offscreenCharCanvas, drawX, drawY, drawW, drawH);
        }

        // Draw Mouth Overlay
        const mouthImg = mouthImages[currentMouthKey];
        if (mouthImg && mouthImg.complete && mouthImg.naturalWidth !== 0) {
            ctx.save();
            ctx.globalAlpha = mouthOpacity;
            const mouthX = mouthTransform.xRatio * curW;
            const mouthY = mouthTransform.yRatio * curH;
            ctx.translate(mouthX, mouthY);
            if (isMouthMirrored) ctx.scale(-1, 1);

            // Responsive Scaling based on current canvas width
            const baseScale = (curW / PREVIEW_WIDTH);
            const drawW = mouthImg.naturalWidth * mouthScale * baseScale * 0.5;
            const drawH = mouthImg.naturalHeight * mouthScale * baseScale * 0.5;
            ctx.drawImage(mouthImg, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
        }
    }

    // Throttle Loop to target FPS
    function renderLoop(timestamp) {
        if (audioElement.paused && !isExporting) {
            currentMouthKey = 'closed';
            drawCanvas();
            return;
        }

        const targetFPS = isExporting ? exportFPS : previewFPS;
        const interval = 1000 / targetFPS;
        const delta = timestamp - lastFrameTime;

        if (delta >= interval) {
            lastFrameTime = timestamp - (delta % interval);
            analyzeAudioEnergy();
            drawCanvas();
        }

        requestAnimationFrame(renderLoop);
    }

    // ------------------------------------------------------------------
    // 5. AUDIO ANALYZER (Zero Allocation & 4 Threshold States)
    // ------------------------------------------------------------------
    function setupAudioContext() {
        if (!audioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioCtx();
            audioAnalyser = audioContext.createAnalyser();
            audioAnalyser.fftSize = 128; // Smaller FFT size = faster processing

            // Reusable single Uint8Array instance
            audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);

            audioSource = audioContext.createMediaElementSource(audioElement);
            audioSource.connect(audioAnalyser);
            audioAnalyser.connect(audioContext.destination);
        }
    }

    function analyzeAudioEnergy() {
        if (!audioAnalyser || !audioDataArray) return;

        // Populate existing array without allocating new memory
        audioAnalyser.getByteFrequencyData(audioDataArray);
        let sum = 0;
        const len = audioDataArray.length;
        for (let i = 0; i < len; i++) {
            sum += audioDataArray[i];
        }
        const average = sum / len;

        // 4 Simple thresholds
        if (average < 12) {
            currentMouthKey = 'closed';
        } else if (average < 35) {
            currentMouthKey = 'small';
        } else if (average < 65) {
            currentMouthKey = 'medium';
        } else {
            currentMouthKey = 'large';
        }
    }

    // ------------------------------------------------------------------
    // 6. EVENT LISTENERS & TOUCH CONTROLS
    // ------------------------------------------------------------------
    charThumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
            charThumbs.forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
            loadCharacter(`assets/characters/${thumb.getAttribute('data-char')}.png`);
        });
    });

    customCharInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            loadCharacter(URL.createObjectURL(file));
            charThumbs.forEach(t => t.classList.remove('active'));
        }
    });

    audioFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        audioElement.src = URL.createObjectURL(file);
        audioElement.onloadedmetadata = () => {
            if (audioElement.duration > 60) {
                alert('Audio file must be under 60 seconds.');
                audioElement.src = '';
                return;
            }
            audioInfo.textContent = file.name;
            durationTimeEl.textContent = formatTime(audioElement.duration);
            seekBar.max = audioElement.duration;
            seekBar.disabled = false;
            playBtn.disabled = false;
            stopBtn.disabled = false;
            exportBtn.disabled = false;
        };
    });

    playBtn.addEventListener('click', () => {
        setupAudioContext();
        if (audioContext.state === 'suspended') audioContext.resume();
        audioElement.play();
        playBtn.disabled = true;
        pauseBtn.disabled = false;
        requestAnimationFrame(renderLoop);
    });

    pauseBtn.addEventListener('click', () => {
        audioElement.pause();
        playBtn.disabled = false;
        pauseBtn.disabled = true;
    });

    stopBtn.addEventListener('click', () => {
        audioElement.pause();
        audioElement.currentTime = 0;
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        currentMouthKey = 'closed';
        drawCanvas();
    });

    audioElement.addEventListener('timeupdate', () => {
        seekBar.value = audioElement.currentTime;
        currentTimeEl.textContent = formatTime(audioElement.currentTime);
    });

    audioElement.addEventListener('ended', () => {
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        currentMouthKey = 'closed';
        drawCanvas();
    });

    seekBar.addEventListener('input', () => {
        audioElement.currentTime = seekBar.value;
        drawCanvas();
    });

    mouthScaleSlider.addEventListener('input', (e) => {
        mouthScale = parseFloat(e.target.value);
        drawCanvas();
    });

    mouthOpacitySlider.addEventListener('input', (e) => {
        mouthOpacity = parseFloat(e.target.value);
        drawCanvas();
    });

    mirrorMouthBtn.addEventListener('click', () => {
        isMouthMirrored = !isMouthMirrored;
        drawCanvas();
    });

    function formatTime(secs) {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // Touch & Mouse Drag Handlers
    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) / rect.width,
            y: (clientY - rect.top) / rect.height
        };
    }

    function startDrag(e) {
        const coords = getCoords(e);
        startX = coords.x;
        startY = coords.y;
        const distToMouth = Math.hypot(coords.x - mouthTransform.xRatio, coords.y - mouthTransform.yRatio);
        dragTarget = distToMouth < 0.2 ? 'mouth' : 'character';
        isDragging = true;
    }

    function moveDrag(e) {
        if (!isDragging) return;
        const coords = getCoords(e);
        const dx = coords.x - startX;
        const dy = coords.y - startY;

        if (dragTarget === 'mouth') {
            mouthTransform.xRatio += dx;
            mouthTransform.yRatio += dy;
        } else {
            charTransform.xRatio += dx;
            charTransform.yRatio += dy;
        }

        startX = coords.x;
        startY = coords.y;
        drawCanvas();
    }

    function endDrag() {
        isDragging = false;
        dragTarget = null;
    }

    canvas.addEventListener('mousedown', startDrag);
    canvas.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', endDrag);
    canvas.addEventListener('touchstart', startDrag, { passive: true });
    canvas.addEventListener('touchmove', moveDrag, { passive: true });
    window.addEventListener('touchend', endDrag);

    // ------------------------------------------------------------------
    // 7. FAST EXPORT ENGINE (Switch Resolution to 720x1280 during export)
    // ------------------------------------------------------------------
    exportBtn.addEventListener('click', async () => {
        if (!audioElement.src) return;

        setupAudioContext();
        if (audioContext.state === 'suspended') await audioContext.resume();

        // Switch Canvas Resolution to 720x1280 for Export
        canvas.width = EXPORT_WIDTH;
        canvas.height = EXPORT_HEIGHT;
        drawCanvas();

        audioElement.currentTime = 0;
        isExporting = true;
        exportBtn.disabled = true;
        exportBtn.textContent = "Rendering (24 FPS)...";

        // Capture Stream at fixed 24 FPS
        const canvasStream = canvas.captureStream(exportFPS);
        const dest = audioContext.createMediaStreamDestination();
        audioSource.connect(dest);

        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        recordedChunks = [];
        // Use default standard webm container for low CPU encoding
        mediaRecorder = new MediaRecorder(combinedStream);

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `talking-photo-${Date.now()}.webm`;
            a.click();

            // Reset back to Low-Res Preview (360x640)
            canvas.width = PREVIEW_WIDTH;
            canvas.height = PREVIEW_HEIGHT;
            isExporting = false;
            exportBtn.disabled = false;
            exportBtn.textContent = "Export WebM Video";
            playBtn.disabled = false;
            pauseBtn.disabled = true;
            currentMouthKey = 'closed';
            drawCanvas();
        };

        mediaRecorder.start();
        audioElement.play();
        requestAnimationFrame(renderLoop);

        audioElement.onended = () => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        };
    });
});
