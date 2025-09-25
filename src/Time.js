export class Time {
    // convert seconds to ms
    static seconds(amt) {
        return amt * 1000;
    }
    // convert minutes to ms
    static minutes(amt) {
        return amt * 1000 * 60
    }
    // waits/sleeps for some amount of time
    static async wait(ms) {
        if (ms === Number.POSITIVE_INFINITY)
            await this.forever();
        let handle;
        await new Promise(res => handle = setTimeout(res, ms)).finally(() => clearTimeout(handle));
    }
    // waits forever
    static async forever() {
        await new Promise(() => { });
    }
    // continuously tries executing callback until it either:
    // - returns a truthy value
    // - fails with an error
    // - timeout is exceeded
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
    // tries executing callback until timeout exceeded
    static async timeout(cb, ms = 5000) {
        let timeout;
        if (ms === Number.POSITIVE_INFINITY)
            timeout = this.forever.bind(this);
        else
            timeout = Time.delay(() => { throw new Error(`Timed out after ${ms}ms`) }, ms);
        return Promise.race([cb(), timeout()]);
    }
    // delays execution of a callback 
    static delay(cb, ms) {
        return async (...args) => {
            await Time.wait(ms);
            return cb(...args);
        }
    }
    static get stamp() {
        return new Date().toISOString();
    }
}
