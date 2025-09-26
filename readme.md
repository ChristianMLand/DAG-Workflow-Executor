# DAG Workflow Executor

> A powerful, event-driven workflow execution engine with dependency resolution, concurrency control, and comprehensive state management.

**Author:** Christian Land 2025

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Documentation](#documentation)
- [License](#license)

## Overview

The DAG Workflow Executor is a robust JavaScript library for managing complex workflows with dependencies, concurrency control, and comprehensive state management. Built around a Directed Acyclic Graph (DAG) architecture, it ensures proper execution order while providing powerful features like retry logic, timeouts, progress tracking, and event-driven state transitions.

## Features

### 🚀 **Core Workflow Management**
- **Dependency Resolution**: Automatic topological sorting ensures tasks execute in correct order
- **Concurrency Control**: Configurable semaphore-based concurrency limiting
- **Task Lifecycle**: Complete state management from creation to completion
- **Retry Logic**: Exponential backoff with configurable retry limits
- **Timeout Handling**: Per-task timeout configuration with automatic failure

### 🎯 **State Management**
- **Finite State Machines**: Built-in FSM for workflow and task state management
- **Event-Driven**: Comprehensive event system for state transitions
- **Lifecycle Hooks**: Before/after transition and state entry/exit events
- **State Persistence**: JSON serialization support for state inspection

### 🔧 **Developer Experience**
- **TypeScript-Ready**: Full JSDoc type annotations for excellent IDE support
- **Colored Logging**: Rich terminal output with customizable themes
- **Progress Tracking**: Built-in progress bars and timing utilities
- **Error Handling**: Comprehensive error reporting and debugging support

### ⚡ **Performance & Reliability**
- **Memory Efficient**: Optimized DAG implementation with caching
- **Streaming Support**: Async iterators for real-time task monitoring
- **Pause/Resume**: Runtime workflow control
- **Graceful Shutdown**: Proper cleanup and resource management

## Quick Start

### Basic Usage

```javascript
import { Workflow } from './src/index.js';

// Create a workflow with concurrency limit
const workflow = new Workflow({ maxConcurrent: 2 });

// Listen to lifecycle events
workflow.taskManager.onAfter('start', ctx => {
    console.log(`Task ${ctx.id} started executing!`)
})

workflow.taskManager.onAfter('fail', ctx => {
    console.error(`Task ${ctx.id} failed execution!`);
});

// Add tasks with dependencies
workflow.add(async () => {
    return await new Promise(resolve => {
        setTimeout(() => resolve({ data: 'A' }), 1000)
    })
}, { id: 'taskA' });

workflow.add(async resultA => {
    return { processed: resultA.data + '_processed' };
}, { id: 'taskB', reliesOn: ['taskA'] });

workflow.add(async (resultA, resultB) => {
    return { final: 'complete' };
}, { id: 'taskC', reliesOn: ['taskA', 'taskB'] });

// Execute workflow - Method 1: Collect all terminal, successful, tasks (does not throw)
for await (const task of workflow.stream()) {
    console.log(`Task ${task.id} completed:`, task.result);
}

// Execute workflow - Method 2: Collect only terminal, successful, results (throws if any tasks fails)
try {
    const endResults = await Array.fromAsync(workflow.try());
    console.log('All end results:', endResults);
} catch(err) {
    console.error('Workflow failed:', err);
}
```

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd DAG

# Install dependencies (if any)
npm install

# Use directly in your project
import { Workflow } from './src/index.js';
```

## Core Concepts

### Workflow
The main orchestrator that manages task execution, dependency resolution, and concurrency control.

### Task
Individual units of work with configurable retry logic, timeouts, and dependencies.

### DAG (Directed Acyclic Graph)
The underlying data structure that ensures proper execution order and prevents circular dependencies.

### State Machine
Event-driven state management for both workflows and individual tasks.

### Semaphore
Concurrency control mechanism that limits the number of simultaneously executing tasks.

For detailed consumption patterns and advanced usage, see the [**Workflow Documentation**](./docs/workflow.md).

## Examples

- **[Basic Workflow](./examples/basic-workflow.js)** - Simple dependency chain
- **[Pokemon API](./examples/pokemon-api.js)** - Real-world API workflow with multiple consumption patterns
- **[Retry Logic](./examples/retry-logic.js)** - Exponential backoff and retry strategies
- **[Concurrent Processing](./examples/concurrent-processing.js)** - Parallel task execution
- **[Error Handling](./examples/error-handling.js)** - Retry logic and failure management

## Documentation

Detailed documentation is available in the `docs/` directory:

- [Workflow Management](./docs/workflow.md)
- [Task Configuration](./docs/task.md)
- [DAG Operations](./docs/dag.md)
- [State Machines](./docs/state-machine.md)
- [Logging & Progress](./docs/logger.md)

## License

This project is licensed under the MIT License - see the [LICENSE](license.txt) file for details.