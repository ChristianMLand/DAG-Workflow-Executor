import { Workflow, Logger, Time } from "./src/index.js";

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
    logger.debug("Starting task:", ctx.id);
});

workflow.taskManager.onAfter("succeed", (ctx) => {
    logger.debug("Finished task:", ctx.id);
});

workflow.taskManager.onEnter("failed", (ctx) => {
    logger.error(`Failed task ${ctx.id}, attempt (${ctx.payload.attempts+1}/${ctx.payload.retryLimit+1})`);
});

workflow.taskManager.onAfter("retry", (ctx) => {
    const delay = 2 ** ctx.payload.attempts * ctx.payload.backoff
    logger.warn(`Retrying task ${ctx.id} in ${delay}ms...:`);
});


workflow.taskManager.onBefore("timeout", (ctx) => {
    logger.warn(`Timed out task ${ctx.id} after ${ctx.payload.timeout}ms`);
})

workflow.onAfter("abort", () => controller.abort());

const numPoke = 9;

function failUntil(count) {
    let attempts = 0;
    return async function() {
        if (attempts++ < count) {
            await Time.wait(300);
            throw new Error("FAILED");
        }
        return fetchPokemonBatch(numPoke)
    }
}

workflow.add(failUntil(5), { id: "fetchBatch", retryLimit: 5, timeout: 300, priority: 100 })

// workflow.add(() => fetchPokemonBatch(numPoke), { id: "fetchBatch" })

for (let i = 0; i < numPoke; i++) {
    workflow.add((res) => fetchPokemon(res[i].name), { id: `fetchName-${i}`, reliesOn: ["fetchBatch"] });
    workflow.add((res) => fetchPokemonSpecies(res[i].name), { id: `fetchSpecies-${i}`, reliesOn: ["fetchBatch"] });
    workflow.add((poke, species) => parsePokeData(poke, species), { id: `parsePoke-${i}`, reliesOn: [`fetchName-${i}`, `fetchSpecies-${i}`]})
}

// can either consume through a for await loop...
for await(const task of workflow.stream()) {
    logger.info("Result:", task.result ?? task.error?.toString());
}

// ...or with Array.fromAsync
// await Array.fromAsync(workflow.try())
//     .then(res => res.forEach(t => logger.info("Result:", t)))
//     .catch(err => logger.error(err.toString()));