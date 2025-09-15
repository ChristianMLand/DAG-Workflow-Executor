import fs from "fs";
import path from "path";
import readline from 'readline';
import { effect, id } from "./Colorizer.js";
import { Time } from './Time.js';

export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
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
};

const styles = {
    ts: effect("gray", "italic"),
    [LogLevel.DEBUG]: effect(id(69), "bold"),
    [LogLevel.INFO]: effect(id(78), "bold"),
    [LogLevel.WARN]: effect(id(222), "bold"),
    [LogLevel.ERROR]: effect(id(203), "bold"),
    msg: effect("white"),
    ctx: effect(id(147))
};

export class Logger {
    #progressBars;
    #level;
    #fileStream;
    #prefix;

    constructor({ level, file, prefix, progressBars } = {}) {
        this.#progressBars = progressBars ?? [];
        this.#level = LogLevel[level?.toUpperCase()] ?? LogLevel.INFO;
        this.#prefix = prefix ? `[${prefix}] ` : "";

        if (file) {
            const dir = path.dirname(file);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            this.#fileStream = fs.createWriteStream(file, { flags: "a" });
        }
    }

    scope(name) {
        return new Logger({
            level: LogLevel.asString(this.#level),
            file: this.#fileStream?.path,
            prefix: `${this.#prefix}${name}`,
            progressBars: this.#progressBars
        });
    }

    info(...args) { this.log(LogLevel.INFO, ...args) }
    warn(...args) { this.log(LogLevel.WARN, ...args) }
    debug(...args) { this.log(LogLevel.DEBUG, ...args) }
    error(...args) { this.log(LogLevel.ERROR, ...args) }
    close() { !!this.#fileStream && this.#fileStream.end(); }

    log(level, msg, ctx) {
        if (level < this.#level) return;
        this.#clearProgress();

        const line =
            styles.ts`${Time.stamp} ` +
            styles[level]`[${LogLevel.asString(level)}]` +
            (this.#prefix ? " " + styles.ctx`${this.#prefix}` : "");
        console.log(line, msg, ctx ? styles.ctx`${JSON.stringify(ctx, null, 2)}` : "");
        this.#renderProgress();

        if (this.#fileStream) {
            const raw = `[${Time.stamp}] [${LogLevel.asString(level)}] ${this.#prefix}${msg}`;
            this.#fileStream.write(raw + (ctx ? " " + JSON.stringify(ctx) : "") + "\n");
        }
    }

    timer(label) {
        const start = Date.now();
        return () => {
            const ms = Date.now() - start;
            this.info(`${label}: finished in ${styles.ctx`${ms}ms`}`);
        };
    }

    counter(label) {
        let count = 0;
        return () => {
            this.info(`${label}: ${++count}`);
        };
    }

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

    #clearProgress() {
        if (!this.#progressBars.length) return;
        readline.moveCursor(process.stdout, 0, -this.#progressBars.length);
        readline.clearScreenDown(process.stdout);
    }

    #renderProgress() {
        for (const bar of this.#progressBars) {
            const percent = Math.floor((bar.current / bar.total) * 100);
            const filled = Math.floor((percent / 100) * bar.width);
            const empty = bar.width - filled;
            const line =
                styles[LogLevel.INFO]`[${bar.label}] ` +
                styles.msg`[${"█".repeat(filled)}${"▒".repeat(empty)}] ` +
                styles.ts`${percent}%`;
            console.log(line);
        }
    }
}