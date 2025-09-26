import { deepFreeze } from "./Util.js";

/**
 * Converts a hex color code to RGB values.
 * @param {string|number} hex - Hex color code (with or without #, or as number)
 * @returns {[number, number, number]} RGB values as [r, g, b] array
 */
export function hexToRgb(hex) {
    if (!isNaN(hex)) {
        hex = hex.toString(16);
        if (hex.length === 8 || hex.length === 5) {
            hex = hex.slice(2);
        }
    } else if (hex[0] === "#") {
        hex = hex.slice(1);
    }
    if (hex.length === 3) {
        hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    const r = Number(`0x${hex.slice(0, 2)}`);
    const g = Number(`0x${hex.slice(2, 4)}`);
    const b = Number(`0x${hex.slice(4, 6)}`);
    return [r, g, b];
}

/**
 * Converts any arbitrary string into RGB values via hashing.
 * @param {string} str - String to convert to RGB
 * @returns {[number, number, number]} RGB values as [r, g, b] array
 */
export function strToRgb(str) {
    const rgb = [0, 0, 0];
    if (str.length === 0) return rgb;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    for (let i = 0; i < 3; i++) {
        rgb[i] = (hash >> (i * 8)) & 255;
    }
    return rgb;
}

/**
 * ANSI escape codes for terminal effects and colors.
 * @readonly
 */
export const effects = deepFreeze({
    /** @type {30} */
    gray: 30,
    /** @type {31} */
    red: 31,
    /** @type {32} */
    green: 32,
    /** @type {33} */
    yellow: 33,
    /** @type {34} */
    blue: 34,
    /** @type {35} */
    magenta: 35,
    /** @type {36} */
    cyan: 36,
    /** @type {37} */
    white: 37,
    /** @type {39} */
    default: 39,
    /** @type {4} */
    underline: 4,
    /** @type {1} */
    bold: 1,
    /** @type {3} */
    italic: 3,
    /** @type {9} */
    strike: 9
})

/**
 * Creates a template literal function for applying ANSI effects.
 * @param {...string|number} args - Effect names or codes
 * @returns {function(TemplateStringsArray, ...vars: any[]): string} Template literal function
 */
export function effect(...args) {
    return function (strings, ...vars) {
        let str = `\x1b[${args.map(arg => {
            if (Object.hasOwn(effects, arg))
                return effects[arg];
            return arg;
        }).join(';')}m`;
        strings.forEach((string, i) => {
            str += `${string}${vars[i] ?? '\x1b[0m'}`;
        });
        return str;
    }
}

/**
 * Converts a foreground color code to a background color code.
 * @param {string} color - Color code to convert
 * @returns {string|number|undefined} Background color code
 */
export function bg(color) {
    if (color.startsWith("3")) {
        return color.replace("3", "4");
    } else if (Object.hasOwn(effects, color)) {
        return effects[color] + 10;
    }
}

/**
 * Creates an RGB color code for ANSI escape sequences.
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {string} ANSI RGB color code
 */
export function rgb(r,g,b) {
    return `38;2;${r};${g};${b}`;
}

/**
 * Creates an ANSI RGB color code from a hex color.
 * @param {string|number} code - Hex color code
 * @returns {string} ANSI RGB color code
 */
export function hex(code) {
    return rgb(...hexToRgb(code));
}

/**
 * Creates an ANSI RGB color code from a string hash.
 * @param {string} str - String to hash for color
 * @returns {string} ANSI RGB color code
 */
export function hash(str) {
    return rgb(...strToRgb(str));
}

/**
 * Creates an ANSI color code for a 256-color palette ID.
 * @param {number} colorId - Color ID (0-255)
 * @returns {string} ANSI color code
 */
export function id(colorId) {
    return `38;5;${colorId}`;
}

/**
 * Colorizes text using a hash of the content.
 * @param {TemplateStringsArray} strings - Template literal strings
 * @param {...any} vars - Template literal variables
 * @returns {string} Colorized text with ANSI escape codes
 */
export function colorize(strings, ...vars) {
    let tmp = "";
    strings.forEach((string, i) => {
        tmp += `${string}${vars[i] ?? ''}`;
    });
    return `\x1b[${hash(tmp)}m${tmp}\x1b[0m`;
}