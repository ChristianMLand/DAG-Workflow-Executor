import { Workflow, Logger, LogLevel, Time } from "./src/index.js"; // assuming your code is in workflow.js

const controller = new AbortController();

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
        dexEnty: species.flavor_text_entries[0].flavor_text,
        evolvesFrom: species?.evolves_from_species?.name
    }
}


const workflow = new Workflow({ maxConcurrent: 5 });
const logger = new Logger({ level: "debug" });
workflow.taskManager.onAfter("start", (ctx) => {
    logger.info(`Starting task: ${ctx.id}`);
});

workflow.taskManager.onAfter("succeed", (ctx) => {
    logger.info(`Finished task: ${ctx.id}`);
});

workflow.taskManager.onAfter("fail", (ctx) => {
    logger.error(`Failed task: ${ctx.id}`);
});

workflow.taskManager.onAfter("retry", (task) => {
    logger.warn(`Retrying task: ${task.id}`);
});

workflow.onAfter("abort", () => controller.abort());

const numPoke = 9;

function failUntil(count) {
    let attempts = 0;
    return async function() {
        await Time.wait(50);
        if (attempts++ < count) 
            throw new Error("FAILED");
        return fetchPokemonBatch(numPoke);
    }
}

// workflow.add(failUntil(3), { id: "fetchBatch", retryLimit: 1, priority: 100 })

workflow.add(() => fetchPokemonBatch(numPoke), { id: "fetchBatch" })

for (let i = 0; i < numPoke; i++) {
    workflow.add((res) => fetchPokemon(res[i].name), { id: `fetchName-${i}`, reliesOn: ["fetchBatch"] });
    workflow.add((res) => fetchPokemonSpecies(res[i].name), { id: `fetchSpecies-${i}`, reliesOn: ["fetchBatch"] });
    workflow.add((poke, species) => parsePokeData(poke, species), { id: `parsePoke-${i}`, reliesOn: [`fetchName-${i}`, `fetchSpecies-${i}`]})
}

// can either consume through a for await loop...
for await(const task of workflow.stream({ states: ["*"]})) {
    logger.debug("Result:", task);
}
// ...or with Array.fromAsync
await Array.fromAsync(workflow.try())
    .then(res => res.forEach(t => logger.debug("Result:", t)))
    .catch(err => logger.error(err.toString()))

logger.debug("HELLO WORLD");