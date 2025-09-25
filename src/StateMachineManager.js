import { Signaller, StateMachine } from "./index.js";

export class StateMachineManager {
    #stateDef;
    #signaller;
    #idMap = new Map();
    #transitions = new Set();
    #states = new Set();
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
    get allStates() { return Array.from(this.#states) }
    get allTransitions() { return Array.from(this.#transitions) }
    unregister(id) { 
        // TODO should I manually clean up all listeners first??
        this.#idMap.delete(id);
    }
    get(id) { return this.#idMap.get(id); }
    has(id) { return this.#idMap.has(id); }
    register(id, instance) {
        const fsm = new StateMachine(this.#stateDef, id, instance);
        this.#idMap.set(id, fsm);
        fsm.on("*", (event, ctx) => this.#signaller.emit(event, ctx));
        return fsm;
    }

    stream(event) {
        return this.#signaller.stream(event);
    }
    
    on(event, cb, signal) {
        this.#signaller.on(event, cb, signal);
    }
    
    off(event, cb) {
        this.#signaller.off(event, cb);
    }

    onBefore(transition, cb, signal) {
        const transitions = Array.isArray(transition) ? transition : [transition];
        if (!transitions.every(t => this.#transitions.has(t)))
            throw new Error("Invalid transition!");
        this.on(transitions.map(t => `${t}.before`), cb, signal);
    }

    onAfter(transition, cb, signal) {
        const transitions = Array.isArray(transition) ? transition : [transition];
        if (!transitions.every(t => this.#transitions.has(t)))
            throw new Error("Invalid transition!");
        this.on(transitions.map(t => `${t}.after`), cb, signal);
    }

    onEnter(state, cb, signal) {
        const states = Array.isArray(state) ? state : [state];
        if (!states.every(s => this.#states.has(s)))
            throw new Error("Invalid state!");
        this.on(states.map(s => `${s}.enter`), cb, signal);
    }

    onLeave(state, cb, signal) {
        const states = Array.isArray(state) ? state : [state];
        if (!states.every(s => this.#states.has(s)))
            throw new Error("Invalid state!");
        this.on(states.map(s => `${s}.leave`), cb, signal);
    }

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