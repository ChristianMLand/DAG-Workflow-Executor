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
            if (from instanceof Array) {
                from.forEach(state => this.#states.add(state));
            } else {
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
    unregister(id) { this.#idMap.delete(id); }
    get(id) { return this.#idMap.get(id); }
    has(id) { return this.#idMap.has(id); }
    register(id) {
        const fsm = new StateMachine(this.#stateDef, id);
        this.#idMap.set(id, fsm);
        fsm.on("*", (event, ctx) => this.#signaller.emit(event, ctx));
        return fsm;
    }

    on(event, cb) {
        if (event === "*") {
            this.#signaller.on(event, cb);
        } else if (this.#transitions.has(event)) {
            this.onBefore(event, cb);
        } else if (this.#states.has(event)) {
            this.onEnter(event, cb);
        } else {
            throw new Error("Invalid event!");
        }
    }

    onBefore(transition, cb) {
        if (!this.#transitions.has(transition))
            throw new Error("Invalid transition!");
        this.#signaller.on(`${transition}.before`, cb);
    }

    onAfter(transition, cb) {
        if (!this.#transitions.has(transition))
            throw new Error("Invalid transition!");
        this.#signaller.on(`${transition}.after`, cb);
    }

    onEnter(state, cb) {
        if (!this.#states.has(state))
            throw new Error("Invalid state!");
        this.#signaller.on(`${state}.enter`, cb);
    }

    onLeave(state, cb) {
        if (!this.#states.has(state))
            throw new Error("Invalid state!");
        this.#signaller.on(`${state}.leave`, cb);
    }

    clear(event) {
        if (this.#transitions.has(event)) {
            this.#signaller.clear(`${event}.before`);
            this.#signaller.clear(`${event}.after`);
        }
        if (this.#states.has(event)) {
            this.#signaller.clear(`${event}.enter`);
            this.#signaller.clear(`${event}.leave`);
        }
    }
}