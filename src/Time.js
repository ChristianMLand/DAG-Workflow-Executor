/**
 * Utility class for time-related operations including delays, timeouts, and conversions.
 */
export class Time {
    /**
     * Converts seconds to milliseconds.
     * @param {number} amt - Number of seconds
     * @returns {number} Number of milliseconds
     */
    static seconds(amt) {
        return amt * 1000;
    }
    
    /**
     * Converts minutes to milliseconds.
     * @param {number} amt - Number of minutes
     * @returns {number} Number of milliseconds
     */
    static minutes(amt) {
        return amt * 1000 * 60
    }
    
    /**
     * Waits/sleeps for a specified amount of time.
     * @param {number} ms - Number of milliseconds to wait
     * @returns {Promise<void>} Promise that resolves after the specified time
     */
    static async wait(ms) {
        if (ms === Number.POSITIVE_INFINITY)
            await this.forever();
        let handle;
        await new Promise(res => handle = setTimeout(res, ms)).finally(() => clearTimeout(handle));
    }
    
    /**
     * Waits forever (never resolves).
     * @returns {Promise<never>} Promise that never resolves
     */
    static async forever() {
        await new Promise(() => { });
    }
    /**
     * Continuously tries executing a callback until it either:
     * - returns a truthy value
     * - fails with an error
     * - timeout is exceeded
     * @param {function(function): Promise<any>} cb - Callback function that receives a cancel function
     * @param {number} [ms=5000] - Timeout in milliseconds
     * @param {number} [interval=50] - Interval between attempts in milliseconds
     * @returns {Promise<any>} The result of the callback or timeout error
     */
    static async until(cb, ms = 5000, interval = 50) {
        const { promise, reject, resolve } = Promise.withResolvers();
        let check = async () => {
            try {
                let res = await cb(() => check = null);
                if (res) resolve(res);
                else setTimeout(check, interval);
            } catch (err) {
                reject(err);
            }
        }
        check();
        return this.timeout(() => promise, ms).finally(() => {
            check = null;
        })
    }
    
    /**
     * Executes a callback with a timeout.
     * @param {function(): Promise<any>} cb - Callback function to execute
     * @param {number} [ms=5000] - Timeout in milliseconds
     * @returns {Promise<any>} The result of the callback or timeout error
     */
    static async timeout(cb, ms = 5000) {
        let timeout;
        if (ms === Number.POSITIVE_INFINITY)
            timeout = this.forever.bind(this);
        else
            timeout = Time.delay(() => { throw new Error(`Timed out after ${ms}ms`) }, ms);
        return Promise.race([cb(), timeout()]);
    }
    
    /**
     * Delays execution of a callback by a specified amount of time.
     * @param {function} cb - Callback function to delay
     * @param {number} ms - Delay in milliseconds
     * @returns {function(...any): Promise<any>} Delayed function
     */
    static delay(cb, ms) {
        return async (...args) => {
            await Time.wait(ms);
            return cb(...args);
        }
    }
    
    /**
     * Gets the current timestamp as an ISO string.
     * @returns {string} Current timestamp in ISO format
     */
    static get stamp() {
        return new Date().toISOString();
    }
}
