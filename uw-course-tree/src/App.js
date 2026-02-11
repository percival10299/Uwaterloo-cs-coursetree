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

// --- Styles ---
const containerStyle = { width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' };
const headerStyle = { padding: '20px', background: '#282c34', color: 'white', display: 'flex', gap: '10px', alignItems: 'center' };
const inputStyle = { padding: '10px', fontSize: '16px', borderRadius: '5px', border: 'none' };
const buttonStyle = { padding: '10px 20px', fontSize: '16px', cursor: 'pointer', background: '#61dafb', border: 'none', borderRadius: '5px' };

// --- Custom Node for Better Visuals ---
const CourseNode = ({ data }) => {
  return (
    <div style={{ padding: '10px', border: '1px solid #777', borderRadius: '5px', background: 'white', width: '150px', textAlign: 'center' }}>
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 'bold' }}>{data.label}</div>
      <div style={{ fontSize: '10px', color: '#555' }}>{data.title}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};
const nodeTypes = { course: CourseNode };

// --- Layout Helper ---
// Maps 1xx -> Column 0, 2xx -> Column 1, etc.
const getYearFromCode = (code) => {
  const match = code.match(/(\d)/); // Find first digit
  return match ? parseInt(match[0]) : 0;
};

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const handleSearch = async () => {
    if (!searchTerm) return;
    
    const data = await resolveCourse(searchTerm);
    if (!data) {
      alert("Course not found!");
      return;
    }

    const newNodes = [];
    const newEdges = [];
    const addedNodeIds = new Set();

    // 1. Central Node (The one you searched)
    const centerYear = getYearFromCode(data.course);
    newNodes.push({
      id: data.course,
      type: 'course',
      data: { label: data.course, title: data.title },
      position: { x: (centerYear - 1) * 300, y: 0 }, // X depends on Year
      style: { background: '#ffeebb', border: '2px solid orange' } // Highlight center
    });
    addedNodeIds.add(data.course);

    // 2. Add Prerequisites (Left Side / Previous Years)
    // Note: The logic tree is complex, for visualization we simplify:
    // We try to extract course codes from the "prerequisites_logic" JSON
    const extractPrereqs = (logic) => {
      let codes = [];
      if (!logic) return codes;
      if (logic.course) codes.push(logic.course); // direct course
      if (Array.isArray(logic)) logic.forEach(l => codes = [...codes, ...extractPrereqs(l)]);
      if (logic.all) codes = [...codes, ...extractPrereqs(logic.all)];
      if (logic.one_of) codes = [...codes, ...extractPrereqs(logic.one_of)];
      return codes;
    };

    const prereqCodes = extractPrereqs(data.prerequisites_logic);
    
    prereqCodes.forEach((code, index) => {
      const cleanCode = code.toUpperCase();
      if (addedNodeIds.has(cleanCode)) return;

      const year = getYearFromCode(cleanCode);
      newNodes.push({
        id: cleanCode,
        type: 'course',
        data: { label: cleanCode, title: 'Prerequisite' },
        position: { x: (year - 1) * 300, y: (index + 1) * 100 }, // Stagger Y
      });
      
      newEdges.push({ id: `e-${cleanCode}-${data.course}`, source: cleanCode, target: data.course, animated: true });
      addedNodeIds.add(cleanCode);
    });

    // 3. Add Post-requisites (Right Side / Future Years)
    if (data.postrequisites) {
      data.postrequisites.forEach((post, index) => {
        const cleanCode = post.code.toUpperCase();
        if (addedNodeIds.has(cleanCode)) return;

        const year = getYearFromCode(cleanCode);
        // If year is same as center, shift it slightly right
        const xPos = year <= centerYear ? (centerYear * 300) + 200 : (year - 1) * 300;

        newNodes.push({
          id: cleanCode,
          type: 'course',
          data: { label: cleanCode, title: post.name },
          position: { x: xPos, y: -(index + 1) * 100 }, // Stack upwards to differentiate
        });

        newEdges.push({ id: `e-${data.course}-${cleanCode}`, source: data.course, target: cleanCode });
        addedNodeIds.add(cleanCode);
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2>UWaterloo Course Tree</h2>
        <input 
          style={inputStyle}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Enter Course (e.g., CS 240)"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button style={buttonStyle} onClick={handleSearch}>Visualize</button>
      </div>
      
      <div style={{ flex: 1, background: '#f0f2f5' }}>
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}