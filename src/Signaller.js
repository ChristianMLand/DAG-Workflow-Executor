import { Time } from './Time.js';



export class Signaller {
    #events;
    #handlers = {};
    #wc = new Set();
    constructor(...events) {
        this.#events = new Set(events);
        this.#events.forEach(event => this.#handlers[event] = new Set());
    }

    get eventNames() { return Array.from(this.#events) }

    stream(event) {
        const events = Array.isArray(event) ? event : [event];
        const self = this;
        return new ReadableStream({
            start(controller) {
                const offs = events.map(e => self.on(e, data => controller.enqueue(data)));
                controller.off = () => offs.forEach(off => off());
            },
            cancel(controller) {
                controller?.off();
            }
        });
    }

    on(event, cb, signal) {
        const events = Array.isArray(event) ? event : [event];
        if (events.includes("*"))
            this.#wc.add(cb);
        else if (events.every(e => this.#events.has(e)))
            events.forEach(e => this.#handlers[e].add(cb));
        else throw new Error("Invalid Event!");
        const cleanup = () => this.off(events, cb);
        signal?.addEventListener("abort", cleanup);
        return cleanup;
    }

    once(event, cb) {
        const events = Array.isArray(event) ? event : [event];
        const wrapped = (...args) => {
            this.off(events, wrapped);
            return cb(...args);
        }
        this.on(events, wrapped);
    }

    off(event, cb) {
        const events = Array.isArray(event) ? event : [event];
        if (events.includes("*"))
            this.#wc.delete(cb);
        else if (events.every(e => this.#events.has(e)))
            events.forEach(e => this.#handlers[e].delete(cb));
    }

    clear(event) {
        const events = Array.isArray(event) ? event : [event];
        this.#wc.clear();
        if (events.includes("*"))
            this.#events.forEach(e => this.#handlers[e].clear());
        else if (events.every(e => this.#events.has(e)))
            events.forEach(e => this.#handlers[e].clear());
    }

    emit(event, data) {
        if (this.#wc.size)
            this.#wc.forEach(cb => cb(event, data));
        if (this.#events.has(event))
            this.#handlers[event].forEach(handler => handler(data));
    }
}