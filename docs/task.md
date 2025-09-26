# Task Class

The `Task` class represents a single unit of work in a workflow with comprehensive state management, retry logic, and dependency handling.

## Overview

Tasks are the fundamental building blocks of workflows. Each task has a work function, configuration options, and lifecycle state management through a finite state machine.

## Task States

Tasks progress through the following states:

- `created` → `pending` → `running` → `succeeded`/`failed`
- `pending` → `cancelled` (if cancelled)
- `failed` → `pending` (if retried)
- Any state → `removed` (if removed)

## Constructor

Tasks are created through the `Workflow.add()` method, not directly:

```javascript
const task = workflow.add(workFunction, config);
```

### Parameters

- `workFunction` (function): The work function to execute
- `config` (Object, optional): Task configuration

### Configuration Options

- `id` (string, optional): Unique identifier (auto-generated if not provided)
- `reliesOn` (string[], default: []): Array of task IDs this task depends on
- `priority` (number, default: 0): Task priority (higher numbers execute first)
- `retryLimit` (number, default: 0): Maximum number of retry attempts
- `timeout` (number, optional): Task timeout in milliseconds
- `backoff` (number, default: 200): Base backoff time for retries in milliseconds

## Properties

### `id`
- **Type**: `string`
- **Description**: Unique identifier for the task

### `state`
- **Type**: `string`
- **Description**: Current state of the task

### `reliesOn`
- **Type**: `string[]`
- **Description**: Array of task IDs this task depends on

### `priority`
- **Type**: `number`
- **Description**: Task priority (higher numbers execute first)

### `retryLimit`
- **Type**: `number`
- **Description**: Maximum number of retry attempts

### `attempts`
- **Type**: `number`
- **Description**: Current number of attempts made

### `timeout`
- **Type**: `number|null`
- **Description**: Task timeout in milliseconds or null

### `backoff`
- **Type**: `number`
- **Description**: Base backoff time for retries in milliseconds

### `result`
- **Type**: `any`
- **Description**: The result of successful task execution

### `error`
- **Type**: `Error|undefined`
- **Description**: The error that occurred during execution

## Methods

### `cancel()`

Cancels the task if it's in the `pending` state.

### `remove()`

Removes the task from the workflow and transitions it to the `removed` state.

### `execute(depResults)`

Executes the task with retry logic and dependency results.

#### Parameters

- `depResults` (any[]): Results from dependency tasks

#### Returns

- `Promise<any>`: The task result

#### Throws

- `Error`: If the task is cancelled or fails after all retries

## Event Handling

### Event Registration

```javascript
// Register event listeners
task.on(event, callback, signal);
task.onEnter(state, callback, signal);
task.onLeave(state, callback, signal);
task.onBefore(transition, callback, signal);
task.onAfter(transition, callback, signal);
```

### Available Events

#### Transition Events
- `add.before/after`: Before/After Task is added to workflow
- `start.before/after`: Before/After Task starts executing
- `succeed.before/after`: Before/After Task completes successfully
- `fail.before/after`: Before/After Task fails
- `timeout.before/after`: Before/After Task times out
- `retry.before/after`: Before/After Task is retried after failure
- `cancel.before/after`: Before/After Task is cancelled
- `remove.before/after`: Before/After Task is removed

#### State Events
- `created.enter/leave`: Task enters/leaves created state
- `pending.enter/leave`: Task enters/leaves pending state
- `running.enter/leave`: Task enters/leaves running state
- `succeeded.enter/leave`: Task enters/leaves succeeded state
- `failed.enter/leave`: Task enters/leaves failed state
- `cancelled.enter/leave`: Task enters/leaves cancelled state
- `removed.enter/leave`: Task enters/leaves removed state

### Example

