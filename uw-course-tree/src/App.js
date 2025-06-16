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
  const isCS = (code) => (code || "").toUpperCase().startsWith("CS");
  // Map code to full course object for lookup
  const courseMap = {};
  courses.forEach((c) => {
    if (isCS(c.code)) {
      courseMap[(c.code || "").toLowerCase()] = c;
    }
  });

  const courseCodes = new Set(
    courses.map((c) => (c.code || "").toLowerCase()).filter(isCS)
  );
  const edgeCodes = new Set();
  const edges = [];

  courses.forEach((course) => {
    const thisCode = (course.code || "").toLowerCase();
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
      label: code.toUpperCase(), // This line: only code, no name!
      rank: getRank(code.toUpperCase()),
    },
    classes: courseCodes.has(code) ? "real" : "phantom",
  }));

  return [...nodes, ...edges];
}



function App() {
  const [elements, setElements] = useState([]);
  const [rawCourses, setRawCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState({});
  const [cyRef, setCyRef] = useState(null);

  useEffect(() => {
    fetch("/courses.json")
      .then(res => res.json())
      .then(realCourseData => {
        setRawCourses(realCourseData);
        function extractCodes(prereqStr) {
          if (!prereqStr) return [];
          return prereqStr.match(/\b[A-Z]{2,4}\d{3}[A-Z]?\b/gi) || [];
        }
        const processedCourses = realCourseData.map(course => ({
          code: (course.code || "").toUpperCase(),
          name: course.name,
          prereqs: extractCodes(course.prereqs || "").join(" "),
          postrequisites: (course.postrequisites || []).map(pr => ({
            postrequisite: { code: (pr.code || "").toUpperCase() }
          }))
        }));
        setElements(parseElements(processedCourses));
      });
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (!search.trim()) return setHighlighted({});
    const query = search.trim().toLowerCase();
    const found = rawCourses.find(
      c =>
        (c.code || "").toLowerCase() === query ||
        (c.name || "").toLowerCase().includes(query)
    );
    if (!found) {
      setHighlighted({ notfound: true });
      return;
    }
    const code = (found.code || "").toLowerCase();
    const prereqs =
      (found.prereqs?.match(/\bCS\d{3}[A-Z]?\b/gi) || []).map(s => s.toLowerCase());
    const postreqs = (found.postrequisites || [])
      .map(p => (p.code || "").toLowerCase())
      .filter(s => s.startsWith("cs"));
    setHighlighted({ node: code, prereqs, postreqs });
    if (cyRef && cyRef.$id(code)) {
      cyRef.$id(code).select();
      // Increase padding for a wider view:
      cyRef.animate({
        fit: { 
          eles: cyRef.$id(code).union(cyRef.$id(prereqs.concat(postreqs))), 
          padding: 420 // <-- was 40, now 120
        }
      }, { duration: 500 });
    }
  }
  

  const displayedElements = elements.map(el => {
    if (!el.data) return el;
    const code = el.data.id;
    let classes = el.classes || "";
    if (
      highlighted.node &&
      (code === highlighted.node ||
        highlighted.prereqs?.includes(code) ||
        highlighted.postreqs?.includes(code))
    ) {
      classes += " highlighted";
    }
    return { ...el, classes };
  });

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* SEARCH BAR */}
      <form onSubmit={handleSearch} style={{
        position: "absolute",
        top: 10,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        background: "rgba(255,255,255,0.95)",
        padding: 8,
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        display: "flex",
        alignItems: "center",
        minWidth: 340,
      }}>
        {highlighted.node && (
  <div style={{
    position: "absolute",
    top: 54, // slightly below search bar
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 20,
    background: "rgba(255,255,255,0.98)",
    padding: 8,
    borderRadius: 8,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    fontSize: 15,
    minWidth: 340,
    textAlign: "center"
  }}>
    <strong>
      {search.trim().toUpperCase()} leads to:{" "}
    </strong>
    {highlighted.postreqs && highlighted.postreqs.length > 0 ? (
      highlighted.postreqs.map(code => (
        <span key={code} style={{margin: "0 6px", fontWeight: "bold"}}>{code.toUpperCase()}</span>
      ))
    ) : (
      <span>No CS postrequisites</span>
    )}
  </div>
)}
        <input
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setHighlighted({});
          }}
          placeholder="Search by CS code or name…"
          style={{
            width: 220,
            fontSize: 16,
            padding: 6,
            borderRadius: 4,
            border: "1px solid #bbb",
            marginRight: 8,
          }}
        />
        <button
          type="submit"
          style={{
            padding: "6px 20px",
            borderRadius: 4,
            border: "none",
            background: "#61bffc",
            color: "#222",
            fontWeight: "bold",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Search
        </button>
        {highlighted.notfound && (
          <span style={{ marginLeft: 12, color: "#f44336" }}>
            Not found
          </span>
        )}
      </form>

      {/* CYTOSCAPE */}
      <CytoscapeComponent
        key={displayedElements.length}
        cy={cy => setCyRef(cy)}
        elements={displayedElements}
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
          // ...your existing styles...
          // Add highlighted node style:
          {
            selector: "node.real",
  style: {
    label: "data(label)",
              "text-valign": "center",
              "text-halign": "center",
              "background-color": "#61bffc",
              "color": "#222",
              "width": 140,                // wider to fit name
              "height": 80,
              "font-size": 13,             // slightly smaller
              "font-weight": "bold",
              "text-outline-width": 2,
              "text-outline-color": "#fff",
              "border-width": 3,
              "border-color": "#0066cc",
              "shape": "round-rectangle",
              "white-space": "pre-line",   // <--- enables \n in label
              "line-height": 1.2,          // better line spacing
            },
          },
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
              "width": 140,
              "height": 80,
              "font-size": 13,
              "shape": "round-rectangle",
              "white-space": "pre-line",   // <--- enables \n in label
              "line-height": 1.2,
            },
          },
          
        ]}
        userZoomingEnabled={true}
        userPanningEnabled={true}
        boxSelectionEnabled={false}
        autoungrabify={false}
      />

      {/* ... (rest of your controls/legend as before) ... */}
    </div>
  );
}

export default App;