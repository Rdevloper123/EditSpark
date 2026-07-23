/**
 * UI Module - Binds every button, slider, accordion, and tab
 * exactly matching the IDs and classes from index.html.
 */

export function initUI() {
    bindThemeToggle();
    bindHeaderActions();
    bindSidebarTabs();
    bindFilterChips();
    bindCanvasGuidesAndZoom();
    bindMediaControls();
    bindInspectorSliders();
    bindAudioUpload();
}

function bindThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
        });
    }
}

function bindHeaderActions() {
    const newBtn = document.getElementById('btn-new-project');
    const openBtn = document.getElementById('btn-open-project');
    const saveBtn = document.getElementById('btn-save-project');
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');

    if (newBtn) newBtn.addEventListener('click', () => {});
    if (openBtn) openBtn.addEventListener('click', () => {});
    if (saveBtn) saveBtn.addEventListener('click', () => {});
    if (undoBtn) undoBtn.addEventListener('click', () => {});
    if (redoBtn) redoBtn.addEventListener('click', () => {});
}

function bindSidebarTabs() {
    const tabBtns = document.querySelectorAll('.sidebar-tabs .tab-btn');
    const tabContents = document.querySelectorAll('.sidebar-content .tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');

            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            tabContents.forEach(content => {
                content.classList.remove('active');
                content.hidden = true;
            });

            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
                targetPane.hidden = false;
            }
        });
    });
}

function bindFilterChips() {
    const chips = document.querySelectorAll('#category-filters .chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });
}

function bindCanvasGuidesAndZoom() {
    const toggleSafeArea = document.getElementById('toggle-safe-area');
    const toggleThirds = document.getElementById('toggle-thirds');
    const toggleGrid = document.getElementById('toggle-grid');

    const guideSafeArea = document.getElementById('guide-safe-area');
    const guideRuleThirds = document.getElementById('guide-rule-thirds');
    const guideGrid = document.getElementById('guide-grid');

    if (toggleSafeArea && guideSafeArea) {
        toggleSafeArea.addEventListener('click', () => guideSafeArea.classList.toggle('hidden'));
    }
    if (toggleThirds && guideRuleThirds) {
        toggleThirds.addEventListener('click', () => guideRuleThirds.classList.toggle('hidden'));
    }
    if (toggleGrid && guideGrid) {
        toggleGrid.addEventListener('click', () => guideGrid.classList.toggle('hidden'));
    }

    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomFitBtn = document.getElementById('zoom-fit-btn');
    const zoom100Btn = document.getElementById('zoom-100-btn');
    const zoomIndicator = document.getElementById('zoom-indicator');

    let zoomVal = 100;
    const updateZoom = (val) => {
        zoomVal = val;
        if (zoomIndicator) zoomIndicator.textContent = `${zoomVal}%`;
    };

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => updateZoom(Math.min(zoomVal + 10, 200)));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => updateZoom(Math.max(zoomVal - 10, 50)));
    if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => updateZoom(100));
    if (zoom100Btn) zoom100Btn.addEventListener('click', () => updateZoom(100));
}

function bindMediaControls() {
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const loopBtn = document.getElementById('loop-btn');
    const timelineSlider = document.getElementById('timeline-slider');

    if (playBtn) playBtn.addEventListener('click', () => {});
    if (pauseBtn) pauseBtn.addEventListener('click', () => {});
    if (stopBtn) stopBtn.addEventListener('click', () => {});
    if (loopBtn) loopBtn.addEventListener('click', () => {});
    if (timelineSlider) timelineSlider.addEventListener('input', () => {});
}

function bindInspectorSliders() {
    const sliders = [
        { id: 'scale-range', valId: 'scale-val', unit: '%' },
        { id: 'rotation-range', valId: 'rotation-val', unit: '°' },
        { id: 'pos-x-range', valId: 'pos-x-val', unit: 'px' },
        { id: 'pos-y-range', valId: 'pos-y-val', unit: 'px' }
    ];

    sliders.forEach(item => {
        const slider = document.getElementById(item.id);
        const valBadge = document.getElementById(item.valId);
        if (slider && valBadge) {
            slider.addEventListener('input', (e) => {
                valBadge.textContent = `${e.target.value}${item.unit}`;
            });
        }
    });
}

function bindAudioUpload() {
    const uploadBtn = document.getElementById('btn-upload-audio');
    const fileInput = document.getElementById('audio-file-input');
    const fileNameDisplay = document.getElementById('audio-file-name');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                if (fileNameDisplay) fileNameDisplay.textContent = e.target.files[0].name;
            }
        });
    }
}
