import { DAG, Semaphore, StateMachine, StateMachineManager, Task, deepFreeze } from "./index.js";

export class Workflow {
    #dag;
    #fsm;
    #processed;
    #pause;
    #semaphore;
    #id;

    static stateDef = deepFreeze({
        initial: "idle",
        transitions: {
            "begin": { from: "idle", to: "executing" },
            "pause": { from: "executing", to: "paused" },
            "resume": { from: "paused", to: "executing" },
            "end": { from: ["executing", "paused"], to: "done" },
            "abort": { from: ["executing", "paused"], to: "aborted" }
        }
    });
    
    constructor(config = { maxConcurrent: 1, id: crypto.randomUUID() }) {
        this.#semaphore = new Semaphore(config.maxConcurrent ?? 1);
        this.#dag = new DAG();
        this.#processed = new Map();
        this.#pause = null;
        this.#id = config.id ?? crypto.randomUUID();
        this.#fsm = new StateMachine(Workflow.stateDef, this.#id, this);
        this.taskManager = new StateMachineManager(Task.stateDef);

        this.onEnter("paused", () => this.#pause = Promise.withResolvers());
        this.onLeave("paused", () => this.#pause = this.#pause.resolve());
        this.onEnter("aborted", () => {
            this.getOrdered().filter(t => t.state === "pending").forEach(t => t.cancel());
        });
    }

    get state() { return this.#fsm.state }
    get isPaused() { return this.state === "paused"; }
    get size() { return this.#dag.size }
    get active() { return this.#semaphore.active }

    on(event, cb, signal) { this.#fsm.on(event, cb, signal) }
    onEnter(state, cb, signal) { this.#fsm.onEnter(state, cb, signal) }
    onLeave(state, cb, signal) { this.#fsm.onLeave(state, cb, signal) }
    onBefore(transition, cb, signal) { this.#fsm.onBefore(transition, cb, signal) }
    onAfter(transition, cb, signal) { this.#fsm.onAfter(transition, cb, signal) }
    clear(event) { this.#fsm.clear(event); }
    pause() {
        if (this.isPaused) return;
        this.#fsm.invoke("pause");
    }
    resume() {
        if (!this.isPaused) return;
        this.#fsm.invoke("resume");
    }
    abort() { this.#fsm.invoke("abort") }
    getTask(id) { return this.#dag.getVertex(id)?.payload; }
    getOrdered() { return this.#dag.topoSort((a, b) => b.payload.priority - a.payload.priority) }
    // TODO prob shouldn't allow while executing?
    flush() { this.getOrdered().forEach(task => this.remove(task.id)); }

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

    // TODO probably shouldn't allow removal while executing?
    // should it throw an error?
    // or, DO allow removal, but simply flag the task as removed,
    // and only actually remove it once the workflow has finished?
    remove(id) {
        const toRemove = this.#dag.removeVertex(id).payload;
        toRemove.remove();
        this.#processed.delete(id);
        return toRemove;
    }

    async #process() {
        this.#fsm.invoke("begin");
        while (true) {
            if (this.state === "aborted") break;
            await this.checkPause();
            for (const task of this.getOrdered()) {
                if (!this.#processed.has(task.id))
                    this.#run(task.id);
            }
            await Promise.allSettled(this.#processed.values());
            if (this.state === "aborted") break;
            this.#fsm.invoke("end");
            return this.getOrdered();
        }
        return null;
    }

    async #run(id) {
        if (this.#processed.has(id))
            return this.#processed.get(id);
        const task = this.getTask(id);
        if (!task)
            throw new Error(`Unknown task id: ${id}`);
        const p = this.#semaphore.withLock(async () => {
            const settled = await Promise.allSettled(task.reliesOn.map(did => this.#run(did)));
            if (settled.some(s => s.status === 'rejected'))
                task.cancel();
            return task.execute(settled.map(s => s.value))
        }).catch(err => err);
        this.#processed.set(id, p);
        return p;
    }

    async *stream(filters = { states: ["succeeded"], onlyTerminal: true, where: task => !!task }) {
        filters = {
            states: ["succeeded"],
            onlyTerminal: true,
            where: t => t,
            ...filters
        }
        for await (const task of this) {
            if ((filters.states.includes("*") || filters.states.includes(task.state)) && this.#dag.isTerminal(task.id) && filters.where(task))
                yield task;
        }
    }

    async *try(filters = { onlyTerminal: true, where: task => !!task }) {
        filters = {
            onlyTerminal: true,
            where: t => t,
            ...filters
        }
        for await (const task of this) {
            if (task.state === "failed") {
                this.abort();
                throw task.error;
            }
            if ((!filters.onlyTerminal || filters.onlyTerminal && this.#dag.isTerminal(task.id)) && filters.where(task))
                yield task.result;
        }
    }

    async *[Symbol.asyncIterator]() {
        const ordered = this.getOrdered();
        const stream = this.taskManager.stream(["succeeded.enter", "cancelled.enter", "failed.enter"]);
        if (this.state === "idle")
            this.#process();
        let count = 0;
        for await (const ctx of stream.values({ preventCancel: true })) {
            if (ctx.to === "failed" && ctx.payload.attempts < ctx.payload.retryLimit) continue;
            yield ctx.payload;
            if (++count === ordered.length) break;
        }
        stream.cancel(); // should auto cancel, but just in case
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