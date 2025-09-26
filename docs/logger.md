# Logger Class

The `Logger` class provides comprehensive logging capabilities with colored output, file logging, progress tracking, and customizable themes.

## Overview

The logger system is designed to provide rich, structured logging with support for different log levels, colored terminal output, file persistence, and real-time progress tracking.

## Log Levels

```javascript
import { LogLevel } from './src/index.js';

// Available log levels
LogLevel.DEBUG   // 0 - Detailed debugging information
LogLevel.INFO    // 1 - General information messages
LogLevel.WARN    // 2 - Warning messages
LogLevel.ERROR   // 3 - Error messages
```

## Constructor

```javascript
new Logger(config)
```

### Parameters

- `config` (Object, optional): Logger configuration
  - `level` (string, default: "INFO"): Log level (DEBUG, INFO, WARN, ERROR)
  - `file` (string, optional): File path for logging
  - `prefix` (string, optional): Prefix for log messages
  - `progressBars` (Object[], optional): Shared progress bars array
  - `theme` (Object, optional): Custom theme overrides

### Example

```javascript
import { Logger } from './src/index.js';

const logger = new Logger({
    level: 'DEBUG',
    file: './logs/app.log',
    prefix: 'MyApp',
    theme: {
        ctx: effect('cyan', 'bold')
    }
});
```

## Methods

### Logging Methods

```javascript
logger.debug(...args);  // Log debug message
logger.info(...args);   // Log info message
logger.warn(...args);   // Log warning message
logger.error(...args);  // Log error message
logger.log(level, msg, ...ctx); // Log with specific level
```

### Scoped Logging

```javascript
const scopedLogger = logger.scope('ComponentName');
scopedLogger.info('This message will have the component prefix');
```

### Utility Methods

#### `timer(label)`

Creates a timer function that logs elapsed time when called.

```javascript
const timer = logger.timer('Database Query');
// ... do work ...
timer(); // Logs: "Database Query: finished in 150ms"
```

#### `counter(label)`

Creates a counter function that logs incrementing values.

```javascript
const counter = logger.counter('Items Processed');
counter(); // Logs: "Items Processed: 1"
counter(); // Logs: "Items Processed: 2"
```

#### `progress(total, options)`

Creates a progress bar for tracking completion.

```javascript
const updateProgress = logger.progress(100, {
    label: 'Processing Files',
    width: 40
});

// Update progress
updateProgress(); // Increments and redraws progress bar
```

#### `close()`

Closes the file stream if it exists.

## Complete Example

```javascript
import { Logger, LogLevel } from './src/index.js';

// Create main logger
const logger = new Logger({
    level: 'DEBUG',
    file: './logs/workflow.log',
    prefix: 'WorkflowEngine'
});

// Create scoped loggers
const taskLogger = logger.scope('TaskManager');
const dbLogger = logger.scope('Database');

async function main() {
    logger.info('🚀 Starting workflow engine...');
    
    // Use timer for performance tracking
    const startupTimer = logger.timer('Application Startup');
    
    try {
        // Simulate startup process
        await initializeDatabase();
        await loadConfiguration();
        await startWorkers();
        
        startupTimer(); // Logs startup time
        
        // Use counter for tracking operations
        const operationCounter = logger.counter('API Calls');
        
        // Simulate API calls
        for (let i = 0; i < 5; i++) {
            await makeApiCall();
            operationCounter();
        }
        
        // Use progress bar for long-running operation
        const progress = logger.progress(10, {
            label: 'Processing Items',
            width: 30
        });
        
        for (let i = 0; i < 10; i++) {
            await processItem(i);
            progress();
        }
        
        logger.info('✅ Workflow engine started successfully');
        
    } catch (error) {
        logger.error('💥 Failed to start workflow engine:', error);
        throw error;
    } finally {
        logger.close();
    }
}

async function initializeDatabase() {
    dbLogger.info('🔧 Initializing database connection...');
    
    const dbTimer = dbLogger.timer('Database Connection');
    
    try {
        // Simulate database connection
        await new Promise(resolve => setTimeout(resolve, 500));
        dbLogger.info('✅ Database connected successfully');
    } catch (error) {
        dbLogger.error('❌ Database connection failed:', error);
        throw error;
    } finally {
        dbTimer();
    }
}

async function loadConfiguration() {
    taskLogger.info('📋 Loading configuration...');
    
    // Simulate config loading
    await new Promise(resolve => setTimeout(resolve, 200));
    taskLogger.info('✅ Configuration loaded');
}

async function startWorkers() {
    taskLogger.info('👷 Starting worker processes...');
    
    // Simulate worker startup
    await new Promise(resolve => setTimeout(resolve, 300));
    taskLogger.info('✅ Workers started');
}

async function makeApiCall() {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
}

async function processItem(itemId) {
    // Simulate item processing
    await new Promise(resolve => setTimeout(resolve, 200));
}

// Run the example
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
```

