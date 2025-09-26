/**
 * An event emitter implementation with support for wildcard events and streams.
 * Provides event registration, emission, and streaming capabilities.
 */
export class Signaller {
    /** @type {Set<string>} */
    #events;
    /** @type {Object<string, Set<function>>} */
    #handlers = {};
    /** @type {Set<function>} */
    #wc = new Set();
    
    /**
     * Creates a new signaller instance.
     * @param {...string} events - Event names to register
     */
    constructor(...events) {
        this.#events = new Set(events);
        this.#events.forEach(event => this.#handlers[event] = new Set());
    }

    /**
     * Gets the list of registered event names.
     * @returns {string[]} Array of event names
     */
    get eventNames() { return Array.from(this.#events) }

    /**
     * Creates a readable stream for the specified events.
     * @param {string|string[]} event - Event name(s) to stream
     * @returns {ReadableStream} Stream that emits event data
     */
    stream(event) {
        const events = Array.isArray(event) ? event : [event];
        const self = this;
        return new ReadableStream({
            start(controller) {
                controller.off = self.on(events, data => controller.enqueue(data));
            },
            cancel(controller) {
                controller?.off();
            }
        });
    }

    /**
     * Registers an event listener.
     * @param {string|string[]} event - Event name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @returns {function} Cleanup function to remove the listener(s)
     * @throws {Error} If any event is invalid
     */
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

    /**
     * Registers a one-time event listener.
     * @param {string|string[]} event - Event name(s) to listen for
     * @param {function} cb - Callback function
     */
    once(event, cb) {
        const events = Array.isArray(event) ? event : [event];
        const wrapped = (...args) => {
            this.off(events, wrapped);
            return cb(...args);
        }
        this.on(events, wrapped);
    }

    /**
     * Removes an event listener.
     * @param {string|string[]} event - Event name(s) to stop listening for
     * @param {function} cb - Callback function to remove
     */
    off(event, cb) {
        const events = Array.isArray(event) ? event : [event];
        if (events.includes("*"))
            this.#wc.delete(cb);
        events.forEach(e => {
            if (this.#events.has(e))
                this.#handlers[e].delete(cb)
        });
    }

    /**
     * Clears all listeners for specified events.
     * @param {string|string[]} event - Event name(s) to clear
     */
    clear(event) {
        const events = Array.isArray(event) ? event : [event];
        this.#wc.clear();
        if (events.includes("*"))
            this.#events.forEach(e => this.#handlers[e].clear());
        else if (events.every(e => this.#events.has(e)))
            events.forEach(e => this.#handlers[e].clear());
    }

    /**
     * Emits an event to all registered listeners.
     * @param {string} event - Event name to emit
     * @param {any} data - Data to pass to listeners
     */
    emit(event, data) {
        if (this.#wc.size)
            this.#wc.forEach(cb => cb(event, data));
        if (this.#events.has(event))
            this.#handlers[event].forEach(handler => handler(data));
    }
}