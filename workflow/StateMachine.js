import { Signaller, deepFreeze } from "./index.js";

export class StateMachine {
    #signaller;
    #state;
    #transitions = new Set();
    #states = new Set();
    #do;
    #id;
    #instance;
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

    get id() { return this.#id }
    get do() { return this.#do }
    get state() { return this.#state }
    get allStates() { return Array.from(this.#states) }
    get allTransitions() { return Array.from(this.#transitions) }

    invoke(transition) {
        if (!this.#transitions.has(transition))
            throw new Error("Invalid transition!");
        return this.do[transition](this.#instance);
    }

    stream(event) {
        return this.#signaller.stream(event);
    }

    on(event, cb) {
        this.#signaller.on(event, cb);
    }

    off(event, cb) {
        this.#signaller.off(event, cb);
    }

    onBefore(transition, cb) {
        const transitions = Array.isArray(transition) ? transition : [transition];
        if (!transitions.every(t => this.#transitions.has(t)))
            throw new Error("Invalid transition!");
        this.on(transitions.map(t => `${t}.before`), cb);
    }

    onAfter(transition, cb) {
        const transitions = Array.isArray(transition) ? transition : [transition];
        if (!transitions.every(t => this.#transitions.has(t)))
            throw new Error("Invalid transition!");
        this.on(transitions.map(t => `${t}.after`), cb);
    }

    onEnter(state, cb) {
        const states = Array.isArray(state) ? state : [state];
        if (!states.every(s => this.#states.has(s)))
            throw new Error("Invalid state!");
        this.on(states.map(s => `${s}.enter`), cb);
    }

    onLeave(state, cb) {
        const states = Array.isArray(state) ? state : [state];
        if (!states.every(s => this.#states.has(s)))
            throw new Error("Invalid state!");
        this.on(states.map(s => `${s}.leave`), cb);
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