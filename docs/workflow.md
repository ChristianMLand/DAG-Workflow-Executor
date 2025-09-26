# Workflow Class

The `Workflow` class is the main orchestrator for managing task execution with dependency resolution, concurrency control, and state management.

## Overview

A workflow manages a collection of tasks organized in a Directed Acyclic Graph (DAG), ensuring proper execution order while providing features like concurrency control, retry logic, and comprehensive event handling.

## Constructor

```javascript
new Workflow(config)
```

### Parameters

- `config` (Object, optional): Configuration options
  - `maxConcurrent` (number, default: 1): Maximum number of concurrent tasks
  - `id` (string, optional): Unique identifier for the workflow

### Example

```javascript
import { Workflow } from './src/index.js';

const workflow = new Workflow({ 
    maxConcurrent: 3,
    id: 'my-workflow' 
});
```

## Properties

### `id`
- **Type**: `string`
- **Description**: Id of the workflow

### `state`
- **Type**: `string`
- **Description**: Current state of the workflow (`idle`, `executing`, `paused`, `done`, `aborted`)

### `isPaused`
- **Type**: `boolean`
- **Description**: Whether the workflow is currently paused

### `size`
- **Type**: `number`
- **Description**: Number of tasks in the workflow

### `active`
- **Type**: `number`
- **Description**: Number of currently active tasks

## Methods

### `add(work, config)`

Adds a new task to the workflow.

#### Parameters

- `work` (function): The work function to execute
- `config` (Object, optional): Task configuration
  - `id` (string, optional): Unique identifier for the task
  - `reliesOn` (string[], default: []): Array of task IDs this task depends on
  - `priority` (number, default: 0): Task priority (higher numbers execute first)
  - `retryLimit` (number, default: 0): Maximum number of retry attempts
  - `timeout` (number, optional): Task timeout in milliseconds
  - `backoff` (number, default: 200): Base backoff time for retries in milliseconds

#### Returns

- `Task`: The created task instance

#### Example

```javascript
const task = workflow.add(async (depResult1, depResult2) => {
    // Task work function
    return await processData(depResult1, depResult2);
}, {
    id: 'processData',
    reliesOn: ['fetchData1', 'fetchData2'],
    priority: 10,
    retryLimit: 3,
    timeout: 5000
});
```

### `getTask(id)`

Retrieves a task by its ID.

#### Parameters

- `id` (string): The task ID

#### Returns

- `Task|undefined`: The task or undefined if not found

### `getOrdered()`

Gets all tasks in topological order, sorted by priority.

#### Returns

- `Task[]`: Array of tasks in execution order

### `remove(id)`

Removes a task from the workflow.

#### Parameters

- `id` (string): The task ID to remove

#### Returns

- `Task|undefined`: The removed task or undefined if not found

### `flush()`

Removes all tasks from the workflow.

### `pause()`

Pauses the workflow execution.

### `resume()`

Resumes the workflow execution.

### `abort()`

Aborts the workflow execution.

## Event Handling

The workflow uses a state machine to manage its lifecycle:
### States
- **idle**: Initial state, no tasks executing
- **executing**: Tasks are being executed
- **paused**: Execution is paused
- **done**: All tasks completed successfully
- **aborted**: Execution was aborted
### Transitions
- **begin**: Transition from `idle` to `executing`
- **pause**: Transition from `executing` to `paused`
- **resume**: Transition from `paused` to `executing`
- **end**: Transition from `executing` or `paused` to `done`
- **abort**: Transition from `executing` or `paused` to `aborted`

### Event Registration

```javascript
workflow.on(event, callback, signal);
workflow.onEnter(state, callback, signal);
workflow.onLeave(state, callback, signal);
workflow.onBefore(transition, callback, signal);
workflow.onAfter(transition, callback, signal);
```

### Available Events

The order events get fired is as folows:

1. `transition.before`
2. `state.leave` (from state)
3. `state.enter` (to state)
4. `transition.after`

