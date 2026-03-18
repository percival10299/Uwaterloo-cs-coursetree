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
  const flattenTree = (node, x = 0, y = 0, level = 0, resultNodes = [], resultEdges = [], visited = new Set()) => {
    if (!node || visited.has(node.code)) return { resultNodes, resultEdges };
    visited.add(node.code);

    resultNodes.push({
      id: node.code,
      data: { label: `${node.code}: ${node.name}` },
      position: { x: x, y: y },
      style: {
        background: level === 0 ? '#ffcc00' : level === 1 ? '#a8d8ea' : '#fff',
        width: 180,
        fontSize: 12,
        borderRadius: 8,
      },
    });

    if (node.prerequisites) {
      const allChildren = [
        ...(node.prerequisites.all_of || []),
        ...(node.prerequisites.one_of || []),
      ];

      allChildren.forEach((child, i) => {
        // ✅ SWAPPED: y grows downward (level), x spreads horizontally
        const nextX = x + (i - (allChildren.length - 1) / 2) * 220;
        const nextY = y + 160;
        const isOneOf = (node.prerequisites.one_of || []).includes(child);

        resultEdges.push({
          id: `e-${child.code}-${node.code}`,
          source: child.code,
          target: node.code,
          animated: true,
          label: isOneOf ? 'OR' : '',
          style: { stroke: isOneOf ? '#f6a623' : '#555' },
        });

        flattenTree(child, nextX, nextY, level + 1, resultNodes, resultEdges, visited);
      });
    }

    return { resultNodes, resultEdges };
  };

  const handleSearch = async () => {
    try {
      // Ensure this points to your new recursive endpoint
      const response = await fetch(`http://127.0.0.1:8000/api/tree/${searchTerm}`);
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