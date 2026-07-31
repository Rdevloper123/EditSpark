// ------------------------------------------------------------------
    // 5. AUDIO ANALYZER - SMOOTH SPEECH WITH NATURAL HOLD (NO RAPID FLUTTER)
    // ------------------------------------------------------------------
    let mouthHoldCounter = 0; // Thehraav ke liye counter

    function setupAudioContext() {
        if (!audioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioCtx();
            audioAnalyser = audioContext.createAnalyser();
            audioAnalyser.fftSize = 128; // Standard smooth frequency bin

            audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);

            audioSource = audioContext.createMediaElementSource(audioElement);
            audioSource.connect(audioAnalyser);
            audioAnalyser.connect(audioContext.destination);
        }
    }

    function analyzeAudioEnergy() {
        if (!audioAnalyser || !audioDataArray) return;

        audioAnalyser.getByteFrequencyData(audioDataArray);
        let sum = 0;
        const len = audioDataArray.length;
        for (let i = 0; i < len; i++) {
            sum += audioDataArray[i];
        }
        const currentEnergy = sum / len;

        // Speech Threshold
        if (currentEnergy > 14) {
            currentMouthKey = 'open';
            mouthHoldCounter = 4; // Jab aawaz aaye toh kam se kam 4 frames tak mouth open rahega (Smooth Thehraav)
        } else {
            if (mouthHoldCounter > 0) {
                mouthHoldCounter--;
                currentMouthKey = 'open'; // Soft descent
            } else {
                currentMouthKey = 'closed'; // Jab aawaz sach mein band ho tabhi mouth close hoga
            }
        }
    }
