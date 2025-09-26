/**
 * Recursively freezes an object and all its nested properties.
 * @param {any} obj - Object to freeze
 * @returns {any} The frozen object
 */
export function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    Object.keys(obj).forEach(key => deepFreeze(obj[key]));
    return Object.freeze(obj);
}