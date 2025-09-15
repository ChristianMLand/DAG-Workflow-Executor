export class Signaller {
    #events;
    #handlers = {};
    #wc = null;
    constructor(...events) {
        this.#events = new Set(events);
        this.#events.forEach(event => this.#handlers[event] = new Set());
    }

    get eventNames() { return Array.from(this.#events) }

    stream(event) {
        let vals = [];
        let prom = Promise.withResolvers();
        const off = this.on(event, data => prom.resolve(vals.push(data)));
        return async function* () {
            try {
                while (true) {
                    vals.length ? 
                        yield vals.shift() : 
                        await (prom = Promise.withResolvers()).promise;
                }
            } finally { off() }
        }();
    }

    on(event, cb, signal) {
        if (event === "*")
            this.#wc = cb;
        else if (this.#events.has(event))
            this.#handlers[event].add(cb);
        signal?.addEventListener("abort", () => this.off(event, cb));
        return () => this.off(event, cb);
    }

    once(event, cb) {
        const wrapped = (...args) => {
            this.off(event, wrapped);
            return cb(...args);
        }
        this.on(event, wrapped);
    }

    off(event, cb) {
        if (event === "*")
            this.#wc = null;
        else if (this.#events.has(event))
            this.#handlers[event].delete(cb);
    }

    clear(event) {
        this.#wc = null;
        if (this.#events.has(event))
            this.#handlers[event].clear();
    }

    emit(event, data) {
        if (this.#wc)
            this.#wc(event, data);
        if (this.#events.has(event))
            this.#handlers[event].forEach(handler => handler(data));
    }
}