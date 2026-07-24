/**
 * Utils Module - Helper functions for timing, math, DOM, file reading, and storage.
 */

export function initUtils() {
    // Utility subsystem initialization hook
}

/**
 * Formats a duration in seconds into MM:SS format.
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const paddedMins = String(mins).padStart(2, '0');
    const paddedSecs = String(secs).padStart(2, '0');
    return `${paddedMins}:${paddedSecs}`;
}

/**
 * Clamps a number between a min and max value.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

/**
 * Linear interpolation between two values.
 * @param {number} start
 * @param {number} end
 * @param {number} amt
 * @returns {number}
 */
export function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

/**
 * Converts degrees to radians.
 * @param {number} degrees
 * @returns {number}
 */
export function degToRad(degrees) {
    return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 * @param {number} radians
 * @returns {number}
 */
export function radToDeg(radians) {
    return (radians * 180) / Math.PI;
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds.
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Creates a throttled function that only invokes func at most once per every limit milliseconds.
 * @param {Function} func
 * @param {number} limit
 * @returns {Function}
 */
export function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

/**
 * Reads a File or Blob as Data URL.
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
export function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * Reads a File or Blob as ArrayBuffer.
 * @param {File|Blob} file
 * @returns {Promise<ArrayBuffer>}
 */
export function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Safely saves data to localStorage.
 * @param {string} key
 * @param {*} data
 */
export function saveToLocalStorage(key, data) {
    try {
        const serialized = JSON.stringify(data);
        localStorage.setItem(key, serialized);
    } catch (err) {
        console.error('Failed to save to localStorage:', err);
    }
}

/**
 * Safely loads data from localStorage.
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
export function loadFromLocalStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (err) {
        console.error('Failed to load from localStorage:', err);
        return defaultValue;
    }
}
