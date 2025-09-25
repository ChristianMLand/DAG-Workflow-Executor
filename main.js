import { Workflow, Logger, LogLevel, Time } from "./workflow/index.js"; // assuming your code is in workflow.js

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
let active = 0;
workflow.taskManager.onAfter("start", (task) => {
    logger.info(`Starting task: ${task.id}, concurrent: ${++active}`);
});

workflow.taskManager.onAfter("succeed", (task) => {
    logger.info(`Finished task: ${task.id}, concurrent: ${--active}`);
});

workflow.taskManager.onAfter("fail", (task) => {
    logger.error(`Failed task: ${task.id}, concurrent: ${--active}`);
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
        return "HELLO WORLD";
    }
}

// workflow.add(failUntil(5), { retryLimit: 1, priority: 100 })

workflow.add(() => fetchPokemonBatch(numPoke), { id: "fetchBatch" })

for (let i = 0; i < numPoke; i++) {
    workflow.add((res) => fetchPokemon(res[i].name), { id: `fetchName-${i}`, reliesOn: ["fetchBatch"] });
    workflow.add((res) => fetchPokemonSpecies(res[i].name), { id: `fetchSpecies-${i}`, reliesOn: ["fetchBatch"] });
    workflow.add((poke, species) => parsePokeData(poke, species), { id: `parsePoke-${i}`, reliesOn: [`fetchName-${i}`, `fetchSpecies-${i}`]})
}

// can either consume through a for await loop, or with Array.fromAsync

for await(const task of workflow.stream()) {
    logger.debug("Result:", task.result);
}

// Array.fromAsync(workflow.try())
//     .then(res => res.forEach(t => logger.debug("Result:", t)))
//     .catch(err => logger.error(err.toString()))