#### Transition Events
- `begin.before/after`: Before/After Workflow starts executing
- `pause.before/after`: Before/After Workflow is paused
- `resume.before/after`: Before/After Workflow is resumed
- `end.before/after`: Before/After Workflow completes successfully
- `abort.before/after`: Before/After Workflow is aborted

#### State Events
- `idle.enter/leave`: Workflow enters/leaves idle state
- `executing.enter/leave`: Workflow enters/leaves executing state
- `paused.enter/leave`: Workflow enters/leaves paused state
- `done.enter/leave`: Workflow enters/leaves done state
- `aborted.enter/leave`: Workflow enters/leaves aborted state

### Example

```javascript
workflow.on('begin.after', () => {
    console.log('Workflow started');
});

workflow.onEnter('executing', () => {
    console.log('Workflow is now executing tasks');
});

workflow.onAfter('end', () => {
    console.log('All tasks completed successfully');
});
```

## Execution

The workflow supports three streaming approaches to consume results, each with different default behaviors:

### `workflow[Symbol.asyncIterator]()`

Yields all tasks regardless of state or terminality.

```javascript
for await (const task of workflow) {
    console.log(`Task ${task.id} completed:`, task.result);
}
```

### `workflow.stream()`

**Default:** Yields tasks that succeeded and have no dependents.

```javascript
for await (const task of workflow.stream()) {
    console.log(`End result: ${task.id} -> ${task.result}`);
}
```

### `workflow.try()`

**Default:** Yields results for tasks that succeeded and have no dependents, and throws on first failure

```javascript
try {
    for await (const result of workflow.try()) {
        console.log('End result:', result);
    }
} catch (error) {
    console.error('Workflow failed:', error);
}
```

### Key Differences Summary

| Method | Default Behavior | Yields | Error Handling |
|--------|------------------|--------|----------------|
| `workflow[Symbol.asyncIterator]` | **All tasks** | Task objects | Never throws |
| `workflow.stream` | **Terminal, Successful tasks** | Task objects | Never throws |
| `workflow.try` | **Terminal, Successful results** | Result values | **Throws on first failure** |

> **Note**: "Terminal" means tasks with no dependents. "Successful" means tasks in the `succeeded` state.

### When to Use Each Pattern

**Use Direct Iteration when:**
- You want to monitor all tasks regardless of state or terminality

**Use Stream method when:**
- You want to filter what tasks are monitored
- You want task objects with metadata instead of direct results

**Use Try Method when:**
- You want to filter what task results are monitored
- You want to fail fast on any error
- You only want the results of the workflow, rather than task objects

### Advanced Filtering

Use the `stream()` or `try()` methods to filter and consume specific tasks:

#### Examples:
> Stream only all terminal tasks, regardless of state
```js
const stream = workflow.stream({ states: ["*"] });
for await (const task of stream) {
    console.log(`End result: ${task.id} ->`, task.result);
}
```
> Stream only terminal, successful results for tasks with ids that start with "test"
```js
const stream = workflow.try({ filter: t => t.id.startsWith("test") });
for await (const task of stream) {
    console.log(`End result: ${task.id} ->`, task.result);
}
```

### `stream(options)`

Creates a filtered stream of tasks.

#### Parameters

- `options` (Object, optional): Filtering options
  - `states` (string[], default: ['succeeded']): Task states to include
  - `onlyTerminal` (boolean, default: true): Only include terminal tasks (tasks with no dependents)
  - `filter` (function, optional): Custom filter function

#### Returns

- `AsyncIterable<Task>`: Stream of filtered tasks

### `try(options)`

Creates a filtered stream that yields only successful results and throws on failure.

#### Parameters

- `options` (Object, optional): Filtering options
  - `onlyTerminal` (boolean, default: true): Only include terminal tasks (tasks with no dependents)
  - `filter` (function, optional): Custom filter function

#### Returns

- `AsyncIterable<any>`: Stream of terminal successful results (not task objects)