## Custom Themes

You can customize the logger appearance by providing theme overrides:

```javascript
import { Logger, effect, id } from './src/index.js';

const customLogger = new Logger({
    level: 'INFO',
    theme: {
        // Custom styles for different log levels
        [LogLevel.DEBUG]: effect(id(69), 'bold'),
        [LogLevel.INFO]: effect('green', 'bold'),
        [LogLevel.WARN]: effect('yellow', 'bold'),
        [LogLevel.ERROR]: effect('red', 'bold'),
        
        // Custom context styling
        ctx: effect('cyan', 'italic'),
        
        // Custom timestamp styling
        ts: effect('gray', 'italic')
    }
});
```

## File Logging

When file logging is enabled, messages are written to both console and file:

```javascript
const fileLogger = new Logger({
    level: 'DEBUG',
    file: './logs/application.log'
});

// Messages appear in both console and file
fileLogger.info('This message goes to both console and file');
```

### File Format

File logs include timestamps and structured data:

```
[2025-01-25T20:16:30.123Z] [INFO] [MyApp] Starting application
[2025-01-25T20:16:30.124Z] [DEBUG] [MyApp] Configuration loaded {"config": {...}}
[2025-01-25T20:16:30.125Z] [ERROR] [MyApp] Database connection failed {"error": "Connection timeout"}
```

## Progress Bars

Progress bars provide visual feedback for long-running operations:

```javascript
const logger = new Logger();

// Create progress bar
const progress = logger.progress(100, {
    label: 'Downloading Files',
    width: 40
});

// Update progress
for (let i = 0; i < 100; i++) {
    await downloadFile(i);
    progress(); // Updates and redraws progress bar
}
```

### Progress Bar Output

```
[Downloading Files] [████████████████████████████████] 100%
```

## Best Practices

1. **Appropriate Log Levels**: Use the right log level for each message
   - `DEBUG`: Detailed debugging information
   - `INFO`: General application flow
   - `WARN`: Potential issues that don't stop execution
   - `ERROR`: Errors that need attention

2. **Structured Logging**: Include relevant context in log messages
   ```javascript
   logger.info('User login', { userId: 123, ip: '192.168.1.1' });
   ```

3. **Scoped Loggers**: Use scoped loggers for different components
   ```javascript
   const dbLogger = logger.scope('Database');
   const apiLogger = logger.scope('API');
   ```

4. **Performance Tracking**: Use timers for performance monitoring
   ```javascript
   const timer = logger.timer('Database Query');
   // ... do work ...
   timer();
   ```

5. **Progress Feedback**: Use progress bars for long-running operations
   ```javascript
   const progress = logger.progress(totalItems, { label: 'Processing' });
   ```

6. **Error Context**: Include error details in error logs
   ```javascript
   logger.error('Operation failed', { error: error.message, stack: error.stack });
   ```

7. **File Logging**: Enable file logging for production environments
   ```javascript
   const logger = new Logger({
       level: 'INFO',
       file: './logs/app.log'
   });
   ```

8. **Resource Cleanup**: Always close file loggers when done
   ```javascript
    logger.close();
   ```