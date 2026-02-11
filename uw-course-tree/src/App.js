import React, { useState, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  applyEdgeChanges, 
  applyNodeChanges,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { resolveCourse } from './api';

// --- Custom Node Component ---
const CourseNode = ({ data }) => {
  return (
    <div style={{ 
      padding: '10px', 
      border: '1px solid #777', 
      borderRadius: '8px', 
      background: data.isCenter ? '#fff3cd' : 'white', 
      width: '180px', 
      textAlign: 'center',
      boxShadow: data.isCenter ? '0 0 10px orange' : 'none'
    }}>
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{data.label}</div>
      <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>{data.title}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};
const nodeTypes = { course: CourseNode };

// --- Layout Logic ---
const getYearFromCode = (code) => {
  const match = code.match(/(\d)/);
  return match ? parseInt(match[0]) : 1;
};

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const handleSearch = async () => {
    if (!searchTerm) return;
    
    // 1. Call the Backend
    const data = await resolveCourse(searchTerm);
    
    if (!data) {
      alert("Course not found! Check backend connection.");
      return;
    }

    const newNodes = [];
    const newEdges = [];
    const addedNodeIds = new Set();
    const centerYear = getYearFromCode(data.course);

    // 2. Create Central Node
    newNodes.push({
      id: data.course,
      type: 'course',
      data: { label: data.course, title: data.title, isCenter: true },
      position: { x: 0, y: 0 },
    });
    addedNodeIds.add(data.course);

    // 3. Helper to process prerequisites logic
    const extractPrereqs = (logic) => {
      let codes = [];
      if (!logic) return codes;
      if (logic.course) codes.push(logic.course); 
      if (Array.isArray(logic)) logic.forEach(l => codes = [...codes, ...extractPrereqs(l)]);
      if (logic.all) codes = [...codes, ...extractPrereqs(logic.all)];
      if (logic.one_of) codes = [...codes, ...extractPrereqs(logic.one_of)];
      return codes;
    };

    // 4. Add Prerequisites (Left Side)
    const prereqCodes = extractPrereqs(data.prerequisites_logic);
    prereqCodes.forEach((code, index) => {
      const cleanCode = code.toUpperCase();
      if (addedNodeIds.has(cleanCode)) return;

      const year = getYearFromCode(cleanCode);
      const yearDiff = centerYear - year;
      // Position left based on year difference
      newNodes.push({
        id: cleanCode,
        type: 'course',
        data: { label: cleanCode, title: 'Prerequisite' },
        position: { x: -250 * (yearDiff || 1), y: (index - prereqCodes.length/2) * 100 },
      });
      
      newEdges.push({ 
        id: `e-${cleanCode}-${data.course}`, 
        source: cleanCode, 
        target: data.course, 
        animated: true,
        style: { stroke: '#888' }
      });
      addedNodeIds.add(cleanCode);
    });

    // 5. Add Post-requisites (Right Side)
    if (data.postrequisites) {
      data.postrequisites.forEach((post, index) => {
        const cleanCode = post.code.toUpperCase();
        if (addedNodeIds.has(cleanCode)) return;

        const year = getYearFromCode(cleanCode);
        const yearDiff = Math.max(1, year - centerYear);

        newNodes.push({
          id: cleanCode,
          type: 'course',
          data: { label: cleanCode, title: post.name },
          position: { x: 250 * yearDiff, y: (index - data.postrequisites.length/2) * 100 },
        });

        newEdges.push({ 
          id: `e-${data.course}-${cleanCode}`, 
          source: data.course, 
          target: cleanCode,
          style: { stroke: '#007bff' }
        });
        addedNodeIds.add(cleanCode);
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', background: '#282c34', color: 'white', display: 'flex', gap: '10px' }}>
        <input 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Enter Course (e.g., CS 240)"
          style={{ padding: '8px', borderRadius: '4px', border: 'none' }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button 
          onClick={handleSearch}
          style={{ padding: '8px 16px', background: '#61dafb', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Visualize
        </button>
      </div>
      
      <div style={{ flex: 1, background: '#f8f9fa' }}>
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#aaa" gap={16} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}