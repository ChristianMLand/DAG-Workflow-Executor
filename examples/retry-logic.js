#!/usr/bin/env node

/**
 * Retry Logic Example
 * 
 * This example demonstrates the retry mechanism with exponential backoff:
 * - Simulating unreliable operations
 * - Configuring retry limits and backoff strategies
 * - Monitoring retry attempts and failures
 * - Using Array.fromAsync for result collection
 */

import { Workflow, Logger, Time } from '../src/index.js';

const logger = new Logger({ 
    level: 'INFO', 
    prefix: 'RetryLogic' 
});

// Helper function to create a task that fails a certain number of times
function failUntil(count) {
    let attempts = 0;
    return async function() {
        await Time.wait(50); // Simulate some work
        if (attempts++ < count) {
            throw new Error(`Operation failed (attempt ${attempts}/${count + 1})`);
        }
        return `Success after ${attempts} attempts`;
    };
}

async function main() {
    logger.info('🚀 Starting retry logic example...');

    const workflow = new Workflow({ 
        maxConcurrent: 3,
        id: 'retry-example'
    });

    // Set up event monitoring
    workflow.taskManager.onAfter("start", (ctx) => {
        logger.debug(`🔄 Starting task: ${ctx.id}`);
    });

    workflow.taskManager.onAfter("succeed", (ctx) => {
        const task = ctx.payload;
        logger.info(`✅ Task '${task.id}' succeeded after ${task.attempts} attempts`);
    });

    workflow.taskManager.onAfter("fail", (ctx) => {
        const task = ctx.payload;
        logger.error(`❌ Task '${task.id}' failed after ${task.attempts} attempts: ${task.error.message}`);
    });

    workflow.taskManager.onAfter("retry", (ctx) => {
        const task = ctx.payload;
        logger.warn(`🔄 Task '${task.id}' retrying (attempt ${task.attempts}/${task.retryLimit + 1})`);
    });

    // Add tasks with different retry configurations
    const tasks = [
        // Task that fails 2 times, then succeeds (3 total attempts)
        workflow.add(failUntil(2), { 
            id: 'task-fail-2', 
            retryLimit: 3,
            backoff: 100,
            priority: 1
        }),
        
        // Task that fails 1 time, then succeeds (2 total attempts)
        workflow.add(failUntil(1), { 
            id: 'task-fail-1', 
            retryLimit: 2,
            backoff: 200,
            priority: 2
        }),
        
        // Task that never fails
        workflow.add(async () => {
            await Time.wait(100);
            return 'Immediate success';
        }, { 
            id: 'task-success', 
            retryLimit: 1,
            priority: 3
        }),
        
        // Task that fails more times than retry limit allows
        workflow.add(failUntil(5), { 
            id: 'task-fail-many', 
            retryLimit: 2, // Will fail permanently
            backoff: 150,
            priority: 4
        }),
        
        // Task with exponential backoff
        workflow.add(failUntil(3), { 
            id: 'task-exponential', 
            retryLimit: 4,
            backoff: 100, // Base backoff of 100ms
            priority: 5
        })
    ];

    logger.info(`📋 Created workflow with ${workflow.size} tasks`);
    logger.info('🎯 Testing different retry scenarios:');
    logger.info('  - task-fail-2: Fails 2 times, succeeds on 3rd (should succeed)');
    logger.info('  - task-fail-1: Fails 1 time, succeeds on 2nd (should succeed)');
    logger.info('  - task-success: Never fails (should succeed immediately)');
    logger.info('  - task-fail-many: Fails 5 times, retry limit 2 (should fail permanently)');
    logger.info('  - task-exponential: Fails 3 times, succeeds on 4th (should succeed)');
    logger.info('');

    try {
        // Use Array.fromAsync to collect all results
        logger.info('📦 Collecting all results with Array.fromAsync...');
        const startTime = Date.now();
        
        // Use stream() instead of try() to collect all results including failures
        const allResults = await Array.fromAsync(workflow.stream({
            states: ['succeeded', 'failed'],
            onlyTerminal: true
        }));
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        
        logger.info(`⏱️ Collection completed in ${totalTime}ms`);
        logger.info('');
        
        // Analyze results
        const successful = allResults.filter(result => result.state === 'succeeded');
        const failed = allResults.filter(result => result.state === 'failed');
        
        logger.info('📊 Results Summary:');
        logger.info(`  ✅ Successful tasks: ${successful.length}`);
        logger.info(`  ❌ Failed tasks: ${failed.length}`);
        logger.info(`  📈 Success rate: ${Math.round((successful.length / allResults.length) * 100)}%`);
        logger.info('');
        
        // Show detailed results
        logger.info('📋 Detailed Results:');
        allResults.forEach((task, index) => {
            if (task.state === 'succeeded') {
                logger.info(`  ${index + 1}. ✅ ${task.id}: ${task.result} (${task.attempts} attempts)`);
            } else {
                logger.error(`  ${index + 1}. ❌ ${task.id}: ${task.error.message} (${task.attempts} attempts)`);
            }
        });
        
        // Show backoff timing for exponential example
        if (successful.some(t => t.id === 'task-exponential')) {
            logger.info('');
            logger.info('⏰ Exponential Backoff Example (task-exponential):');
            logger.info('  - Attempt 1: Immediate (0ms delay)');
            logger.info('  - Attempt 2: 100ms delay (100 * 2^0)');
            logger.info('  - Attempt 3: 200ms delay (100 * 2^1)');
            logger.info('  - Attempt 4: 400ms delay (100 * 2^2)');
            logger.info('  - Total retry time: ~700ms + execution time');
        }
        
        logger.info('');
        logger.info('🎉 Retry logic example completed successfully!');

    } catch (error) {
        logger.error('💥 Workflow failed:', error);
        process.exit(1);
    }
}

// Run the example
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
