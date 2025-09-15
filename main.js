import { Workflow, Logger } from "./workflow/index.js"; // assuming your code is in workflow.js

// const workflow = new Workflow({ maxConcurrent: 2 });

// // ----- Tasks -----

// workflow.add(async () => {
//     console.log("Fetching posts...");
//     const res = await fetch("https://jsonplaceholder.typicode.com/posts");
//     return await res.json();
// }, { id: "extract" });

// workflow.add(async (posts) => {
//     console.log("Transforming posts...");
//     return posts.filter(p => p.userId === 1);
// }, { id: "transform", reliesOn: ["extract"] });

// workflow.add(async (filtered) => {
//     console.log("Writing results to file...");
//     await fs.writeFile("./filtered-posts.json", JSON.stringify(filtered, null, 2));
//     return true;
// }, { id: "load", reliesOn: ["transform"] });

// workflow.add(async () => {
//     console.log("✅ Pipeline completed successfully!");
//     return true;
// }, { id: "notify", reliesOn: ["load"] });

// // ----- Lifecycle Hooks -----

// workflow.on("start", t => console.log(`[${t.id}] started`));
// workflow.on("succeed", t => console.log(`[${t.id}] succeeded`));
// workflow.on("fail", t => console.error(`[${t.id}] failed:`, t.error));
// workflow.on("done", results => console.log("Workflow finished:", results));

// // ----- Run -----

// console.log("Running ETL workflow...");
// await workflow.execute();
// console.log("All tasks settled.");

// ------------------------------

// const workflow = new Workflow({ maxConcurrent: 3 });
// workflow.on("start", t => console.log(`[${t.id}] started`));
// workflow.on("succeed", t => console.log(`[${t.id}] succeeded`));
// workflow.on("fail", t => console.error(`[${t.id}] failed:`, t.error));
// workflow.on("done", f => console.log("Workflow finished:", f.getOrdered().map(t => t.result)));

// workflow.add(() => Time.delay(() => {
//     console.log("Building artifacts...");
//     return "build-output";
// }, 500)(), { id: "build" });

// workflow.add((buildOutput) => Time.delay(() => {
//     console.log("Running tests on", buildOutput);
//     return "tests-passed";
// }, 800)(), { id: "tests", reliesOn: ["build"] });

// workflow.add((buildOutput) => Time.delay(() => {
//     console.log("Linting", buildOutput);
//     return "lint-clean";
// }, 400)(), { id: "lint", reliesOn: ["build"] });

// workflow.add((buildOutput) => Time.delay(() => {
//     console.log("Security scanning", buildOutput);
//     return "scan-clean";
// }, 600)(), { id: "scan", reliesOn: ["build"] });

// workflow.add((tests, lint, scan) => Time.delay(() => {
//     console.log("Deploying with:", tests, lint, scan);
//     return "deployed!";
// }, 500)(), { id: "deploy", reliesOn: ["tests", "lint", "scan"] });

// console.log("Starting workflow...");
// workflow.execute().then(() => {
//     console.log("Pipeline finished");
// });


async function fetchPokemonBatch(count) {
    return fetch("https://pokeapi.co/api/v2/pokemon?limit=" + count)
        .then(res => res.json())
        .then(res => res.results);
}

async function fetchPokemon(name) {
    return fetch("https://pokeapi.co/api/v2/pokemon/" + name)
        .then(res => res.json());
}

async function fetchPokemonSpecies(name) {
    return fetch("https://pokeapi.co/api/v2/pokemon-species/" + name)
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
const logger = new Logger();

workflow.on("start", (task) => {
    logger.info(`Starting task: ${task.id}`);
});

workflow.on("succeed", (task) => {
    logger.info(`Finished task: ${task.id}`);
});

workflow.on("fail", (task) => {
    logger.error(`Failed task: ${task.id}`);
});

workflow.on("retry", (task) => {
    logger.warn(`Retrying task: ${task.id}`);
});

const numPoke = 9;

workflow.add(() => fetchPokemonBatch(numPoke), { id: "fetchBatch" })

for (let i = 0; i < numPoke; i++) {
    workflow.add((res) => fetchPokemon(res[i].name), { id: `fetchName-${i}`, reliesOn: ["fetchBatch"] });
    workflow.add((res) => fetchPokemonSpecies(res[i].name), { id: `fetchSpecies-${i}`, reliesOn: ["fetchBatch"] });
    workflow.add((poke, species) => parsePokeData(poke, species), { id: `parsePoke-${i}`, reliesOn: [`fetchName-${i}`, `fetchSpecies-${i}`]})
}

workflow.process()
    .then(res => res.filter(r => r.id.startsWith("parsePoke")))
    .then(res => res.map(r => r.result))
    .then(res => logger.info(res));
