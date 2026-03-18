import React, { useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, applyEdgeChanges, applyNodeChanges } from 'reactflow';
import 'reactflow/dist/style.css';

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  // --- The Recursive Flattener ---
  // This function turns nested JSON into React Flow Nodes/Edges
  const flattenTree = (node, x = 0, y = 0, level = 0, resultNodes = [], resultEdges = []) => {
    if (!node) return { resultNodes, resultEdges };

    const nodeId = node.code;
    
    // 1. Add current course as a node
    resultNodes.push({
      id: nodeId,
      data: { label: `${node.code}: ${node.name}` },
      position: { x: x, y: y },
      style: { background: level === 0 ? '#ffcc00' : '#fff', width: 150 },
    });

    // 2. If it has prerequisites, recurse through them
    if (node.prerequisites) {
      Object.entries(node.prerequisites).forEach(([gate, items], gateIndex) => {
        items.forEach((child, childIndex) => {
          // Calculate position: Move LEFT (negative x) for prerequisites
          // Spread them out vertically (y)
          const nextX = x - 250;
          const nextY = y + (childIndex - (items.length - 1) / 2) * 150;

          // Add an edge from the prerequisite (child) to the current course (node)
          resultEdges.push({
            id: `e-${child.code}-${nodeId}`,
            source: child.code,
            target: nodeId,
            animated: true,
            label: gate === 'one_of' ? 'OR' : ''
          });

          flattenTree(child, nextX, nextY, level + 1, resultNodes, resultEdges);
        });
      });
    }

    return { resultNodes, resultEdges };
  };

  const handleSearch = async () => {
    try {
      // Ensure this points to your new recursive endpoint
      const response = await fetch(`http://localhost:8000/api/tree/${searchTerm}`);
      if (!response.ok) throw new Error('Course not found');
      
      const treeData = await response.json();

      // Clear old data and flatten the new recursive response
      const { resultNodes, resultEdges } = flattenTree(treeData);
      
      setNodes(resultNodes);
      setEdges(resultEdges);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Simple Search Bar */}
      <div style={{ padding: '20px', background: '#23272f', display: 'flex', gap: '10px' }}>
        <input 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
          placeholder="Enter Course (e.g. CS240)"
          style={{ padding: '10px', width: '250px' }}
        />
        <button onClick={handleSearch} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Build Tree
        </button>
      </div>

      {/* The Visual Tree */}
      <div style={{ flex: 1 }}>
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}