export class DAG {
    #vertices;
    constructor() {
        this.#vertices = new Map();
    }

    static Vertex = class {
        constructor(id, payload, edges=[]) {
            this.id = id;
            this.payload = payload;
            this.edges = new Set(edges);
        }
    }

    clear() {
        for (const id of this.#vertices.keys()) {
            this.removeVertex(id);
        }
    }

    get size() {
        return this.#vertices.size;
    }

    getVertex(id) {
        return this.#vertices.get(id);
    }

    addVertex(id, payload, edges) {
        if (this.#vertices.has(id)) {
            throw new Error("Vertex ID already exists!");
        }
        this.#vertices.set(id, new DAG.Vertex(id, payload, edges));
    }

    *getAllEdges() {
        for (const id of this.#vertices.keys()) {
            for (const connId of this.getEdges(id)) {
                yield [id, connId];
            }
        }
    }

    removeVertex(id) {
        for (const [fromId, toId] of this.getAllEdges()) {
            if (toId === id) {
                this.removeEdge(fromId, toId);
            }
        }
        const toRemove = this.#vertices.get(id);
        this.#vertices.delete(id);
        return toRemove;
    }

    addEdge(fromId, toId) {
        if (fromId === toId)
            throw new Error("Invalid edge, would create cycle!");
        for (const vertex of this.#dfsFrom(toId)) {
            if (vertex.id === fromId)
                throw new Error("Invalid edge, would create cycle!");
        }
        const from = this.#vertices.get(fromId);
        if (from && this.#vertices.has(toId)) {
            from.edges.add(toId);
        }
    }

    removeEdge(fromId, toId) {
        const from = this.#vertices.get(fromId);
        if (from) {
            from.edges.delete(toId);
        }
    }

    *#dfsFrom(id, visited = new Set(), comparator = null) {
        if (visited.has(id)) return;
        const vertex = this.#vertices.get(id);
        if (!vertex) return;
        visited.add(id);
        const edges = this.getEdges(id);
        if (comparator) {
            edges.sort(comparator);
            vertex.edges.clear();
            edges.forEach(e => vertex.edges.add(e?.id));
        }
        for (const conn of edges) {
            yield* this.#dfsFrom(conn?.id, visited);
        }
        yield vertex;
    }

    *topoSort(comparator = null) {
        const visited = new Set();
        const output = [];
        const vertices = Array.from(this.#vertices.values());
        if (comparator) {
            vertices.sort(comparator);
        }
        for (const vertex of vertices) {
            if (!visited.has(vertex.id)) {
                output.push(...this.#dfsFrom(vertex.id, visited, comparator));
            }
        }
        yield* output.map(v => v.payload);
    }

    getEdges(id) {
        const vertex = this.#vertices.get(id);
        if (!vertex) return;
        return Array
            .from(vertex.edges, connId => this.#vertices.get(connId));
    }
}