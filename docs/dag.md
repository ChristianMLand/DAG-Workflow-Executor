# DAG (Directed Acyclic Graph) Class

The `DAG` class provides a generic implementation of a Directed Acyclic Graph for managing vertices and their dependencies with topological sorting and cycle detection.

## Overview

A DAG is a graph data structure where edges have a direction and no cycles exist. This makes it perfect for representing task dependencies where each task depends on others but cannot create circular dependencies.

## Constructor

```javascript
new DAG()
```

### Example

```javascript
import { DAG } from './src/index.js';

const dag = new DAG();
```

## Properties

### `size`
- **Type**: `number`
- **Description**: Number of vertices in the DAG

## Methods

### `addVertex(id, payload, edges)`

Adds a new vertex to the DAG.

#### Parameters

- `id` (string): Unique identifier for the vertex
- `payload` (T): Data to associate with the vertex
- `edges` (string[], optional): Array of vertex IDs this vertex depends on

#### Throws

- `Error`: If a vertex with the same ID already exists

#### Example

```javascript
dag.addVertex('task1', { name: 'Fetch Data' }, []);
dag.addVertex('task2', { name: 'Process Data' }, ['task1']);
dag.addVertex('task3', { name: 'Save Results' }, ['task1', 'task2']);
```

### `getVertex(id)`

Retrieves a vertex by its ID.

#### Parameters

- `id` (string): The vertex ID

#### Returns

- `Vertex<T>|undefined`: The vertex or undefined if not found

### `removeVertex(id)`

Removes a vertex and all its associated edges from the DAG.

#### Parameters

- `id` (string): The ID of the vertex to remove

#### Returns

- `Vertex<T>|undefined`: The removed vertex or undefined if not found

### `addEdge(fromId, toId)`

Adds an edge between two vertices, ensuring no cycles are created.

#### Parameters

- `fromId` (string): The source vertex ID
- `toId` (string): The target vertex ID

#### Throws

- `Error`: If the edge would create a cycle or if either vertex doesn't exist

#### Example

```javascript
dag.addVertex('A', { data: 'A' });
dag.addVertex('B', { data: 'B' });
dag.addEdge('A', 'B'); // B depends on A
```

### `removeEdge(fromId, toId)`

Removes an edge between two vertices.

#### Parameters

- `fromId` (string): The source vertex ID
- `toId` (string): The target vertex ID

### `getEdges(id)`

Gets the vertices that the specified vertex depends on (its edges).

#### Parameters

- `id` (string): The vertex ID

#### Returns

- `Vertex<T>[]|undefined`: Array of dependency vertices or undefined if vertex not found

### `topoSort(comparator)`

Performs topological sorting of the DAG vertices.

#### Parameters

- `comparator` (function, optional): Optional comparator for sorting vertices

#### Returns

- `T[]`: Array of vertex payloads in topological order

#### Example

```javascript
const sorted = dag.topoSort((a, b) => b.payload.priority - a.payload.priority);
```

### `isTerminal(id)`

Checks if a vertex is terminal (has no outgoing edges to other vertices).

#### Parameters

- `id` (string): The vertex ID to check

#### Returns

- `boolean`: True if the vertex is terminal, false otherwise

### `getAllEdges()`

Generator that yields all edges in the DAG as [fromId, toId] pairs.

#### Returns

- `Generator<[string, string]>`: Generator of edge pairs

### `clear()`

Removes all vertices from the DAG.

## Vertex Class

The `Vertex` class represents a vertex in the DAG.

### Constructor

```javascript
new Vertex(id, payload, edges)
```

#### Parameters

- `id` (string): Unique identifier for the vertex
- `payload` (T): Data associated with the vertex
- `edges` (string[], default: []): Array of vertex IDs this vertex depends on

### Properties

- `id` (string): Vertex identifier
- `payload` (T): Associated data
- `edges` (Set<string>): Set of dependency vertex IDs

## Complete Example

```javascript
import { DAG } from './src/index.js';

// Create a DAG for task dependencies
const dag = new DAG();

// Add vertices (tasks)
dag.addVertex('fetch-users', { 
    name: 'Fetch Users',
    priority: 1 
}, []);

dag.addVertex('fetch-posts', { 
    name: 'Fetch Posts',
    priority: 1 
}, []);

dag.addVertex('process-data', { 
    name: 'Process Data',
    priority: 2 
}, ['fetch-users', 'fetch-posts']);

dag.addVertex('save-results', { 
    name: 'Save Results',
    priority: 3 
}, ['process-data']);

// Get topological sort (execution order)
const executionOrder = dag.topoSort((a, b) => b.payload.priority - a.payload.priority);
console.log('Execution order:', executionOrder.map(v => v.name));
// Output: ['Save Results', 'Process Data', 'Fetch Users', 'Fetch Posts']

// Check if a vertex is terminal
console.log('save-results is terminal:', dag.isTerminal('save-results')); // true
console.log('fetch-users is terminal:', dag.isTerminal('fetch-users')); // false

// Iterate over all edges
console.log('All dependencies:');
for (const [from, to] of dag.getAllEdges()) {
    console.log(`${from} -> ${to}`);
}
// Output:
// fetch-users -> process-data
// fetch-posts -> process-data
// process-data -> save-results
```

## Cycle Detection

The DAG automatically prevents cycles when adding edges:

```javascript
const dag = new DAG();

dag.addVertex('A', { data: 'A' });
dag.addVertex('B', { data: 'B' });
dag.addVertex('C', { data: 'C' });

// This works fine
dag.addEdge('A', 'B');
dag.addEdge('B', 'C');

// This would create a cycle A -> B -> C -> A, so it throws an error
try {
    dag.addEdge('C', 'A');
} catch (error) {
    console.log('Cycle detected:', error.message);
    // Output: "Invalid edge, would create cycle!"
}
```

## Performance Considerations

- **Caching**: The DAG caches topological sort results and only recalculates when the graph changes
- **Memory Efficient**: Uses Sets for edge storage and Maps for vertex lookup
- **Cycle Detection**: Uses depth-first search for efficient cycle detection

## Use Cases

1. **Task Dependencies**: Managing workflow task dependencies
2. **Build Systems**: Representing build target dependencies
3. **Package Management**: Managing package dependencies
4. **Data Processing**: Organizing data transformation pipelines
5. **Project Planning**: Representing project task dependencies

## Best Practices

1. **Unique IDs**: Ensure all vertex IDs are unique
2. **Meaningful Payloads**: Store relevant data in vertex payloads
3. **Clear Dependencies**: Keep dependency relationships simple and clear
4. **Error Handling**: Handle cycle detection errors appropriately
5. **Performance**: Use comparators for custom sorting when needed
6. **Cleanup**: Remove vertices when no longer needed to free memory
