import { Signaller } from "./Signaller.js";
import { deepFreeze } from "./Util.js";

/**
 * A finite state machine implementation with event-driven state transitions.
 * Provides lifecycle events for state changes and transition management.
 */
export class StateMachine {
    /** @type {Signaller} */
    #signaller;
    /** @type {string} */
    #state;
    /** @type {Set<string>} */
    #transitions = new Set();
    /** @type {Set<string>} */
    #states = new Set();
    /** @type {Object<string, function>} @readonly*/
    #do;
    /** @type {string} */
    #id;
    /** @type {any} */
    #instance;
    
    /**
     * Creates a new state machine instance.
     * @param {Object} config - State machine configuration
     * @param {string} config.initial - Initial state name
     * @param {Object<string, {from: string|string[], to: string}>} config.transitions - Transition definitions
     * @param {string} [id] - Unique identifier for the state machine
     * @param {any} [instance] - Instance object to pass to transition handlers
     */
    constructor({ initial, transitions }, id, instance) {
        this.#id = id ?? crypto.randomUUID();
        this.#state = initial;
        this.#do = {};
        this.#instance = instance;
        for (const transition in transitions) {
            this.#transitions.add(transition);
            const { from, to } = transitions[transition];
            if (Array.isArray(from)) {
                from.forEach(state => this.#states.add(state));
            } else if (from !== "*") {
                this.#states.add(from);
            }
            this.#states.add(to);
            
            // TODO maybe get rid of the "do" object and just rely on the invoke method?
            this.#do[transition] = payload => {
                if (Array.isArray(from) && !from.includes(this.#state)) {
                    throw new Error(`Invalid state transition: ${this.state} -> ${to}`);
                } else if (typeof from === "string" && this.#state !== from && from !== "*") {
                    throw new Error(`Invalid state transition: ${this.state} -> ${to}`);
                }
                const ctx = { id: this.id, payload, from: this.state, to, transition };
                this.#signaller.emit(`${transition}.before`, ctx);
                this.#signaller.emit(`${this.state}.leave`, ctx);
                this.#state = to;
                this.#signaller.emit(`${to}.enter`, ctx);
                this.#signaller.emit(`${transition}.after`, ctx);
                return ctx;
            };
        }
        deepFreeze(this.#do);
        this.#signaller = new Signaller(
            ...[...this.#transitions].map(e => `${e}.before`),
            ...[...this.#transitions].map(e => `${e}.after`),
            ...[...this.#states].map(e => `${e}.enter`),
            ...[...this.#states].map(e => `${e}.leave`)
        );
    }

    /**
     * Gets the unique identifier of the state machine.
     * @returns {string} The state machine ID
     */
    get id() { return this.#id }
    
    /**
     * Gets the transition action handlers.
     * @returns {Object<string, function>} The transition handlers
     */
    get do() { return this.#do }
    
    /**
     * Gets the current state.
     * @returns {string} The current state name
     */
    get state() { return this.#state }
    
    /**
     * Gets all possible states.
     * @returns {string[]} Array of state names
     */
    get allStates() { return Array.from(this.#states) }
    
    /**
     * Gets all possible transitions.
     * @returns {string[]} Array of transition names
     */
    get allTransitions() { return Array.from(this.#transitions) }

    /**
     * Invokes a state transition.
     * @param {string} transition - The transition name to invoke
     * @returns {Object} Transition context object
     * @throws {Error} If the transition is invalid
     */
    invoke(transition) {
        if (!this.#transitions.has(transition))
            throw new Error("Invalid transition!");
        return this.do[transition](this.#instance);
    }

    /**
     * Creates a stream for state machine events.
     * @param {string|string[]} event - Event name(s) to stream
     * @returns {ReadableStream} Stream of events
     */
    stream(event) {
        return this.#signaller.stream(event);
    }

    /**
     * Registers an event listener.
     * @param {string|string[]} event - Event name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any event name is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    on(event, cb, signal) {
        return this.#signaller.on(event, cb, signal);
    }

    /**
     * Removes an event listener.
     * @param {string|string[]} event - Event name(s) to stop listening for
     * @param {function} cb - Callback function to remove
     */
    off(event, cb) {
        this.#signaller.off(event, cb);
    }

    /**
     * Registers a listener for transition before events.
     * @param {string|string[]} transition - Transition name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any transition is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onBefore(transition, cb, signal) {
        const transitions = Array.isArray(transition) ? transition : [transition];
        if (!transitions.every(t => this.#transitions.has(t)))
            throw new Error("Invalid transition!");
        return this.on(transitions.map(t => `${t}.before`), cb, signal);
    }

    /**
     * Registers a listener for transition after events.
     * @param {string|string[]} transition - Transition name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any transition is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onAfter(transition, cb, signal) {
        const transitions = Array.isArray(transition) ? transition : [transition];
        if (!transitions.every(t => this.#transitions.has(t)))
            throw new Error("Invalid transition!");
        return this.on(transitions.map(t => `${t}.after`), cb, signal);
    }

    /**
     * Registers a listener for state entry events.
     * @param {string|string[]} state - State name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any state is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onEnter(state, cb, signal) {
        const states = Array.isArray(state) ? state : [state];
        if (!states.every(s => this.#states.has(s)))
            throw new Error("Invalid state!");
        return this.on(states.map(s => `${s}.enter`), cb, signal);
    }

    /**
     * Registers a listener for state exit events.
     * @param {string|string[]} state - State name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any state is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onLeave(state, cb, signal) {
        const states = Array.isArray(state) ? state : [state];
        if (!states.every(s => this.#states.has(s)))
            throw new Error("Invalid state!");
        return this.on(states.map(s => `${s}.leave`), cb, signal);
    }

    /**
     * Clears event listeners for specified events.
     * @param {string|string[]} event - Event name(s) to clear
     */
    clear(event) {
        const events = Array.isArray(event) ? event : [event];
        if (events.includes("*"))
            this.#signaller.clear("*");
        events.forEach(e => {
            if (this.#transitions.has(e)) {
                this.#signaller.clear(`${e}.before`);
                this.#signaller.clear(`${e}.after`);
            } else if (this.#states.has(e)) {
                this.#signaller.clear(`${e}.enter`);
                this.#signaller.clear(`${e}.leave`);
            }
        })
    }
}