export { Time } from './Time.js';
export { effect, hex, id, rgb, effects, hexToRgb, bg } from './Colorizer.js';
export { Logger, LogLevel } from './Logger.js';
export { DAG } from './DAG.js';
export { Semaphore } from './Semaphore.js';
export { Signaller } from './Signaller.js';
export { StateMachine } from './StateMachine.js';
export { StateMachineManager } from './StateMachineManager.js';
export { Task } from './Task.js';
export { Workflow } from './Workflow.js';

export function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    Object.keys(obj).forEach(key => deepFreeze(obj[key]));
    return Object.freeze(obj);
}