# StateMachine Class

The `StateMachine` class provides a finite state machine implementation with event-driven state transitions and comprehensive lifecycle management.

## Overview

State machines are powerful tools for managing complex state transitions in applications. This implementation provides a robust foundation for managing workflow and task states with full event support.

## Constructor

```javascript
new StateMachine(config, id, instance)
```

### Parameters

- `config` (Object): State machine configuration
  - `initial` (string): Initial state name
  - `transitions` (Object): Transition definitions
- `id` (string, optional): Unique identifier for the state machine
- `instance` (any, optional): Instance object to pass to transition handlers

### Transition Definition Format

```javascript
{
    transitionName: {
        from: 'sourceState' | ['state1', 'state2'] | '*',
        to: 'targetState'
    }
}
```

### Example

```javascript
import { StateMachine } from './src/index.js';

const stateDef = {
    initial: 'idle',
    transitions: {
        start: { from: 'idle', to: 'running' },
        pause: { from: 'running', to: 'paused' },
        resume: { from: 'paused', to: 'running' },
        complete: { from: 'running', to: 'completed' },
        reset: { from: '*', to: 'idle' } // '*' means any state
    }
};

const fsm = new StateMachine(stateDef, 'my-fsm', this);
```

## Properties

### `id`
- **Type**: `string`
- **Description**: Unique identifier of the state machine

### `state`
- **Type**: `string`
- **Description**: Current state name

### `allStates`
- **Type**: `string[]`
- **Description**: Array of all available states

### `allTransitions`
- **Type**: `string[]`
- **Description**: Array of all available transitions

### `do`
- **Type**: `Object<string, function>`
- **Description**: Transition action handlers

## Methods

### `invoke(transition)`

Invokes a state transition.

#### Parameters

- `transition` (string): The transition name to invoke

#### Returns

- `Object`: Transition context object with transition details

#### Throws

- `Error`: If the transition is invalid or not allowed from current state

#### Example

```javascript
const ctx = fsm.invoke('start');
console.log('Transitioned from', ctx.from, 'to', ctx.to);
```

### `stream(event)`

Creates a readable stream for state machine events.

#### Parameters

- `event` (string|string[]): Event name(s) to stream

#### Returns

- `ReadableStream`: Stream of events

### Event Registration Methods

```javascript
// Register event listeners
fsm.on(event, callback, signal);
fsm.onEnter(state, callback, signal);
fsm.onLeave(state, callback, signal);
fsm.onBefore(transition, callback, signal);
fsm.onAfter(transition, callback, signal);
```

#### Parameters

- `event/state/transition` (string|string[]): Event/state/transition name(s)
- `callback` (function): Callback function
- `signal` (AbortSignal, optional): Optional abort signal for cleanup

## Event Types

### Transition Events
- `{transition}.before`: Fired before a transition occurs
- `{transition}.after`: Fired after a transition completes

### State Events
- `{state}.enter`: Fired when entering a state
- `{state}.leave`: Fired when leaving a state

### Wildcard Events
- `*`: Fired for all events (receives event name and data)

## Complete Example

```javascript
import { StateMachine } from './src/index.js';

// Define a download state machine
const downloadStateDef = {
    initial: 'idle',
    transitions: {
        start: { from: 'idle', to: 'downloading' },
        pause: { from: 'downloading', to: 'paused' },
        resume: { from: 'paused', to: 'downloading' },
        complete: { from: 'downloading', to: 'completed' },
        error: { from: 'downloading', to: 'failed' },
        retry: { from: 'failed', to: 'downloading' },
        reset: { from: '*', to: 'idle' }
    }
};

class DownloadManager {
    constructor() {
        this.fsm = new StateMachine(downloadStateDef, 'download-manager', this);
        this.progress = 0;
        this.error = null;
        
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // State entry handlers
        this.fsm.onEnter('downloading', () => {
            console.log('📥 Download started');
            this.startDownload();
        });

        this.fsm.onEnter('paused', () => {
            console.log('⏸️ Download paused');
            this.pauseDownload();
        });

        this.fsm.onEnter('completed', () => {
            console.log('✅ Download completed');
            this.progress = 100;
        });

        this.fsm.onEnter('failed', (ctx) => {
            console.log('❌ Download failed:', ctx.payload);
            this.error = ctx.payload;
        });

        // Transition handlers
        this.fsm.onBefore('start', (ctx) => {
            console.log('🚀 Starting download...');
            ctx.payload = { url: 'https://example.com/file.zip' };
        });

        this.fsm.onAfter('complete', (ctx) => {
            console.log('🎉 Download finished successfully');
        });

        // Wildcard handler for all events
        this.fsm.on('*', (event, data) => {
            console.log(`📊 Event: ${event}`, data);
        });
    }

    start() {
        return this.fsm.invoke('start');
    }

    pause() {
        return this.fsm.invoke('pause');
    }

    resume() {
        return this.fsm.invoke('resume');
    }

    complete() {
        return this.fsm.invoke('complete');
    }

    fail(error) {
        return this.fsm.invoke('error', error);
    }

    retry() {
        return this.fsm.invoke('retry');
    }

    reset() {
        return this.fsm.invoke('reset');
    }

    startDownload() {
        // Simulate download progress
        const interval = setInterval(() => {
            this.progress += 10;
            console.log(`📊 Progress: ${this.progress}%`);
            
            if (this.progress >= 100) {
                clearInterval(interval);
                this.complete();
            }
        }, 1000);
        
        this.downloadInterval = interval;
    }

    pauseDownload() {
        if (this.downloadInterval) {
            clearInterval(this.downloadInterval);
            this.downloadInterval = null;
        }
    }
}

// Usage example
const downloader = new DownloadManager();

// Start download
downloader.start();

// Simulate pausing after 3 seconds
setTimeout(() => {
    downloader.pause();
    
    // Resume after 2 seconds
    setTimeout(() => {
        downloader.resume();
    }, 2000);
}, 3000);
```

## Advanced Patterns

### Conditional Transitions

```javascript
const conditionalStateDef = {
    initial: 'pending',
    transitions: {
        approve: { from: 'pending', to: 'approved' },
        reject: { from: 'pending', to: 'rejected' },
        review: { from: ['approved', 'rejected'], to: 'pending' }
    }
};

const fsm = new StateMachine(conditionalStateDef);

// Add conditional logic in transition handlers
fsm.onBefore('approve', (ctx) => {
    if (!ctx.payload || !ctx.payload.valid) {
        throw new Error('Cannot approve invalid data');
    }
});
```

### Event Streaming
> **Note:** you need to manually break out of the loop when done to prevent node from exiting the process prematurely
```javascript

const stream = fsm.stream("*");

// Stream the next 5 events
let count = 5;
for await (const event of stream) {
    console.log('State change:', event);
    if (--count <= 0) break;
}
```

## Best Practices

1. **Clear State Names**: Use descriptive state names that clearly indicate the current condition
2. **Minimal States**: Keep the number of states to a minimum while maintaining clarity
3. **Event Handling**: Use event handlers for side effects, not for business logic
4. **Error Handling**: Always handle invalid transitions gracefully
5. **State Validation**: Validate state transitions before allowing them
6. **Documentation**: Document all states and transitions clearly
7. **Testing**: Test all possible state transitions and edge cases
8. **Immutable State**: Avoid mutating state directly; use transitions instead
