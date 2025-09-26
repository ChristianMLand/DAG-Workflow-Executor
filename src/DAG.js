/**
 * Represents a vertex in the DAG with an ID, payload, and outgoing edges.
 * @template T The type of payload stored in the vertex
 */
class Vertex {
    /**
     * Creates a new vertex.
     * @param {string} id - Unique identifier for the vertex
     * @param {T} payload - Data associated with the vertex
     * @param {string[]} [edges=[]] - Array of vertex IDs this vertex depends on
     */
    constructor(id, payload, edges=[]) {
        /** @type {string} */
        this.id = id;
        /** @type {T} */
        this.payload = payload;
        /** @type {Set<string>} */
        this.edges = new Set(edges);
    }
}

/**
 * A Directed Acyclic Graph (DAG) implementation for managing vertices and their dependencies.
 * Provides topological sorting, cycle detection, and dependency management.
 * @template T The type of payload stored in vertices
 */
export class DAG {
    /** @type {Map<string, Vertex<T>>} */
    #vertices;
    /** @type {boolean} */
    #dirty = true;
    /** @type {T[]} */
    #cached = [];
    
    /**
     * Creates a new DAG instance.
     */
    constructor() {
        this.#vertices = new Map();
    }

    /**
     * Removes all vertices from the DAG.
     */
    clear() {
        for (const id of this.#vertices.keys()) {
            this.removeVertex(id);
        }
    }

    /**
     * Gets the number of vertices in the DAG.
     * @returns {number} The number of vertices
     */
    get size() {
        return this.#vertices.size;
    }

    /**
     * Retrieves a vertex by its ID.
     * @param {string} id - The vertex ID
     * @returns {Vertex<T>|undefined} The vertex or undefined if not found
     */
    getVertex(id) {
        return this.#vertices.get(id);
    }

    /**
     * Adds a new vertex to the DAG.
     * @param {string} id - Unique identifier for the vertex
     * @param {T} payload - Data to associate with the vertex
     * @param {string[]} [edges] - Array of vertex IDs this vertex depends on
     * @throws {Error} If a vertex with the same ID already exists
     */
    addVertex(id, payload, edges) {
        if (this.#vertices.has(id)) {
            throw new Error("Vertex ID already exists!");
        }
        this.#vertices.set(id, new Vertex(id, payload, edges));
        this.#dirty = true;
    }

    /**
     * Generator that yields all edges in the DAG as [fromId, toId] pairs.
     * @yields {[string, string]} Edge pairs where the first element is the source vertex ID and the second is the target vertex ID
     */
    *getAllEdges() {
        for (const id of this.#vertices.keys()) {
            for (const connId of this.getEdges(id)) {
                yield [id, connId];
            }
        }
    }

    /**
     * Removes a vertex and all its associated edges from the DAG.
     * @param {string} id - The ID of the vertex to remove
     * @returns {Vertex<T>|undefined} The removed vertex or undefined if not found
     */
    removeVertex(id) {
        for (const [fromId, toId] of this.getAllEdges()) {
            if (toId === id) {
                this.removeEdge(fromId, toId);
            }
        }
        const toRemove = this.#vertices.get(id);
        this.#vertices.delete(id);
        this.#dirty = true;
        return toRemove;
    }

    /**
     * Adds an edge between two vertices, ensuring no cycles are created.
     * @param {string} fromId - The source vertex ID
     * @param {string} toId - The target vertex ID
     * @throws {Error} If the edge would create a cycle
     */
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
            this.#dirty = true;
        }
    }

    /**
     * Removes an edge between two vertices.
     * @param {string} fromId - The source vertex ID
     * @param {string} toId - The target vertex ID
     */
    removeEdge(fromId, toId) {
        const from = this.#vertices.get(fromId);
        if (from) {
            from.edges.delete(toId);
            this.#dirty = true;
        }
    }

    /**
     * Private generator that performs depth-first search from a given vertex.
     * @private
     * @param {string} id - The starting vertex ID
     * @param {Set<string>} [visited=new Set()] - Set of already visited vertices
     * @param {function(Vertex<T>, Vertex<T>): number} [comparator=null] - Optional comparator for sorting edges
     * @yields {Vertex<T>} Vertices in DFS order
     */
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

    /**
     * Performs topological sorting of the DAG vertices.
     * @param {function(Vertex<T>, Vertex<T>): number} [comparator=null] - Optional comparator for sorting vertices
     * @returns {T[]} Array of vertex payloads in stable topological order
     */
    topoSort(comparator = null) {
        if (!this.#dirty) return this.#cached;
        const visited = new Set();
        const output = [];
        const vertices = Array.from(this.#vertices.values());
        if (comparator) vertices.sort(comparator);
        for (const vertex of vertices) {
            if (!visited.has(vertex.id)) {
                output.push(...this.#dfsFrom(vertex.id, visited, comparator));
            }
        }
        this.#cached = output.map(v => v.payload);
        this.#dirty = false;
        return this.#cached;
    }

    /**
     * Gets the vertices that the specified vertex depends on (its edges).
     * @param {string} id - The vertex ID
     * @returns {Vertex<T>[]|undefined} Array of dependency vertices or undefined if vertex not found
     */
    getEdges(id) { // dependencies
        const vertex = this.#vertices.get(id);
        if (!vertex) return;
        return Array.from(vertex.edges, connId => this.#vertices.get(connId));
    }

    /**
     * Checks if a vertex is terminal (has no outgoing edges).
     * @param {string} id - The vertex ID to check
     * @returns {boolean} True if the vertex is terminal, false otherwise
     */
    isTerminal(id) {
        let outEdges = 0;
        for (const v of Array.from(this.#vertices.values())) {
            if (v.edges.has(id)) outEdges++;
        }
        return outEdges === 0;
    }
}