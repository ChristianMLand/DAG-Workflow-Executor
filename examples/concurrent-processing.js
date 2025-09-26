#!/usr/bin/env node

/**
 * Concurrent Processing Example
 * 
 * This example demonstrates concurrent task execution in the DAG Workflow Executor:
 * - Parallel task execution with concurrency limits
 * - Independent tasks running simultaneously
 * - Resource management with semaphores
 * - Performance comparison between sequential and concurrent execution
 */

import { Workflow, Logger, Time } from '../src/index.js';

// Create a logger for better output
const logger = new Logger({ 
    level: 'INFO', 
    prefix: 'Concurrent' 
});

async function main() {
    logger.info('Starting concurrent processing example...');

    // Create a workflow with higher concurrency
    const workflow = new Workflow({ 
        maxConcurrent: 4, // Allow up to 4 tasks to run simultaneously
        id: 'concurrent-example'
    });

    // Helper function to simulate work with different durations
    const simulateWork = async (taskName, duration, workType = 'processing') => {
        logger.info(`🔄 ${taskName}: Starting ${workType}...`);
        
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, duration));
        const endTime = Date.now();
        
        const result = {
            taskName,
            workType,
            duration: endTime - startTime,
            completedAt: new Date().toISOString()
        };
        
        logger.info(`✅ ${taskName}: Completed ${workType} in ${result.duration}ms`);
        return result;
    };

    // Create multiple independent tasks that can run concurrently
    const tasks = [];

    // Task 1: Data fetching (1 second)
    tasks.push(workflow.add(async () => {
        return await simulateWork('DataFetch', 1000, 'data fetching');
    }, {
        id: 'dataFetch',
        priority: 1
    }));

    // Task 2: Image processing (1.5 seconds)
    tasks.push(workflow.add(async () => {
        return await simulateWork('ImageProcess', 1500, 'image processing');
    }, {
        id: 'imageProcess',
        priority: 1
    }));

    // Task 3: File validation (800ms)
    tasks.push(workflow.add(async () => {
        return await simulateWork('FileValidation', 800, 'file validation');
    }, {
        id: 'fileValidation',
        priority: 1
    }));

    // Task 4: Database query (1.2 seconds)
    tasks.push(workflow.add(async () => {
        return await simulateWork('DatabaseQuery', 1200, 'database query');
    }, {
        id: 'databaseQuery',
        priority: 1
    }));

    // Task 5: API call (900ms)
    tasks.push(workflow.add(async () => {
        return await simulateWork('ApiCall', 900, 'API call');
    }, {
        id: 'apiCall',
        priority: 1
    }));

    // Task 6: Cache update (600ms)
    tasks.push(workflow.add(async () => {
        return await simulateWork('CacheUpdate', 600, 'cache update');
    }, {
        id: 'cacheUpdate',
        priority: 1
    }));

    // Aggregation task that depends on all previous tasks
    const aggregateResults = workflow.add(async (...results) => {
        logger.info('🔄 Aggregating results from all tasks...');
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const aggregated = {
            totalTasks: results.length,
            totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
            averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
            tasks: results,
            aggregatedAt: new Date().toISOString()
        };
        
        logger.info('✅ Results aggregated successfully');
        return aggregated;
    }, {
        id: 'aggregateResults',
        reliesOn: tasks.map(t => t.id),
        priority: 2
    });

    // Monitor concurrent execution
    let activeTasks = 0;
    let maxConcurrent = 0;

    workflow.taskManager.onAfter('start', (ctx) => {
        activeTasks++;
        maxConcurrent = Math.max(maxConcurrent, activeTasks);
        logger.info(`🚀 Task '${ctx.id}' started (${activeTasks} active tasks)`);
    });

    workflow.taskManager.onAfter('succeed', (ctx) => {
        activeTasks--;
        logger.info(`✅ Task '${ctx.id}' completed (${activeTasks} active tasks)`);
    });

    workflow.taskManager.onAfter('fail', (ctx) => {
        activeTasks--;
        logger.error(`❌ Task '${ctx.id}' failed (${activeTasks} active tasks)`);
    });

    // Monitor workflow events
    workflow.onAfter('begin', () => {
        logger.info('🚀 Workflow started with concurrent execution');
    });

    workflow.onAfter('end', () => {
        logger.info('🏁 Workflow completed');
    });

    try {
        logger.info('📋 Concurrent workflow configuration:');
        logger.info(`  - Max concurrent tasks: ${workflow.active} (will be updated during execution)`);
        logger.info(`  - Total independent tasks: ${tasks.length}`);
        logger.info(`  - Aggregation task depends on all ${tasks.length} tasks`);
        logger.info('');

        const startTime = Date.now();

        // Execute the workflow
        const results = [];
        for await (const task of workflow) {
            results.push({
                id: task.id,
                state: task.state,
                result: task.result
            });
        }

        const endTime = Date.now();
        const totalDuration = endTime - startTime;

        logger.info('');
        logger.info('📊 Concurrent Execution Results:');
        logger.info(`  ⏱️  Total execution time: ${totalDuration}ms`);
        logger.info(`  🔥 Maximum concurrent tasks: ${maxConcurrent}`);
        logger.info(`  📈 Concurrency efficiency: ${Math.round((maxConcurrent / 4) * 100)}%`);
        logger.info(`  ✅ Completed tasks: ${results.length}`);

        // Show individual task results
        logger.info('');
        logger.info('📋 Task Results:');
        results.forEach(result => {
            if (result.state === 'succeeded') {
                const duration = result.result.duration || 'N/A';
                logger.info(`  ✅ ${result.id}: ${duration}ms`);
            } else {
                logger.error(`  ❌ ${result.id}: ${result.state}`);
            }
        });

        // Calculate theoretical sequential time
        const sequentialTime = results
            .filter(r => r.state === 'succeeded' && r.result.duration)
            .reduce((sum, r) => sum + r.result.duration, 0);

        if (sequentialTime > 0) {
            const speedup = sequentialTime / totalDuration;
            logger.info('');
            logger.info('⚡ Performance Analysis:');
            logger.info(`  🐌 Sequential time would be: ${sequentialTime}ms`);
            logger.info(`  🚀 Concurrent time was: ${totalDuration}ms`);
            logger.info(`  📈 Speedup factor: ${speedup.toFixed(2)}x`);
        }

        logger.info('');
        logger.info('🎉 Concurrent processing example completed successfully!');

    } catch (error) {
        logger.error('💥 Workflow execution failed:', error);
        process.exit(1);
    }
}

// Run the example
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
