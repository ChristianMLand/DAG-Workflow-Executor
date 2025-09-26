#!/usr/bin/env node

/**
 * Pokemon API Example
 * 
 * This example demonstrates a real-world workflow using the Pokemon API:
 * - Fetching a batch of Pokemon
 * - Parallel fetching of individual Pokemon data and species
 * - Data processing and aggregation
 * - Multiple consumption patterns (for await vs Array.fromAsync)
 * - Error handling and retry logic
 */

import { Workflow, Logger, Time } from '../src/index.js';

// Create abort controller for cleanup
const controller = new AbortController();

// API functions
async function fetchPokemonBatch(count) {
    return fetch("https://pokeapi.co/api/v2/pokemon?limit=" + count, { signal: controller.signal })
        .then(res => res.json())
        .then(res => res.results);
}

async function fetchPokemon(name) {
    return fetch("https://pokeapi.co/api/v2/pokemon/" + name, { signal: controller.signal })
        .then(res => res.json());
}

async function fetchPokemonSpecies(name) {
    return fetch("https://pokeapi.co/api/v2/pokemon-species/" + name, { signal: controller.signal })
        .then(res => res.json());
}

async function parsePokeData(poke, species) {
    return {
        id: poke.id,
        name: poke.name,
        types: poke.types.map(t => t.type.name),
        dexEntry: species.flavor_text_entries[0]?.flavor_text || 'No description available',
        evolvesFrom: species?.evolves_from_species?.name || null,
        height: poke.height,
        weight: poke.weight,
        baseExperience: poke.base_experience
    };
}

async function main() {
    const logger = new Logger({ level: "INFO", prefix: "PokemonAPI" });
    
    logger.info('🚀 Starting Pokemon API workflow example...');

    // Create workflow with concurrency control
    const workflow = new Workflow({ maxConcurrent: 5 });
    const numPoke = 9;

    // Set up event monitoring
    workflow.taskManager.onAfter("start", (ctx) => {
        logger.debug(`🔄 Starting task: ${ctx.id}`);
    });

    workflow.taskManager.onAfter("succeed", (ctx) => {
        logger.debug(`✅ Finished task: ${ctx.id}`);
    });

    workflow.taskManager.onAfter("fail", (ctx) => {
        logger.error(`❌ Failed task: ${ctx.id}: ${ctx.payload.error.message}`);
    });

    workflow.taskManager.onAfter("retry", (ctx) => {
        logger.warn(`🔄 Retrying task: ${ctx.id} (attempt ${ctx.payload.attempts})`);
    });

    // Cleanup on abort
    workflow.onAfter("abort", () => {
        logger.warn('🛑 Workflow aborted, cleaning up...');
        controller.abort();
    });

    try {
        
        workflow.add(() => fetchPokemonBatch(numPoke), { 
            id: "fetchBatch",
            priority: 100
        });

        // Add individual Pokemon processing tasks
        for (let i = 0; i < numPoke; i++) {
            // Fetch individual Pokemon data
            workflow.add((batchResult) => fetchPokemon(batchResult[i].name), { 
                id: `fetchPokemon-${i}`, 
                reliesOn: ["fetchBatch"],
                priority: 50
            });
            
            // Fetch Pokemon species data
            workflow.add((batchResult) => fetchPokemonSpecies(batchResult[i].name), { 
                id: `fetchSpecies-${i}`, 
                reliesOn: ["fetchBatch"],
                priority: 50
            });
            
            // Parse and combine the data
            workflow.add((poke, species) => parsePokeData(poke, species), { 
                id: `parsePokemon-${i}`, 
                reliesOn: [`fetchPokemon-${i}`, `fetchSpecies-${i}`],
                priority: 10
            });
        }

        logger.info(`📋 Created workflow with ${workflow.size} tasks`);
        logger.info(`🎯 Fetching data for ${numPoke} Pokemon with max concurrency of ${workflow.active}`);
        logger.info('');

        // Method 1: Stream results as they complete (real-time processing)
        logger.info('📡 Method 1: Streaming results as they complete...');
        const startTime = Date.now();
        
        for await (const pokemon of workflow.try()) {
            logger.info(`🎮 ${pokemon.name} (#${pokemon.id}) - Types: [${pokemon.types.join(', ')}]`);
        }
        
        const streamTime = Date.now() - startTime;
        logger.info(`⏱️ Streaming completed in ${streamTime}ms`);
        logger.info('');

        // Method 2: Collect all results at once using Array.fromAsync
        logger.info('📦 Method 2: Collecting all results with Array.fromAsync...');
        const collectStartTime = Date.now();
        
        try {
            const allResults = await Array.fromAsync(workflow.try());
            
            const collectTime = Date.now() - collectStartTime;
            
            logger.info(`⏱️ Collection completed in ${collectTime}ms`);
            logger.info(`📊 Collected ${allResults.length} Pokemon results:`);
            logger.info('');
            
            // Display summary
            allResults.forEach((pokemon, index) => {
                logger.info(`${index + 1}. ${pokemon.name} (#${pokemon.id})`);
                logger.info(`   Types: [${pokemon.types.join(', ')}]`);
                logger.info(`   Height: ${pokemon.height} | Weight: ${pokemon.weight}`);
                logger.info(`   Base Experience: ${pokemon.baseExperience}`);
                if (pokemon.evolvesFrom) {
                    logger.info(`   Evolves from: ${pokemon.evolvesFrom}`);
                }
                logger.info('');
            });
            
            // Show performance comparison
            logger.info('📈 Performance Comparison:');
            logger.info(`   Streaming: ${streamTime}ms`);
            logger.info(`   Collection: ${collectTime}ms`);
            logger.info(`   Difference: ${Math.abs(streamTime - collectTime)}ms`);
            
        } catch (error) {
            logger.error('💥 Collection failed:', error.message);
        }

        logger.info('');
        logger.info('🎉 Pokemon API workflow example completed successfully!');

    } catch (error) {
        logger.error('💥 Workflow failed:', error);
        process.exit(1);
    } finally {
        // Cleanup
        controller.abort();
    }
}

// Run the example
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
