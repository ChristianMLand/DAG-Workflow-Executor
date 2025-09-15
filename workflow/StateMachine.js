import { Signaller } from "./index.js";

export class StateMachine {
    #signaller;
    #state;
    #transitions = new Set();
    #states = new Set();
    #do;
    #id;
    constructor({ initial, transitions }, id) {
        this.#id = id ?? crypto.randomUUID();
        this.#state = initial;
        this.#do = {};
        for (const transition in transitions) {
            this.#transitions.add(transition);
            const { from, to } = transitions[transition];
            if (from instanceof Array) {
                from.forEach(state => this.#states.add(state));
            } else if (from !== "*") {
                this.#states.add(from);
            }
            this.#states.add(to);
            this.#do[transition] = payload => {
                if (from instanceof Array && !from.includes(this.#state)) {
                    throw new Error(`Invalid state transition: ${this.state} -> ${to}`);
                } else if (from instanceof String && this.#state !== from && from !== "*") {
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
        Object.freeze(this.#do);
        this.#signaller = new Signaller(
            ...[...this.#transitions].map(e => `${e}.before`),
            ...[...this.#transitions].map(e => `${e}.after`),
            ...[...this.#states].map(e => `${e}.enter`),
            ...[...this.#states].map(e => `${e}.leave`)
        );
    }

    get id() { return this.#id }
    get do() { return this.#do }
    get state() { return this.#state }
    get allStates() { return Array.from(this.#states) }
    get allTransitions() { return Array.from(this.#transitions) }

    invoke(transition, data) {
        return this.do[transition](data);
    }

    on(event, cb) {
        if (event === "*") {
            this.#signaller.on(event, cb);
        } else if (this.#transitions.has(event)) {
            this.onAfter(event, cb);
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