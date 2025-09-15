export class Semaphore {
    #max;
    #active;
    #queue;
    constructor(max) {
        this.#max = max;
        this.#active = 0;
        this.#queue = [];
    }
    get locked() { return this.#active === this.#max }
    get active() { return this.#active }
    get max() { return this.#max }
    get queue() { return Array.from(this.#queue) }

    async acquire() {
        if (this.#active < this.#max) {
            this.#active++;
            return;
        }
        await new Promise(resolve => this.#queue.push(resolve));
        this.#active++;
    }

    release() {
        this.#active--;
        if (this.#queue.length > 0) {
            const resolve = this.#queue.shift();
            resolve();
        }
    }

    async withLock(fn) {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
}