```javascript
task.on('start.after', () => {
    console.log(`Task ${task.id} started`);
});

task.onAfter('succeed', (ctx) => {
    console.log(`Task ${ctx.id} succeeded with result:`, ctx.payload.result);
});

task.onAfter('fail', (ctx) => {
    console.log(`Task ${ctx.id} failed:`, ctx.payload.error);
});
```

## Work Function

The work function is the core of a task. It receives results from dependency tasks as parameters:

```javascript
const task = workflow.add(async (depResult1, depResult2) => {
    // Your work logic here
    const result = await processData(depResult1, depResult2);
    return result;
}, {
    reliesOn: ['task1', 'task2']
});
```

### Work Function Guidelines

1. **Async Functions**: Use async functions for asynchronous work
2. **Error Handling**: Let errors bubble up for retry logic
3. **Return Values**: Return meaningful results for dependent tasks
4. **Resource Cleanup**: Ensure proper cleanup in finally blocks
5. **Timeout Awareness**: Be aware of task timeouts

## Retry Logic

Tasks automatically retry on failure with exponential backoff:

```javascript
const task = workflow.add(async () => {
    // This might fail
    return await unreliableOperation();
}, {
    retryLimit: 3,
    backoff: 1000 // Base backoff of 1 second
});
```

### Retry Behavior

- **Exponential Backoff**: Delay increases exponentially: `backoff * 2^attempt`
- **Maximum Retries**: Stops after `retryLimit` attempts
- **State Transitions**: `failed` → `pending` → `running` → `succeeded`/`failed`

## Timeout Handling

Tasks can have timeouts to prevent hanging:

```javascript
const task = workflow.add(async () => {
    return await longRunningOperation();
}, {
    timeout: 5000 // 5 second timeout
});
```

### Timeout Behavior

- **Automatic Failure**: Task fails if timeout is exceeded
- **State Transition**: `running` → `failed`
- **Error Message**: Includes timeout duration in error message

## Complete Example

```javascript
import { Workflow, Logger } from './src/index.js';

const logger = new Logger({ level: 'DEBUG' });
const workflow = new Workflow({ maxConcurrent: 2 });

// Task with retry logic and timeout
const fetchData = workflow.add(async () => {
    logger.info('Fetching data from API...');
    
    // Simulate API call that might fail
    if (Math.random() < 0.3) {
        throw new Error('API request failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { data: 'fetched data' };
}, {
    id: 'fetchData',
    retryLimit: 3,
    timeout: 5000,
    backoff: 1000
});

// Task that depends on fetchData
const processData = workflow.add(async (fetchResult) => {
    logger.info('Processing data:', fetchResult);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
        original: fetchResult,
        processed: true,
        timestamp: new Date().toISOString()
    };
}, {
    id: 'processData',
    reliesOn: ['fetchData'],
    priority: 10
});

// Monitor task events
fetchData.onAfter('start', () => logger.info('Fetch task started'));
fetchData.onAfter('succeed', (ctx) => logger.info('Fetch task succeeded'));
fetchData.onAfter('fail', (ctx) => logger.error('Fetch task failed:', ctx.payload.error));

processData.onAfter('start', () => logger.info('Process task started'));
processData.onAfter('succeed', (ctx) => logger.info('Process task succeeded'));

// Execute workflow
try {
    for await (const task of workflow) {
        logger.info(`Task ${task.id} completed:`, task.result);
    }
} catch (error) {
    logger.error('Workflow failed:', error);
}
```

## Best Practices

1. **Meaningful IDs**: Use descriptive task IDs for easier debugging
2. **Error Handling**: Let errors bubble up for automatic retry
3. **Timeout Configuration**: Set appropriate timeouts for long-running tasks
4. **Retry Limits**: Use reasonable retry limits to avoid infinite loops
5. **Event Monitoring**: Use event listeners to track task progress
6. **Resource Management**: Clean up resources in finally blocks
7. **Dependency Design**: Keep dependencies simple and clear
8. **Priority Usage**: Use priorities to control execution order when dependencies allow
