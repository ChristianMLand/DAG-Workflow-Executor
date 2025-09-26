import fs from "fs";
import path from "path";
import readline from 'readline';
import { effect, id } from "./Colorizer.js";
import { Time } from './Time.js';
import { deepFreeze } from './Util.js';

/**
 * Log levels for the logger system.
 * @readonly
 */
export const LogLevel = deepFreeze({
    /** @type {0} */
    DEBUG: 0,
    /** @type {1} */
    INFO: 1,
    /** @type {2} */
    WARN: 2,
    /** @type {3} */
    ERROR: 3,
    /**
     * Converts a log level number to its string representation.
     * @param {number} l - The log level number
     * @returns {string} The log level string
     */
    asString(l) {
        switch (l) {
            case LogLevel.DEBUG:
                return "DEBUG";
            case LogLevel.INFO:
                return "INFO";
            case LogLevel.WARN:
                return "WARN";
            default:
                return "ERROR";
        }
    }
});

/** @type {Object} */
const styles = {
    [LogLevel.DEBUG]: effect(id(69), "bold"),
    [LogLevel.INFO]: effect(id(78), "bold"),
    [LogLevel.WARN]: effect(id(222), "bold"),
    [LogLevel.ERROR]: effect(id(203), "bold"),
    ts: effect("gray", "italic"),
    msg: effect("white"),
    ctx: effect(id(147))
};

/**
 * A logger implementation with colored output, file logging, and progress bars.
 * Supports different log levels and customizable themes.
 */
export class Logger {
    /** @type {Object[]} */
    #progressBars;
    /** @type {number} */
    #level;
    /** @type {fs.WriteStream|undefined} */
    #fileStream;
    /** @type {string} */
    #prefix;
    /** @type {Object} */
    #theme;

    /**
     * Creates a new logger instance.
     * @param {Object} [config={}] - Logger configuration
     * @param {string} [config.level="INFO"] - Log level (DEBUG, INFO, WARN, ERROR)
     * @param {string} [config.file] - File path for logging
     * @param {string} [config.prefix] - Prefix for log messages
     * @param {Object[]} [config.progressBars] - Shared progress bars array
     * @param {Object} [config.theme] - Custom theme overrides
     */
    constructor({ level, file, prefix, progressBars, theme } = {}) {
        this.#theme = { ...styles, ...(theme ?? {}) };
        this.#progressBars = progressBars ?? [];
        this.#level = LogLevel[level?.toUpperCase()] ?? LogLevel.INFO;
        this.#prefix = prefix ? `[${prefix}] ` : "";

        if (file) {
            const dir = path.dirname(file);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            this.#fileStream = fs.createWriteStream(file, { flags: "a" });
        }
    }

    /**
     * Creates a scoped logger with an additional prefix.
     * @param {string} name - The scope name to add to the prefix
     * @returns {Logger} A new logger instance with the scoped prefix
     */
    scope(name) {
        return new Logger({
            level: LogLevel.asString(this.#level),
            file: this.#fileStream?.path,
            prefix: `${this.#prefix}${name}`,
            progressBars: this.#progressBars,
            theme: this.#theme
        });
    }

    /**
     * Logs an info message.
     * @param {any} msg - Message
     * @param {...any} ctx - Context arguments
     */
    info(msg, ...ctx) { this.log(LogLevel.INFO, msg, ...ctx) }
    
    /**
     * Logs a warning message.
     * @param {any} msg - Message
     * @param {...any} ctx - Context arguments
     */
    warn(msg, ...ctx) { this.log(LogLevel.WARN, msg, ...ctx) }
    
    /**
     * Logs a debug message.
     * @param {any} msg - Message
     * @param {...any} ctx - Context arguments
     */
    debug(msg, ...ctx) { this.log(LogLevel.DEBUG, msg, ...ctx) }
    
    /**
     * Logs an error message.
     * @param {any} msg - Message
     * @param {...any} ctx - Context arguments
     */
    error(msg, ...ctx) { this.log(LogLevel.ERROR, msg, ...ctx) }
    
    /**
     * Closes the file stream if it exists.
     */
    close() { !!this.#fileStream && this.#fileStream.end(); }

    /**
     * Logs a message with the specified level.
     * @param {number} level - The log level
     * @param {any} msg - The message to log
     * @param {...any} ctx - Additional context objects
     */
    log(level, msg, ...ctx) {
        if (level < this.#level) return;
        this.#clearProgress();

        const line =
            this.#theme.ts`${Time.stamp} ` +
            this.#theme[level]`[${LogLevel.asString(level)}]` +
            (this.#prefix ? " " + this.#theme.ctx`${this.#prefix}` : "");
        console.log(line, msg, ...ctx.map(c => this.#theme.ctx`${JSON.stringify(c, null, 2)}`));
        this.#renderProgress();

        if (this.#fileStream) {
            const raw = `[${Time.stamp}] [${LogLevel.asString(level)}] ${this.#prefix}${msg}`;
            this.#fileStream.write(raw + (ctx?.length ? " " + JSON.stringify(ctx) : "") + "\n");
        }
    }

    /**
     * Creates a timer function that logs elapsed time when called.
     * @param {string} label - Label for the timer
     * @returns {function(): void} Function to call when timing is complete
     */
    timer(label) {
        const start = Date.now();
        return () => {
            const ms = Date.now() - start;
            this.info(`${label}: finished in ${this.#theme.ctx`${ms}ms`}`);
        };
    }

    /**
     * Creates a counter function that logs incrementing values.
     * @param {string} label - Label for the counter
     * @returns {function(): void} Function to call to increment and log
     */
    counter(label) {
        let count = 0;
        return () => {
            this.info(`${label}: ${++count}`);
        };
    }

    /**
     * Creates a progress bar for tracking completion.
     * @param {number} total - Total number of items to process
     * @param {Object} [options={}] - Progress bar options
     * @param {string} [options.label="Progress"] - Label for the progress bar
     * @param {number} [options.width=30] - Width of the progress bar
     * @returns {function(): void} Function to call to update progress
     */
    progress(total, { label = "Progress", width = 30 } = {}) {
        let current = 0;
        const bar = { label, total, width, current: 0 };
        this.#progressBars.push(bar);
        const update = () => {
            bar.current = Math.min(++current, total);
            this.#clearProgress();
            this.#renderProgress();
        };
        return update;
    }

    /**
     * Clears progress bars from the console.
     * @private
     */
    #clearProgress() {
        if (!this.#progressBars.length) return;
        readline.moveCursor(process.stdout, 0, -this.#progressBars.length);
        readline.clearScreenDown(process.stdout);
    }

    /**
     * Renders progress bars to the console.
     * @private
     */
    #renderProgress() {
        for (const bar of this.#progressBars) {
            const percent = Math.floor((bar.current / bar.total) * 100);
            const filled = Math.floor((percent / 100) * bar.width);
            const empty = bar.width - filled;
            const line =
                this.#theme[LogLevel.INFO]`[${bar.label}] ` +
                this.#theme.msg`[${"█".repeat(filled)}${"▒".repeat(empty)}] ` +
                this.#theme.ts`${percent}%`;
            console.log(line);
        }
    }
}