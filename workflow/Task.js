import { Time, deepFreeze } from "./index.js";

export class Task {
    #workflow;
    #work;
    #id;
    #reliesOn;
    #priority;
    #retryLimit;
    #attempts;
    #result;
    #error;
    #timeout;
    #backoff;
    #fsm;

    static stateDef = deepFreeze({
        initial: "created",
        transitions: {
            add: { from: "created", to: "pending" },
            start: { from: "pending", to: "running" },
            cancel: { from: "pending", to: "cancelled" },
            succeed: { from: "running", to: "succeeded" },
            fail: { from: "running", to: "failed" },
            timeout: { from: "running", to: "failed" },
            retry: { from: "failed", to: "pending" },
            remove: { from: "*", to: "removed" },
        }
    });

    constructor(workflow, work, config = {}) {
        this.#workflow = workflow;
        this.#work = work;
        this.#id = config.id ?? crypto.randomUUID();
        this.#reliesOn = config.reliesOn ?? [];
        this.#priority = config.priority ?? 0;
        this.#retryLimit = config.retryLimit ?? 0;
        this.#timeout = config.timeout ?? null;
        this.#backoff = config.backoff ?? 200;
        this.#fsm = workflow.taskManager.register(this.#id, this);
        this.#fsm.invoke("add");
        this.onAfter("start", () => this.#error = undefined);
        this.onAfter("cancel", () => this.#error = new Error("Task was cancelled!"));
        this.onAfter("remove", () => workflow.taskManager.unregister(this.id));
    }

    get id() { return this.#id; }
    get reliesOn() { return Array.from(this.#reliesOn); }
    get priority() { return this.#priority; }
    get retryLimit() { return this.#retryLimit; }
    get attempts() { return this.#attempts; }
    get timeout() { return this.#timeout; }
    get backoff() { return this.#backoff; }
    get result() { return this.#result; }
    get error() { return this.#error; }
    get state() { return this.#fsm.state; }

    clear(event) { this.#fsm.clear(event); }
    cancel() { this.#fsm.invoke("cancel"); }
    remove() { this.#fsm.invoke("remove"); }
    on(event, cb) { this.#fsm.on(event, cb) }
    onEnter(state, cb) { this.#fsm.onEnter(state, cb) }
    onLeave(state, cb) { this.#fsm.onLeave(state, cb) }
    onBefore(transition, cb) { this.#fsm.onBefore(transition, cb) }
    onAfter(transition, cb) { this.#fsm.onAfter(transition, cb) }

    async #attempt(depResults) {
        await this.#workflow.checkPause();
        if (this.state === "removed")
            throw new Error(`Task ${this.id} was removed before execution`);
        this.#fsm.invoke("start");
        let work = this.#work(...depResults);
        if (this.#timeout != null) {
            const timeout = Time.delay(() => {
                this.#fsm.invoke("timeout");
                throw new Error(`Task ${this.id} timed out after ${this.#timeout}ms`);
            }, this.#timeout)
            work = Promise.race([work, timeout()]);
        }
        this.#result = await work;
        this.#fsm.invoke("succeed");
        return this.#result;
    }

    async execute(depResults) {
        if (this.state === "cancelled")
            throw this.#error;
        for (this.#attempts = 0; this.#attempts <= this.#retryLimit; this.#attempts++) {
            try {
                return await this.#attempt(depResults);
            } catch (error) {
                this.#error = error;
                if (this.state !== "failed") {
                    this.#fsm.invoke("fail");
                }
                if (this.#attempts === this.#retryLimit)
                    return this.#error;
                this.#fsm.invoke("retry");
                await Time.wait(2 ** this.#attempts * this.#backoff);
            }
        }
    }

    // TODO add support for executing subgraphs?

    [Symbol.for("nodejs.util.inspect.custom")]() { return this.toString() }

    toJSON() {
        return {
            id: this.id,
            state: this.state,
            result: this.result,
            error: this.error?.toString(),
            reliesOn: this.reliesOn,
            priority: this.priority,
            timeout: this.timeout,
            backoff: this.backoff,
            retryLimit: this.retryLimit
        }
    }

    toString() {
        switch (this.state) {
            case "succeeded":
                return `<Task:id='${this.#id}',state='${this.state}',result={${JSON.stringify(this.#result)}}>`;
            default:
                return `<Task:id='${this.#id}',state='${this.state}',error='${this.#error?.toString()}'>`;
        }
    }
}