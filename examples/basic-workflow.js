#!/usr/bin/env node

/**
 * Basic Workflow Example
 * 
 * This example demonstrates the fundamental concepts of the DAG Workflow Executor:
 * - Creating a workflow
 * - Adding tasks with dependencies
 * - Executing tasks in the correct order
 * - Handling task results
 */

import { Workflow, Logger } from '../src/index.js';

// Create a logger for better output
const logger = new Logger({ 
    level: 'INFO', 
    prefix: 'BasicWorkflow' 
});

async function main() {
    logger.info('Starting basic workflow example...');

    // Create a workflow with concurrency limit of 2
    const workflow = new Workflow({ 
        maxConcurrent: 2,
        id: 'basic-example'
    });

    // Task 1: Fetch user data (no dependencies)
    workflow.add(async () => {
        logger.info('📡 Fetching user data from API...');
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const userData = {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            createdAt: new Date().toISOString()
        };
        
        logger.info('✅ User data fetched:', userData);
        return userData;
    }, {
        id: 'fetchUser',
        priority: 1
    });

    // Task 2: Fetch user posts (no dependencies)
    workflow.add(async () => {
        logger.info('📡 Fetching user posts from API...');
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const posts = [
            { id: 1, title: 'My First Post', content: 'Hello world!' },
            { id: 2, title: 'Learning JavaScript', content: 'Async/await is awesome!' },
            { id: 3, title: 'Workflow Engines', content: 'DAGs are powerful!' }
        ];
        
        logger.info('✅ Posts fetched:', posts.length, 'posts');
        return posts;
    }, {
        id: 'fetchPosts',
        priority: 1
    });

    // Task 3: Process combined data (depends on both fetchUser and fetchPosts)
    workflow.add(async (userData, postsData) => {
        logger.info('🔄 Processing combined user and posts data...');
        
        // Simulate data processing
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const processedData = {
            user: userData,
            posts: postsData,
            summary: {
                totalPosts: postsData.length,
                userJoinDate: userData.createdAt,
                lastPostTitle: postsData[postsData.length - 1]?.title || 'No posts'
            },
            processedAt: new Date().toISOString()
        };
        
        logger.info('✅ Data processed successfully');
        return processedData;
    }, {
        id: 'processData',
        reliesOn: ['fetchUser', 'fetchPosts'],
        priority: 2
    });

    // Task 4: Save results (depends on processData)
    workflow.add(async (processedData) => {
        logger.info('💾 Saving processed data...');
        
        // Simulate database save
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const saveResult = {
            id: Math.random().toString(36).slice(2, 9),
            data: processedData,
            savedAt: new Date().toISOString()
        };
        
        logger.info('✅ Data saved with ID:', saveResult.id);
        return saveResult;
    }, {
        id: 'saveResults',
        reliesOn: ['processData'],
        priority: 3
    });

    // Monitor workflow events
    workflow.onAfter('begin', () => {
        logger.info('🚀 Workflow execution started');
    });

    workflow.onAfter('end', () => {
        logger.info('🏁 Workflow execution completed');
    });

    // Monitor individual task events
    workflow.taskManager.onAfter('succeed', (ctx) => {
        logger.info(`✅ Task '${ctx.id}' completed successfully`);
    });

    workflow.taskManager.onAfter('fail', (ctx) => {
        logger.error(`❌ Task '${ctx.id}' failed:`, ctx.payload.error);
    });

    try {
        // Execute the workflow
        logger.info('📋 Workflow tasks:');
        logger.info('  - fetchUser (no dependencies)');
        logger.info('  - fetchPosts (no dependencies)');
        logger.info('  - processData (depends on: fetchUser, fetchPosts)');
        logger.info('  - saveResults (depends on: processData)');
        logger.info('');

        // Iterate through completed tasks
        for await (const task of workflow) {
            logger.info(`🎯 Task '${task.id}' completed with result:`, {
                state: task.state,
                result: task.result
            });
        }

        logger.info('');
        logger.info('🎉 Basic workflow example completed successfully!');

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
