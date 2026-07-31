/**
 * Talking Photo Video Maker - Main Application Logic
 * Optimized for high performance, zero external dependencies, and smooth lip sync.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Canvas & Context Setup
    const canvas = document.getElementById('animCanvas');
    const ctx = canvas.getContext('2d');

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

    // Image Caching (Reusable Objects to avoid memory allocation)
    const charImage = new Image();
    const mouthImages = {
        closed: new Image(),
        tiny: new Image(),
        small: new Image(),
        medium: new Image(),
        large: new Image(),
        wide: new Image(),
        round_o: new Image(),
        smile: new Image()
    };

    // Load Mouth Images from Assets
    const mouthPaths = {
        closed: 'assets/mouths/mouth_closed.png',
        tiny: 'assets/mouths/mouth_tiny.png',
        small: 'assets/mouths/mouth_small.png',
        medium: 'assets/mouths/mouth_medium.png',
        large: 'assets/mouths/mouth_large.png',
        wide: 'assets/mouths/mouth_wide.png',
        round_o: 'assets/mouths/mouth_round_o.png',
        smile: 'assets/mouths/mouth_smile.png'
    };

    Object.keys(mouthPaths).forEach(key => {
        mouthImages[key].src = mouthPaths[key];
    });

    // Application State Variables
    let currentMouthKey = 'closed';
    let isMouthMirrored = false;
    let mouthScale = 1;
    let mouthOpacity = 1;

    // Transform State (Character)
    let charTransform = { x: 0, y: 0, scale: 1 };
    
    // Transform State (Mouth relative to Canvas)
    let mouthTransform = { x: 540, y: 1100 }; // Centered default for 1080x1920

    // Interaction Drag State
    let isDragging = false;
    let dragTarget = null; // 'character' or 'mouth'
    let startX = 0;
    let startY = 0;
    let initialPinchDistance = null;

    // Web Audio API & Audio Elements
    let audioContext = null;
    let audioAnalyser = null;
    let audioSource = null;
    let audioBuffer = null;
    const audioElement = new Audio();
    
    // Export Variables
    let mediaRecorder = null;
    let recordedChunks = [];
    let isExporting = false;

    // Initial Character Setup
    loadCharacter('assets/characters/boy.png');

    function loadCharacter(src) {
        charImage.crossOrigin = "anonymous";
        charImage.onload = () => {
            // Reset character transform to cover canvas proportionally
            const hRatio = canvas.width / charImage.width;
            const vRatio = canvas.height / charImage.height;
            charTransform.scale = Math.max(hRatio, vRatio);
            charTransform.x = (canvas.width - charImage.width * charTransform.scale) / 2;
            charTransform.y = (canvas.height - charImage.height * charTransform.scale) / 2;
            requestAnimationFrame(drawCanvas);
        };
        charImage.src = src;
    }

    // ------------------------------------------------------------------
    // CANVAS RENDERING ENGINE (Single Animation Loop)
    // ------------------------------------------------------------------

    function drawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Character
        if (charImage.complete && charImage.naturalWidth !== 0) {
            ctx.drawImage(
                charImage,
                charTransform.x,
                charTransform.y,
                charImage.width * charTransform.scale,
                charImage.height * charTransform.scale
            );
        }

        // Draw Active Mouth Shape
        const currentMouthImg = mouthImages[currentMouthKey];
        if (currentMouthImg && currentMouthImg.complete && currentMouthImg.naturalWidth !== 0) {
            ctx.save();
            ctx.globalAlpha = mouthOpacity;
            
            // Translate to Mouth Center
            ctx.translate(mouthTransform.x, mouthTransform.y);
            
            // Apply Mirroring
            if (isMouthMirrored) {
                ctx.scale(-1, 1);
            }

            // Draw Mouth Scaled Centered
            const drawW = currentMouthImg.width * mouthScale;
            const drawH = currentMouthImg.height * mouthScale;
            
            ctx.drawImage(
                currentMouthImg,
                -drawW / 2,
                -drawH / 2,
                drawW,
                drawH
            );
            
            ctx.restore();
        }
    }

    // Main Loop triggered during playback
    function renderLoop() {
        if (!audioElement.paused || isExporting) {
            analyzeAudioEnergy();
            drawCanvas();
            requestAnimationFrame(renderLoop);
        } else {
            currentMouthKey = 'closed';
            drawCanvas();
        }
    }

    // ------------------------------------------------------------------
    // WEB AUDIO API ANALYZER (LIP SYNC)
    // ------------------------------------------------------------------

    function setupAudioContext() {
        if (!audioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioCtx();
            audioAnalyser = audioContext.createAnalyser();
            audioAnalyser.fftSize = 256;
            
            audioSource = audioContext.createMediaElementSource(audioElement);
            audioSource.connect(audioAnalyser);
            audioAnalyser.connect(audioContext.destination);
        }
    }

    function analyzeAudioEnergy() {
        if (!audioAnalyser) return;

        const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
        audioAnalyser.getByteFrequencyData(dataArray);

        // Calculate average volume energy
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Smooth energy thresholding to prevent flicker
        if (average < 8) {
            currentMouthKey = 'closed';
        } else if (average < 25) {
            currentMouthKey = 'tiny';
        } else if (average < 40) {
            currentMouthKey = 'small';
        } else if (average < 55) {
            currentMouthKey = 'medium';
        } else if (average < 70) {
            currentMouthKey = 'large';
        } else if (average < 85) {
            currentMouthKey = 'wide';
        } else if (average < 100) {
            currentMouthKey = 'round_o';
        } else {
            currentMouthKey = 'smile';
        }
    }

    // ------------------------------------------------------------------
    // EVENT LISTENERS & UI HANDLERS
    // ------------------------------------------------------------------

    // Character Selection
    charThumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
            charThumbs.forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
            const charName = thumb.getAttribute('data-char');
            loadCharacter(`assets/characters/${charName}.png`);
        });
    });

    // Custom Character Upload
    customCharInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            charThumbs.forEach(t => t.classList.remove('active'));
            loadCharacter(url);
        }
    });

    // Audio File Upload
    audioFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const url = URL.createObjectURL(file);
        audioElement.src = url;

        audioElement.onloadedmetadata = () => {
            if (audioElement.duration > 60) {
                alert('Please upload an audio file less than 60 seconds.');
                audioElement.src = '';
                return;
            }
            audioInfo.textContent = `${file.name}`;
            durationTimeEl.textContent = formatTime(audioElement.duration);
            seekBar.max = audioElement.duration;
            seekBar.disabled = false;
            playBtn.disabled = false;
            stopBtn.disabled = false;
            exportBtn.disabled = false;
        };
    });

    // Audio Controls
    playBtn.addEventListener('click', () => {
        setupAudioContext();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
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

    // Mouth Controls
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

    // Format Seconds to MM:SS
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // ------------------------------------------------------------------
    // CANVAS INTERACTION HANDLERS (Drag & Pinch Zoom)
    // ------------------------------------------------------------------

    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // Map viewport to internal canvas resolution (1080x1920)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function startInteraction(e) {
        if (e.touches && e.touches.length === 2) {
            // Touch pinch gesture initialization for scaling character
            initialPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            return;
        }

        const coords = getCanvasCoords(e);
        startX = coords.x;
        startY = coords.y;

        // Hit detection on Mouth first
        const distToMouth = Math.hypot(coords.x - mouthTransform.x, coords.y - mouthTransform.y);
        if (distToMouth < 150) { // Hitbox radius around mouth center
            dragTarget = 'mouth';
        } else {
            dragTarget = 'character';
        }
        isDragging = true;
    }

    function moveInteraction(e) {
        if (e.touches && e.touches.length === 2 && initialPinchDistance) {
            // Handle pinch zoom scaling on character
            const currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const factor = currentDist / initialPinchDistance;
            charTransform.scale *= factor;
            initialPinchDistance = currentDist;
            drawCanvas();
            return;
        }

        if (!isDragging) return;

        const coords = getCanvasCoords(e);
        const dx = coords.x - startX;
        const dy = coords.y - startY;

        if (dragTarget === 'mouth') {
            mouthTransform.x += dx;
            mouthTransform.y += dy;
        } else if (dragTarget === 'character') {
            charTransform.x += dx;
            charTransform.y += dy;
        }

        startX = coords.x;
        startY = coords.y;
        drawCanvas();
    }

    function endInteraction() {
        isDragging = false;
        dragTarget = null;
        initialPinchDistance = null;
    }

    // Pointer Event Registration
    canvas.addEventListener('mousedown', startInteraction);
    canvas.addEventListener('mousemove', moveInteraction);
    window.addEventListener('mouseup', endInteraction);

    canvas.addEventListener('touchstart', startInteraction, { passive: true });
    canvas.addEventListener('touchmove', moveInteraction, { passive: true });
    window.addEventListener('touchend', endInteraction);

    // Mouse Wheel Scaling for Character
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
        charTransform.scale *= zoomFactor;
        drawCanvas();
    }, { passive: false });

    // ------------------------------------------------------------------
    // EXPORT ENGINE (Fast MediaRecorder WebM Export)
    // ------------------------------------------------------------------

    exportBtn.addEventListener('click', async () => {
        if (!audioElement.src || audioElement.duration === 0) return;

        setupAudioContext();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Reset Audio and UI State
        audioElement.currentTime = 0;
        isExporting = true;
        exportBtn.disabled = true;
        exportBtn.textContent = "Rendering Video...";

        // 1. Capture stream directly from canvas at 30 FPS
        const canvasStream = canvas.captureStream(30);

        // 2. Mix audio output stream with video stream
        const dest = audioContext.createMediaStreamDestination();
        audioSource.connect(dest);
        
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        // 3. Setup MediaRecorder
        recordedChunks = [];
        const options = { mimeType: 'video/webm;codecs=vp8,opus' };
        
        try {
            mediaRecorder = new MediaRecorder(combinedStream, options);
        } catch (e) {
            // Fallback for browsers with default WebM settings
            mediaRecorder = new MediaRecorder(combinedStream);
        }

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            // Package recorded chunks into a downloadable WebM Blob
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `talking-photo-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Cleanup & Reset Controls
            isExporting = false;
            exportBtn.disabled = false;
            exportBtn.textContent = "Export WebM Video";
            playBtn.disabled = false;
            pauseBtn.disabled = true;
            currentMouthKey = 'closed';
            drawCanvas();
        };

        // Start Recording and Audio Playback simultaneously
        mediaRecorder.start();
        audioElement.play();
        requestAnimationFrame(renderLoop);

        // Automatically Stop recording when audio finishes
        audioElement.onended = () => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        };
    });
});
