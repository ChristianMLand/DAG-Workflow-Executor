import { DAG } from "./DAG.js";
import { Semaphore } from "./Semaphore.js";
import { StateMachine } from "./StateMachine.js";
import { StateMachineManager } from "./StateMachineManager.js";
import { Time } from './Time.js';
import { deepFreeze } from "./Util.js";

/**
 * Represents a single unit of work in a workflow with state management, retry logic, and dependency handling.
 */
export class Task {
    /** @type {Workflow} */
    #workflow;
    /** @type {function(...any): Promise<any>} */
    #work;
    /** @type {string} */
    #id;
    /** @type {string[]} */
    #reliesOn;
    /** @type {number} */
    #priority;
    /** @type {number} */
    #retryLimit;
    /** @type {number} */
    #attempts;
    /** @type {any} */
    #result;
    /** @type {Error|undefined} */
    #error;
    /** @type {number|null} */
    #timeout;
    /** @type {number} */
    #backoff;
    /** @type {StateMachine} */
    #fsm;

    /**
     * State machine definition for task lifecycle management.
     * @readonly
     */
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

    /**
     * Creates a new task instance.
     * @param {Workflow} workflow - The workflow this task belongs to
     * @param {function(...any): Promise<any>} work - The work function to execute
     * @param {Object} [config={}] - Task configuration
     * @param {string} [config.id] - Unique identifier for the task
     * @param {string[]} [config.reliesOn=[]] - Array of task IDs this task depends on
     * @param {number} [config.priority=0] - Task priority (higher numbers execute first)
     * @param {number} [config.retryLimit=0] - Maximum number of retry attempts
     * @param {number} [config.timeout] - Task timeout in milliseconds
     * @param {number} [config.backoff=200] - Base backoff time for retries in milliseconds
     */
    constructor(workflow, work, config = {}) {
        this.#workflow = workflow;
        this.#work = work;
        this.#id = config.id ?? crypto.randomUUID();
        this.#reliesOn = config.reliesOn ?? [];
        this.#priority = config.priority ?? 0;
        this.#retryLimit = config.retryLimit ?? 0;
        this.#timeout = config.timeout ?? null;
        this.#backoff = config.backoff ?? 200;
        this.#attempts = 0;
        this.#fsm = this.#workflow.taskManager.register(this.#id, this);
        this.#fsm.invoke("add");
        this.onAfter("start", () => this.#error = undefined);
        this.onAfter("cancel", () => this.#error = new Error("Task was cancelled!"));
        this.onAfter("remove", () => this.#workflow.taskManager.unregister(this.id));
    }

    /**
     * Gets the unique identifier of the task.
     * @returns {string} The task ID
     */
    get id() { return this.#id; }
    
    /**
     * Gets the array of task IDs this task depends on.
     * @returns {string[]} Array of dependency task IDs
     */
    get reliesOn() { return Array.from(this.#reliesOn); }
    
    /**
     * Gets the task priority.
     * @returns {number} The priority value
     */
    get priority() { return this.#priority; }
    
    /**
     * Gets the retry limit for this task.
     * @returns {number} The maximum number of retry attempts
     */
    get retryLimit() { return this.#retryLimit; }
    
    /**
     * Gets the current number of attempts made.
     * @returns {number} The number of attempts
     */
    get attempts() { return this.#attempts; }
    
    /**
     * Gets the timeout value for this task.
     * @returns {number|null} The timeout in milliseconds or null
     */
    get timeout() { return this.#timeout; }
    
    /**
     * Gets the backoff time for retries.
     * @returns {number} The backoff time in milliseconds
     */
    get backoff() { return this.#backoff; }
    
    /**
     * Gets the result of the task execution.
     * @returns {any} The task result
     */
    get result() { return this.#result; }
    
    /**
     * Gets the error that occurred during execution.
     * @returns {Error|undefined} The error or undefined
     */
    get error() { return this.#error; }
    
    /**
     * Gets the current state of the task.
     * @returns {string} The current state
     */
    get state() { return this.#fsm.state; }

    /**
     * Clears event listeners for specified events.
     * @param {string|string[]} event - Event name(s) to clear
     */
    clear(event) { this.#fsm.clear(event); }
    
    /**
     * Cancels the task.
     */
    cancel() { this.#fsm.invoke("cancel"); }
    
    /**
     * Removes the task from the workflow.
     */
    remove() { this.#fsm.invoke("remove"); }
    
    /**
     * Registers an event listener for task state changes.
     * @param {string|string[]} event - Event name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any event name is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    on(event, cb, signal) { return this.#fsm.on(event, cb, signal) }
    
    /**
     * Registers a listener for state entry events.
     * @param {string|string[]} state - State name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any state name is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onEnter(state, cb, signal) { return this.#fsm.onEnter(state, cb, signal) }
    
    /**
     * Registers a listener for state exit events.
     * @param {string|string[]} state - State name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any state name is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onLeave(state, cb, signal) { return this.#fsm.onLeave(state, cb, signal) }
    
    /**
     * Registers a listener for transition before events.
     * @param {string|string[]} transition - Transition name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any transition name is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onBefore(transition, cb, signal) { return this.#fsm.onBefore(transition, cb, signal) }
    
    /**
     * Registers a listener for transition after events.
     * @param {string|string[]} transition - Transition name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any transition name is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onAfter(transition, cb, signal) { return this.#fsm.onAfter(transition, cb, signal) }

    /**
     * Attempts to execute the task work function.
     * @private
     * @param {any[]} depResults - Results from dependency tasks
     * @returns {Promise<any>} The task result
     * @throws {Error} If the task was removed or times out
     */
    async #attempt(depResults) {
        await this.#workflow.checkPause();
        if (this.state === "removed")
            throw new Error(`Task ${this.id} was removed before execution`);
        this.#fsm.invoke("start");
        let work = this.#work(...depResults);
        if (this.#timeout != null)
            work = Time.timeout(work, this.#timeout, () => this.#fsm.invoke("timeout"));
        this.#result = await work;
        this.#fsm.invoke("succeed");
        return this.#result;
    }

    /**
     * Executes the task with retry logic and dependency results.
     * @param {any[]} depResults - Results from dependency tasks
     * @returns {Promise<any>} The task result
     * @throws {Error} If the task is cancelled or fails after all retries
     */
    async execute(depResults) {
        if (this.state === "cancelled")
            throw this.#error;
        for (this.#attempts = 0; this.#attempts <= this.#retryLimit; this.#attempts++) {
            try {
                return await this.#attempt(depResults);
            } catch (error) {
                this.#error = error;
                if (this.state !== "failed")
                    this.#fsm.invoke("fail");
                if (this.#attempts === this.#retryLimit)
                    throw this.#error;
                this.#fsm.invoke("retry");
                await Time.wait(2 ** this.#attempts * this.#backoff);
            }
        }
    }

    /**
     * Custom inspection method for Node.js.
     * @returns {string} String representation of the task
     */
    [Symbol.for("nodejs.util.inspect.custom")]() { return this.toString() }

    /**
     * Converts the task to a JSON-serializable object.
     * @returns {Object} JSON representation of the task
     */
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
            retryLimit: this.retryLimit,
            attempts: this.attempts
        }
    }

    /**
     * Returns a string representation of the task.
     * @returns {string} String representation
     */
    toString() {
        switch (this.state) {
            case "succeeded":
                return `<Task:id='${this.#id}',state='${this.state}',result={${JSON.stringify(this.#result)}}>`;
            default:
                return `<Task:id='${this.#id}',state='${this.state}',error='${this.#error?.toString()}'>`;
        }
    }
}

/**
 * A workflow executor that manages task execution with dependency resolution, concurrency control, and state management.
 * Uses a DAG to represent task dependencies and ensures proper execution order.
 */
export class Workflow {
    /** @type {DAG<Task>} */
    #dag;
    /** @type {StateMachine} */
    #fsm;
    /** @type {Map<string, Promise<any>>} */
    #processed;
    /** @type {PromiseWithResolvers<any>|null} */
    #pause;
    /** @type {Semaphore} */
    #semaphore;
    /** @type {string} */
    #id;
    /** @type {Set<string>} */
    #toRemove;

    /**
     * State machine definition for workflow lifecycle management.
     * @readonly
     */
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
    
    /**
     * Creates a new workflow instance.
     * @param {Object} [config={}] - Configuration options
     * @param {number} [config.maxConcurrent=1] - Maximum number of concurrent tasks
     * @param {string} [config.id] - Unique identifier for the workflow
     */
    constructor(config = {}) {
        this.#semaphore = new Semaphore(config.maxConcurrent ?? 1);
        this.#dag = new DAG();
        this.#processed = new Map();
        this.#pause = null;
        this.#toRemove = new Set();
        this.#id = config.id ?? crypto.randomUUID();
        this.#fsm = new StateMachine(Workflow.stateDef, this.#id, this);
        /** @type {StateMachineManager} */
        this.taskManager = new StateMachineManager(Task.stateDef);

        this.onEnter("paused", () => this.#pause = Promise.withResolvers());
        this.onLeave("paused", () => this.#pause = this.#pause.resolve());
        this.onEnter("aborted", () => {
            this.getOrdered().filter(t => t.state === "pending").forEach(t => t.cancel());
        });

        this.onBefore(["end","abort"], () => {
            this.#toRemove.forEach(t => {
                this.#dag.removeVertex(t);
                this.#processed.delete(t);
            });
            this.#toRemove.clear();
        });
    }

    /**
     * Gets the id of the workflow.
     * @returns {string} The workflow id
     */
    get id() { return this.#id }

    /**
     * Gets the current state of the workflow.
     * @returns {string} The current state
     */
    get state() { return this.#fsm.state }
    
    /**
     * Checks if the workflow is currently paused.
     * @returns {boolean} True if paused, false otherwise
     */
    get isPaused() { return this.state === "paused"; }
    
    /**
     * Gets the number of tasks in the workflow.
     * @returns {number} The number of tasks
     */
    get size() { return this.#dag.size }
    
    /**
     * Gets the number of currently active tasks.
     * @returns {number} The number of active tasks
     */
    get active() { return this.#semaphore.active }

    /**
     * Registers an event listener for workflow state changes.
     * @param {string|string[]} event - Event name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any event name is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    on(event, cb, signal) { return this.#fsm.on(event, cb, signal) }
    
    /**
     * Registers a listener for state entry events.
     * @param {string|string[]} state - State name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any state name is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onEnter(state, cb, signal) { return this.#fsm.onEnter(state, cb, signal) }
    
    /**
     * Registers a listener for state exit events.
     * @param {string|string[]} state - State name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any state name is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onLeave(state, cb, signal) { return this.#fsm.onLeave(state, cb, signal) }
    
    /**
     * Registers a listener for transition before events.
     * @param {string|string[]} transition - Transition name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any transition name is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onBefore(transition, cb, signal) { return this.#fsm.onBefore(transition, cb, signal) }
    
    /**
     * Registers a listener for transition after events.
     * @param {string|string[]} transition - Transition name(s) to listen for
     * @param {function} cb - Callback function
     * @param {AbortSignal} [signal] - Optional abort signal for cleanup
     * @throws {Error} If any transition name is invalid
     * @returns {function} Cleanup function to remove the listener(s)
     */
    onAfter(transition, cb, signal) { return this.#fsm.onAfter(transition, cb, signal) }
    
    /**
     * Clears all event listeners for specified events.
     * @param {string|string[]} event - Event name(s) to clear
     */
    clear(event) { this.#fsm.clear(event); }
    
    /**
     * Pauses the workflow execution.
     */
    pause() {
        if (this.isPaused) return;
        this.#fsm.invoke("pause");
    }
    
    /**
     * Resumes the workflow execution.
     */
    resume() {
        if (!this.isPaused) return;
        this.#fsm.invoke("resume");
    }
    
    /**
     * Aborts the workflow execution.
     */
    abort() { this.#fsm.invoke("abort") }
    
    /**
     * Gets a task by its ID.
     * @param {string} id - The task ID
     * @returns {Task|undefined} The task or undefined if not found
     */
    getTask(id) { return this.#dag.getVertex(id)?.payload; }
    
    /**
     * Gets all tasks in topological order, sorted by priority.
     * @returns {Task[]} Array of tasks in execution order
     */
    getOrdered() { return this.#dag.topoSort((a, b) => b.payload.priority - a.payload.priority) }
    
    /**
     * Removes all tasks from the workflow.
     */
    flush() { this.getOrdered().forEach(task => this.remove(task.id)); }

    /**
     * Removes a task from the workflow.
     * @param {string} id - The task ID to remove
     * @returns {Task|undefined} The removed task or undefined if not found
     */
    remove(id) {
        let toRemove;
        if (this.state === "executing" || this.state === "paused") {
            toRemove = this.getTask(id);
            this.#toRemove.add(id);
        } else {
            toRemove = this.#dag.removeVertex(id)?.payload;
            this.#processed.delete(id);
        }
        toRemove?.remove();
        return toRemove;
    }

    /**
     * Checks if the workflow is paused and waits if necessary.
     */
    async checkPause() {
        const pause = this.#pause;
        if (!pause) return;
        await pause.promise;
    }

    /**
     * Adds a new task to the workflow.
     * @param {function(...any): Promise<any>} work - The work function to execute
     * @param {Object} [config={}] - Task configuration
     * @param {string} [config.id] - Unique identifier for the task
     * @param {string[]} [config.reliesOn=[]] - Array of task IDs this task depends on
     * @param {number} [config.priority=0] - Task priority (higher numbers execute first)
     * @param {number} [config.retryLimit=0] - Maximum number of retry attempts
     * @param {number} [config.timeout] - Task timeout in milliseconds
     * @param {number} [config.backoff=200] - Base backoff time for retries in milliseconds
     * @throws {Error} If a Task with the same ID already exists
     * @returns {Task} The created task
     */
    add(work, config) {
        const task = new Task(this, work, config);
        this.#dag.addVertex(task.id, task, task.reliesOn);
        return task;
    }

    /**
     * Processes all tasks in the workflow.
     * @private
     */
    async #process() {
        this.#fsm.invoke("begin");
        if (this.state === "aborted") return;
        await this.checkPause();
        for (const task of this.getOrdered()) {
            if (!this.#processed.has(task.id))
                this.#run(task.id);
        }
        await Promise.allSettled(this.#processed.values());
    }

    /**
     * Runs a specific task and its dependencies.
     * @private
     * @param {string} id - The task ID to run
     * @returns {Promise<any>} The task execution promise
     */
    async #run(id) {
        if (this.#processed.has(id))
            return this.#processed.get(id);
        const task = this.getTask(id);
        if (!task)
            throw new Error(`Unknown task id: ${id}`);
        const p = this.#semaphore.withLock(async () => {
            const settled = await Promise.allSettled(task.reliesOn.map(did => this.#run(did)));
            if (settled.some(s => Error.isError(s.value) || s.status === 'rejected'))
                task.cancel();
            return task.execute(settled.map(s => s.value))
        })
        .catch(err => err); // have to keep this to prevent error from escaping control flow
        this.#processed.set(id, p);
        return p;
    }

    /**
     * Streams tasks as they complete that match the specified filters.
     * @param {Object} [filters={}] - Filter options
     * @param {string[]} [filters.states=["succeeded"]] - Task states to include
     * @param {boolean} [filters.onlyTerminal=true] - Only include tasks with no dependents
     * @param {function(Task): boolean} [filters.filter] - Custom filter function
     * @yields {Task} Tasks matching the filters
     */
    async *stream(filters = { states: ["succeeded"], onlyTerminal: true, filter: task => !!task }) {
        filters = {
            states: ["succeeded"],
            onlyTerminal: true,
            filter: t => !!t,
            ...filters
        }
        for await (const task of this) {
            if ((filters.states.includes("*") || filters.states.includes(task.state)) && this.#dag.isTerminal(task.id) && filters.filter(task))
                yield task;
        }
    }

    /**
     * Streams task results, throwing on any failures and aborting the remaining workflow.
     * @param {Object} [filters={}] - Filter options
     * @param {boolean} [filters.onlyTerminal=true] - Only include results for tasks with no dependents
     * @param {function(Task): boolean} [filters.filter] - Custom filter function
     * @yields {any} Task results
     * @throws {Error} If any task fails
     */
    async *try(filters = { onlyTerminal: true, filter: task => !!task }) {
        filters = {
            onlyTerminal: true,
            filter: t => t,
            ...filters
        }
        for await (const task of this) {
            if (task.state === "failed") {
                this.abort();
                throw task.error;
            }
            if ((!filters.onlyTerminal || filters.onlyTerminal && this.#dag.isTerminal(task.id)) && filters.filter(task))
                yield task.result;
        }
    }

    /**
     * Async iterator that yields tasks as they complete.
     * @yields {Task} Tasks as they finish execution
     */
    async *[Symbol.asyncIterator]() {
        if (this.state === "done" || this.state === "aborted") {
            yield* this.getOrdered(); // if already processed just yield results
            return;
        }
        const stream = this.taskManager.stream(["succeeded.enter", "cancelled.enter", "failed.enter", "removed.enter"]);
        if (this.state === "idle")
            this.#process();
        let ordered;
        let count = 0;
        while (true) {
            ordered = this.getOrdered();
            if (count >= ordered.length) break;
            for await (const ctx of stream.values({ preventCancel: true })) {
                if (ctx.to === "failed" && ctx.payload.attempts < ctx.payload.retryLimit) continue;
                yield ctx.payload;
                if (++count >= ordered.length) break;
            }
        }
        stream.cancel();
        if (this.state === "aborted") return;
        this.#fsm.invoke("end");
    }

    /**
     * Custom inspection method for Node.js.
     * @returns {string} String representation of the workflow
     */
    [Symbol.for("nodejs.util.inspect.custom")]() { return this.toString() }

    /**
     * Converts the workflow to a JSON-serializable object.
     * @returns {Object} JSON representation of the workflow
     */
    toJSON() {
        return {
            id : this.id,
            state: this.state,
            tasks: this.getOrdered().map(t => t.toJSON())
        }
    }

    /**
     * Returns a string representation of the workflow.
     * @returns {string} String representation
     */
    toString() {
        return `<Workflow: id='${this.id}', state='${this.state}', tasks=[${this.getOrdered().map(t => t.id)}]>`;
    }
}