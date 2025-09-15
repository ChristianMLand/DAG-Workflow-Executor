import { DAG, Semaphore, StateMachine, Task } from "./index.js";

export class Workflow {
    #dag;
    #fsm;
    #processed;
    #pause;
    #semaphore;

    constructor(config = {}) {
        this.#semaphore = new Semaphore(config.maxConcurrent ?? 1);
        this.#dag = new DAG();
        this.#processed = new Map();
        this.#pause = null;
        this.#fsm = new StateMachine({
            initial: "idle",
            transitions: {
                "begin": { from: "idle", to: "executing" },
                "pause": { from: "executing", to: "paused" },
                "resume": { from: "paused", to: "executing" },
                "end": { from: ["executing", "paused"], to: "done" },
                "abort": { from: ["executing", "paused"], to: "aborted" }
            }
        });

        this.#fsm.onEnter("paused", () => this.#pause = Promise.withResolvers());
        this.#fsm.onLeave("paused", () => this.#pause = this.#pause.resolve());
        this.#fsm.onEnter("aborted", () => {
            this.getOrdered().filter(t => t.state === "pending").forEach(t => t.cancel());
        });
    }

    get state() { return this.#fsm.state }
    get isPaused() { return this.state === "paused"; }
    get size() { return this.#dag.size }

    clear(event) { this.#fsm.clear(event); }
    pause() {
        if (this.isPaused) return;
        this.#fsm.do.pause(this);
    }
    resume() {
        if (!this.isPaused) return;
        this.#fsm.do.resume(this);
    }
    abort() { this.#fsm.do.abort(this); }
    getTask(id) { return this.#dag.getVertex(id)?.payload; }
    flush() { this.getOrdered().forEach(task => this.remove(task.id)); }
    // TODO maybe cache if DAG hasnt changed?
    getOrdered() { return [...this.#dag.topoSort((a, b) => b.payload.priority - a.payload.priority)]; }
    on(event, cb) {
        if (this.#fsm.allStates.includes(event) || this.#fsm.allTransitions.includes(event))
            this.#fsm.on(event, cb);
        else if (Task.manager.allStates.includes(event) || Task.manager.allTransitions.includes(event))
            Task.manager.on(event, cb);
    }

    async checkPause() {
        const pause = this.#pause;
        if (!pause) return;
        await pause.promise;
    }

    add(work, config) {
        const task = new Task(this, work, config);
        this.#dag.addVertex(task.id, task, task.reliesOn);
        return task;
    }

    remove(id) {
        const toRemove = this.#dag.removeVertex(id).payload;
        toRemove.remove();
        this.#processed.delete(id);
        return toRemove;
    }

    async process() {
        this.#fsm.do.begin(this);
        while (true) {
            if (this.state === "aborted") break;
            await this.checkPause();
            for (const task of this.getOrdered()) {
                if (!this.#processed.has(task.id))
                    this.run(task.id);
            }
            await Promise.allSettled(Array.from(this.#processed.values()));
            const ordered = this.getOrdered();
            const allTaskIds = new Set(ordered.map(t => t.id));
            if (allTaskIds.isSubsetOf(this.#processed)) {
                this.#fsm.do.end(this);
                return ordered;
            }
        }
        return null;
    }

    run(id) {
        if (this.#processed.has(id))
            return this.#processed.get(id);
        const task = this.getTask(id);
        if (!task)
            throw new Error(`Unknown task id: ${id}`);
        const p = this.#semaphore.withLock(() => task.execute());
        this.#processed.set(id, p);
        return p;
    }

    *[Symbol.iterator]() {
        this.#fsm.do.begin(this);
        const ordered = this.getOrdered();
        for (const task of ordered) {
            yield this.run(task.id);
        }
        Promise.allSettled(this.#processed.values())
            .then(() => this.#fsm.do.end(this));
    }

    [Symbol.for("nodejs.util.inspect.custom")]() { return this.toString() }

    toJSON() {
        return {
            state: this.state,
            size: this.size,
            tasks: this.getOrdered()
        }
    }

    toString() {
        return `<Workflow: state='${this.state}', tasks=[${this.getOrdered().map(t => t.id)}]>`;
    }
}