import { StateMachineManager, Time } from "./index.js";

export class Task {
    #workflow;
    #work;
    #id;
    #reliesOn;
    #priority;
    #retryLimit;
    #result;
    #error;
    #timeout;
    #backoff;
    #fsm;

    static manager = new StateMachineManager({
        initial: "created",
        transitions: {
            add: { from: "created", to: "pending" },
            start: { from: "pending", to: "running" },
            cancel: { from: "pending", to: "cancelled" },
            succeed: { from: "running", to: "succeeded" },
            fail: { from: "running", to: "failed" },
            timeout: { from: "running", to: "failed" },
            retry: { from: "failed", to: "pending" },
            remove: { from: "*", to: "removed" }
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
        this.#fsm = Task.manager.register(this.#id);
        this.#fsm.do.add(this);
        this.#fsm.on("start", () => this.#error = undefined);
        this.#fsm.on("cancel", () => this.#error = new Error("Task was cancelled!"));
        this.#fsm.onAfter("remove", () => Task.manager.unregister(this.id));
    }

    get id() { return this.#id; }
    get reliesOn() { return Array.from(this.#reliesOn); }
    get priority() { return this.#priority; }
    get retryLimit() { return this.#retryLimit; }
    get timeout() { return this.#timeout; }
    get backoff() { return this.#backoff; }
    get result() { return this.#result; }
    get error() { return this.#error; }
    get state() { return this.#fsm.state; }

    on(event, cb) { this.#fsm.on(event, cb); }
    clear(event) { this.#fsm.clear(event); }
    cancel() { this.#fsm.do.cancel(this); }
    remove() { this.#fsm.do.remove(this); }

    async #attempt(depResults) {
        await this.#workflow.checkPause();
        if (this.state === "removed")
            throw new Error(`Task ${this.id} was removed before execution`);
        this.#fsm.do.start(this);
        let work = this.#work(...depResults);
        if (this.#timeout != null) {
            const timeout = Time.delay(() => {
                this.#fsm.do.timeout(this);
                throw new Error(`Task ${this.id} timed out after ${this.#timeout}ms`);
            }, this.#timeout)
            work = Promise.race([work, timeout()]);
        }
        this.#result = await work;
        this.#fsm.do.succeed(this);
        return this.#result;
    }

    async execute() {
        const settled = await Promise.allSettled(
            this.reliesOn.map(did => this.#workflow.run(did))
        );
        if (settled.some(s => s.status === 'rejected'))
            this.cancel();
        if (this.state === "cancelled")
            throw this.#error;
        const depResults = settled.map(s => s.value);
        for (let attempts = 0; attempts <= this.#retryLimit; attempts++) {
            try {
                return await this.#attempt(depResults);
            } catch (error) {
                this.#error = error;
                if (this.state !== "failed") {
                    this.#fsm.do.fail(this);
                }
                if (attempts === this.#retryLimit)
                    throw this.#error;
                this.#fsm.do.retry(this);
                await Time.wait(2 ** attempts * this.#backoff);
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
            error: this.error,
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