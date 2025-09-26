#!/usr/bin/env node

/**
 * Error Handling Example
 * 
 * This example demonstrates robust error handling in the DAG Workflow Executor:
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Error recovery strategies
 * - Graceful failure handling
 */

import { Workflow, Logger, Time } from '../src/index.js';

// Create a logger for better output
const logger = new Logger({ 
    level: 'INFO', 
    prefix: 'ErrorHandling' 
});

async function main() {
    logger.info('Starting error handling example...');

    const workflow = new Workflow({ 
        maxConcurrent: 2,
        id: 'error-handling-example'
    });

    // Task 1: Unreliable API call with retry logic
    workflow.add(async () => {
        logger.info('📡 Attempting to fetch data from unreliable API...');
        
        // Simulate unreliable API (30% failure rate)
        if (Math.random() < 0.3) {
            throw new Error('API request failed - network timeout');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const data = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            source: 'unreliable-api'
        };
        
        logger.info('✅ Data fetched successfully:', data.id);
        return data;
    }, {
        id: 'fetchData',
        retryLimit: 3,
        backoff: 1000, // 1 second base backoff
        timeout: 5000, // 5 second timeout
        priority: 1
    });

    // Task 2: Data validation that might fail
    workflow.add(async (data) => {
        logger.info('🔍 Validating fetched data...');
        
        // Simulate validation that might fail
        if (!data.id || data.id.length < 5) {
            throw new Error('Data validation failed - invalid ID format');
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const validation = {
            isValid: true,
            validatedAt: new Date().toISOString(),
            dataId: data.id
        };
        
        logger.info('✅ Data validation passed');
        return { data, validation };
    }, {
        id: 'validateData',
        reliesOn: ['fetchData'],
        retryLimit: 2,
        backoff: 500,
        priority: 2
    });

    // Task 3: Processing that might timeout
    workflow.add(async (validatedData) => {
        logger.info('🔄 Processing validated data...');
        
        // Simulate processing that might take too long
        const processingTime = Math.random() * 3000; // 0-3 seconds
        
        if (processingTime > 2000) {
            logger.warn('⚠️ Processing is taking longer than expected...');
        }
        
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        const processed = {
            ...validatedData,
            processed: true,
            processingTime: processingTime,
            processedAt: new Date().toISOString()
        };
        
        logger.info('✅ Data processing completed');
        return processed;
    }, {
        id: 'processData',
        reliesOn: ['validateData'],
        timeout: 2500, // 2.5 second timeout
        priority: 3
    });

    // Task 4: Final save operation
    workflow.add(async (processedData) => {
        logger.info('💾 Saving processed data...');
        
        // Simulate save operation
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const saveResult = {
            id: Math.random().toString(36).substr(2, 9),
            data: processedData,
            savedAt: new Date().toISOString()
        };
        
        logger.info('✅ Data saved successfully');
        return saveResult;
    }, {
        id: 'saveData',
        reliesOn: ['processData'],
        priority: 4
    });

    // Monitor task retry attempts
    workflow.taskManager.onAfter('retry', (ctx) => {
        const task = ctx.payload;
        logger.warn(`🔄 Task '${task.id}' retrying (attempt ${task.attempts}/${task.retryLimit})`);
    });

    // Monitor task timeouts
    workflow.taskManager.onAfter('timeout', (ctx) => {
        const task = ctx.payload;
        logger.error(`⏰ Task '${task.id}' timed out after ${task.timeout}ms`);
    });

    // Monitor task failures
    workflow.taskManager.onAfter('fail', (ctx) => {
        const task = ctx.payload;
        logger.error(`❌ Task '${task.id}' failed after ${task.attempts} attempts:`, task.error?.message);
    });

    // Monitor task successes
    workflow.taskManager.onAfter('succeed', (ctx) => {
        const task = ctx.payload;
        logger.info(`✅ Task '${task.id}' succeeded after ${task.attempts} attempts`);
    });

    // Monitor workflow state changes
    workflow.onAfter('begin', () => {
        logger.info('🚀 Workflow started - testing error handling scenarios');
    });

    workflow.onAfter('end', () => {
        logger.info('🏁 Workflow completed');
    });

    workflow.onAfter('abort', () => {
        logger.error('🛑 Workflow aborted due to critical failure');
    });

    try {
        logger.info('📋 Workflow configuration:');
        logger.info('  - fetchData: 3 retries, 1s backoff, 5s timeout');
        logger.info('  - validateData: 2 retries, 0.5s backoff');
        logger.info('  - processData: 2.5s timeout (might timeout)');
        logger.info('  - saveData: no retries, no timeout');
        logger.info('');

        // Execute workflow with error handling
        let completedTasks = 0;
        let failedTasks = 0;

        for await (const task of workflow) {
            if (task.state === 'succeeded') {
                completedTasks++;
                logger.info(`🎯 Task '${task.id}' completed successfully`);
            } else if (task.state === 'failed') {
                failedTasks++;
                logger.error(`💥 Task '${task.id}' failed permanently:`, task.error?.message);
            }
        }

        logger.info('');
        logger.info('📊 Workflow Summary:');
        logger.info(`  ✅ Completed tasks: ${completedTasks}`);
        logger.info(`  ❌ Failed tasks: ${failedTasks}`);
        logger.info(`  📈 Success rate: ${Math.round((completedTasks / (completedTasks + failedTasks)) * 100)}%`);

        if (failedTasks > 0) {
            logger.warn('⚠️ Some tasks failed, but workflow continued with available results');
        } else {
            logger.info('🎉 All tasks completed successfully!');
        }

    } catch (error) {
        logger.error('💥 Workflow execution failed:', error?.message);
        
        // Show which tasks failed
        const failedTasks = workflow.getOrdered().filter(task => task.state === 'failed');
        if (failedTasks.length > 0) {
            logger.error('Failed tasks:');
            failedTasks.forEach(task => {
                logger.error(`  - ${task.id}: ${task.error?.message}`);
            });
        }
        
        process.exit(1);
    }
}

// Run the example
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
