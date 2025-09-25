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

export const effects = {
    gray: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    magenta: 35,
    cyan: 36,
    white: 37,
    default: 39,
    underline: 4,
    bold: 1,
    italic: 3,
    strike: 9
}

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

export function bg(color) {
    if (color.startsWith("3")) {
        return color.replace("3", "4");
    } else if (Object.hasOwn(effects, color)) {
        return effects[color] + 10;
    }
}

export function rgb(r,g,b) {
    return `38;2;${r};${g};${b}`;
}

export function hex(code) {
    return rgb(...hexToRgb(code));
}

export function id(colorId) {
    return `38;5;${colorId}`;
}