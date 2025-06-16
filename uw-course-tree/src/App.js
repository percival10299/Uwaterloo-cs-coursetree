import React, { useEffect, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
cytoscape.use(dagre);

function getRank(code) {
  // e.g., "CS135" => 100, "CS246" => 200, etc.
  const match = code.match(/\d{3}/);
  if (!match) return 0;
  return Math.floor(Number(match[0]) / 100) * 100;
}



function parseElements(courses) {
  // Only consider CS courses (real and referenced)
  const isCS = code => code.toUpperCase().startsWith("CS");
  const courseCodes = new Set(
    courses.map((c) => c.code.toLowerCase()).filter(isCS)
  );
  const edgeCodes = new Set();
  const edges = [];

  courses.forEach((course) => {
    const thisCode = course.code.toLowerCase();
    if (!isCS(thisCode)) return; // Skip non-CS courses

    // Prerequisites (only CS)
    const prereqCodes =
      (course.prereqs || "").match(/\bCS\d{3}[A-Z]?\b/gi) || [];
    prereqCodes.forEach((prereq) => {
      if (isCS(prereq)) {
        edges.push({
          data: {
            source: prereq.toLowerCase(),
            target: thisCode,
            type: "prereq",
          },
        });
        edgeCodes.add(prereq.toLowerCase());
      }
    });

    // Postrequisites (only CS)
    (course.postrequisites || []).forEach((pr) => {
      const code = pr.postrequisite?.code?.toLowerCase() || "";
      if (isCS(code)) {
        edges.push({
          data: {
            source: thisCode,
            target: code,
            type: "postreq",
          },
        });
        edgeCodes.add(code);
      }
    });
  });

  // Add only CS nodes (real and referenced)
  const allCodes = new Set([...courseCodes, ...edgeCodes]);
  const nodes = Array.from(allCodes)
    .filter(isCS)
    .map((code) => ({
      data: {
        id: code,
        label: code.toUpperCase(),
        rank: getRank(code.toUpperCase()),
      },
      classes: courseCodes.has(code) ? "real" : "phantom",
    }));

  return [...nodes, ...edges];
}


function App() {
  const [elements, setElements] = useState([]);

  useEffect(() => {
    fetch("/courses.json")
      .then(res => res.json())
      .then(realCourseData => {
        function extractCodes(prereqStr) {
          if (!prereqStr) return [];
          return prereqStr.match(/\b[A-Z]{2,4}\d{3}[A-Z]?\b/gi) || [];
        }

        const processedCourses = realCourseData.map(course => ({
          code: (course.code || "").toUpperCase(),
          prereqs: extractCodes(course.prereqs || "").join(" "),
          postrequisites: (course.postrequisites || []).map(pr => ({
            postrequisite: { code: (pr.code || "").toUpperCase() }
          }))
        }));

        setElements(parseElements(processedCourses));
      });
  }, []);



  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <CytoscapeComponent
        key={elements.length} // Ensures remount & layout rerun on reload
        elements={elements}
        style={{ width: "100%", height: "100%" }}
        layout={{
          name: "dagre",
          rankDir: "BT",
          nodeSep: 150,
          rankSep: 200,
          edgeSep: 20,
          marginx: 60,
          marginy: 60,
          animate: true,
          animationDuration: 600,
        }}

        stylesheet={[
          // Real nodes
          {
            selector: "node.real",
            style: {
              label: "data(label)",
              "text-valign": "center",
              "text-halign": "center",
              "background-color": "#61bffc",
              "color": "#222",
              "width": 80,
              "height": 80,
              "font-size": 16,
              "font-weight": "bold",
              "text-outline-width": 2,
              "text-outline-color": "#fff",
              "border-width": 3,
              "border-color": "#0066cc",
              "shape": "round-rectangle",
            },
          },
          // Phantom nodes (referenced but not in your JSON)
          {
            selector: "node.phantom",
            style: {
              label: "data(label)",
              "text-valign": "center",
              "text-halign": "center",
              "background-color": "#ddd",
              "color": "#666",
              "border-style": "dashed",
              "border-width": 2,
              "border-color": "#999",
              "opacity": 0.7,
              "width": 80,
              "height": 80,
              "font-size": 14,
              "shape": "round-rectangle",
            },
          },
          // Prereq edge (blue, solid, arrow)
          {
            selector: "edge[type = 'prereq']",
            style: {
              width: 3,
              "line-color": "#0074d9",
              "target-arrow-color": "#0074d9",
              "target-arrow-shape": "triangle",
              "target-arrow-size": 12,
              "curve-style": "straight",
              "arrow-scale": 1.5,
            },
          },
          // Postreq edge (green, dotted, arrow)
          {
            selector: "edge[type = 'postreq']",
            style: {
              width: 3,
              "line-color": "#28a745",
              "target-arrow-color": "#28a745",
              "target-arrow-shape": "triangle",
              "target-arrow-size": 12,
              "curve-style": "straight",
              "line-style": "dotted",
              "arrow-scale": 1.5,
            },
          },
          // Special styling for root nodes (nodes with no prerequisites)
          {
            selector: "node[indegree = 0].real",
            style: {
              "background-color": "#28a745",
              "border-color": "#1e7e34",
              "color": "#fff",
              "text-outline-color": "#1e7e34",
            },
          },
        ]}

        // Add some interactivity
        userZoomingEnabled={true}
        userPanningEnabled={true}
        boxSelectionEnabled={false}
        autoungrabify={false}
      />

      {/* Enhanced Legend */}
      <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        background: "rgba(255, 255, 255, 0.95)",
        padding: "15px 20px",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontSize: 14,
        zIndex: 10,
        border: "1px solid #e0e0e0",
        minWidth: "200px",
      }}>
        <div style={{ fontWeight: "bold", marginBottom: "10px", fontSize: "16px", color: "#333" }}>
          Course Prerequisites
        </div>

        <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: "4px",
            background: "#28a745",
            marginRight: 10,
            border: "2px solid #1e7e34",
          }} />
          <span>Root Course (CS135)</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: "4px",
            background: "#61bffc",
            marginRight: 10,
            border: "2px solid #0066cc",
          }} />
          <span>Available Course</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
          <div style={{
            width: 20,
            height: 20,
            borderRadius: "4px",
            background: "#ddd",
            marginRight: 10,
            border: "2px dashed #999",
          }} />
          <span>Referenced Course</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
          <div style={{
            width: 30,
            height: 0,
            borderBottom: "3px solid #0074d9",
            marginRight: 10,
            position: "relative",
          }}>
            <div style={{
              position: "absolute",
              right: "-6px",
              top: "-4px",
              width: 0,
              height: 0,
              borderLeft: "6px solid #0074d9",
              borderTop: "4px solid transparent",
              borderBottom: "4px solid transparent",
            }} />
          </div>
          <span>Prerequisite</span>
        </div>

        <div style={{ fontSize: "12px", color: "#666", marginTop: "10px", fontStyle: "italic" }}>
          Root courses appear at the bottom
        </div>
      </div>

      {/* Controls */}
      <div style={{
        position: "absolute",
        top: 20,
        right: 20,
        background: "rgba(255, 255, 255, 0.95)",
        padding: "10px 15px",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        fontSize: 12,
        zIndex: 10,
        color: "#666",
      }}>
        <div>• Drag to pan</div>
        <div>• Scroll to zoom</div>
        <div>• Drag nodes to rearrange</div>
      </div>
    </div>
  );
}

export default App;