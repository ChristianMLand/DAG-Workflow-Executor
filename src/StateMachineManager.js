import { Signaller } from "./Signaller.js";
import { StateMachine } from "./StateMachine.js";

/**
 * Manages multiple state machine instances with a shared state definition.
 * Provides centralized event handling and instance management.
 */
export class StateMachineManager {
    /** @type {Object} */
    #stateDef;
    /** @type {Signaller} */
    #signaller;
    /** @type {Map<string, StateMachine>} */
    #idMap = new Map();
    /** @type {Set<string>} */
    #transitions = new Set();
    /** @type {Set<string>} */
    #states = new Set();
    
    /**
     * Creates a new state machine manager.
     * @param {Object} stateDef - State machine definition
     * @param {string} stateDef.initial - Initial state name
     * @param {Object<string, {from: string|string[], to: string}>} stateDef.transitions - Transition definitions
     */
    constructor(stateDef) {
        this.#stateDef = stateDef;
        for (const transition in stateDef.transitions) {
            this.#transitions.add(transition);
            const { from, to } = stateDef.transitions[transition];
            if (Array.isArray(from)) {
                from.forEach(state => this.#states.add(state));
            } else if (from !== "*") {
                this.#states.add(from);
            }
            this.#states.add(to);
        }
        this.#signaller = new Signaller(
            ...Array.from(this.#transitions, e => `${e}.before`),
            ...Array.from(this.#transitions, e => `${e}.after`),
            ...Array.from(this.#states, e => `${e}.enter`),
            ...Array.from(this.#states, e => `${e}.leave`)
        );
    }
    
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
     * Unregisters a state machine instance.
     * @param {string} id - The state machine ID to unregister
     */
    unregister(id) { 
        this.get(id)?.clear("*");
        this.#idMap.delete(id);
    }
    
    /**
     * Gets a state machine instance by ID.
     * @param {string} id - The state machine ID
     * @returns {StateMachine|undefined} The state machine or undefined if not found
     */
    get(id) { return this.#idMap.get(id); }
    
    /**
     * Checks if a state machine instance exists.
     * @param {string} id - The state machine ID
     * @returns {boolean} True if the instance exists, false otherwise
     */
    has(id) { return this.#idMap.has(id); }
    
    /**
     * Registers a new state machine instance.
     * @param {string} id - Unique identifier for the state machine
     * @param {any} instance - Instance object to pass to transition handlers
     * @returns {StateMachine} The created state machine instance
     */
    register(id, instance) {
        const fsm = new StateMachine(this.#stateDef, id, instance);
        this.#idMap.set(id, fsm);
        fsm.on("*", (event, ctx) => this.#signaller.emit(event, ctx));
        return fsm;
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
     * Registers an event listener for all managed state machines.
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