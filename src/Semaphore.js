/**
 * A semaphore implementation for controlling concurrent access to resources.
 * Limits the number of concurrent operations to a specified maximum.
 */
export class Semaphore {
    /** @type {number} */
    #max;
    /** @type {number} */
    #active;
    /** @type {function[]} */
    #queue;
    
    /**
     * Creates a new semaphore instance.
     * @param {number} max - Maximum number of concurrent operations allowed
     */
    constructor(max) {
        this.#max = max;
        this.#active = 0;
        this.#queue = [];
    }
    
    /**
     * Checks if the semaphore is locked (at maximum capacity).
     * @returns {boolean} True if locked, false otherwise
     */
    get locked() { return this.#active === this.#max }
    
    /**
     * Gets the number of currently active operations.
     * @returns {number} The number of active operations
     */
    get active() { return this.#active }
    
    /**
     * Gets the maximum number of concurrent operations allowed.
     * @returns {number} The maximum limit
     */
    get max() { return this.#max }
    
    /**
     * Gets a copy of the current queue of waiting operations.
     * @returns {function[]} Array of queued resolve functions
     */
    get queue() { return Array.from(this.#queue) }

    /**
     * Acquires a permit from the semaphore.
     * If no permits are available, waits until one becomes available.
     * @returns {Promise<void>} Promise that resolves when a permit is acquired
     */
    async acquire() {
        if (this.#active < this.#max) {
            this.#active++;
            return;
        }
        await new Promise(resolve => this.#queue.push(resolve));
        this.#active++;
    }

    /**
     * Releases a permit back to the semaphore.
     * If there are waiting operations, the next one will be allowed to proceed.
     */
    release() {
        this.#active--;
        if (this.#queue.length > 0) {
            const resolve = this.#queue.shift();
            resolve();
        }
    }

    /**
     * Executes a function with a semaphore lock, automatically acquiring and releasing.
     * @param {function(): Promise<any>} fn - Function to execute with the lock
     * @returns {Promise<any>} The result of the function execution
     */
    async withLock(fn) {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
}