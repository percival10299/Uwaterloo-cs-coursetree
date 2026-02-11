import { useEffect, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
cytoscape.use(dagre);

// Register the dagre layout extension once
// cytoscape.use(dagre); // Already done above, but keeping here for context

function getRank(code) {
  // e.g., "CS135" => 100, "CS246" => 200, etc.
  const match = code.match(/\d{3}/);
  if (!match) return 0;
  // Use Math.floor to ensure CS135, CS136, etc. all get rank 100.
  return Math.floor(Number(match[0]) / 100) * 100;
}

/**
 * Parses course data into Cytoscape elements (nodes and edges).
 * @param {Array<Object>} courses - The list of course objects.
 * @returns {Array<Object>} The Cytoscape elements array.
 */
function parseElements(courses) {
  const isCS = (code) => (code || "").toUpperCase().startsWith("CS");
  const courseMap = {};

  // 1. Create a map of real courses for name lookup
  courses.forEach((c) => {
    const code = (c.code || "").toLowerCase();
    if (isCS(code)) {
      courseMap[code] = c;
    }
  });

  const courseCodes = new Set(
    courses.map((c) => (c.code || "").toLowerCase()).filter(isCS)
  );

  const edgeCodes = new Set();
  const edges = [];

  // 2. Build Edges (Prereqs and Postreqs)
  courses.forEach((course) => {
    const thisCode = (course.code || "").toLowerCase();
    if (!isCS(thisCode)) return;

    // Prerequisites (CS only)
    const prereqCodes =
      (course.prereqs || "").match(/\bCS\d{3}[A-Z]?\b/gi) || [];
    prereqCodes.forEach((prereq) => {
      const prereqLower = prereq.toLowerCase();
      if (isCS(prereqLower)) {
        edges.push({
          data: {
            source: prereqLower,
            target: thisCode,
            // The edge direction is prereq -> target, which means target is a postreq of source
            type: "prereq_to_target",
          },
        });
        edgeCodes.add(prereqLower);
      }
    });

    // Postrequisites (CS only) - Use the same logic as prereqs for consistency
    // Although your raw data uses an array for postreqs, the simplified 'prereqs' string logic is safer here
    (course.postrequisites || []).forEach((pr) => {
      const code = pr.postrequisite?.code?.toLowerCase() || "";
      // NOTE: This check is redundant if the above prereq logic is comprehensive, 
      // but kept for robustness based on your original structure.
      if (isCS(code) && !courseCodes.has(code)) {
        edgeCodes.add(code); // Ensure postreqs that aren't in the main list become nodes
      }
    });
  });

  // 3. Build Nodes (Real and Phantom)
  const allCodes = new Set([...courseCodes, ...edgeCodes]);
  const nodes = Array.from(allCodes)
    .filter(isCS)
    .map((code) => {
      const fullCourse = courseMap[code];
      const name = fullCourse ? fullCourse.name : "Referenced Course";

      // Combine code and name for the label, adding a newline
      const label = `${code.toUpperCase()}\n${name}`;

      return {
        data: {
          id: code,
          label: label, // NEW: Includes course name
          rank: getRank(code.toUpperCase()),
          code: code.toUpperCase(), // New property for easier access
          name: name, // New property for easier access
        },
        classes: courseCodes.has(code) ? "real" : "phantom",
      };
    });

  return [...nodes, ...edges];
}

function App() {
  const [elements, setElements] = useState([]);
  const [rawCourses, setRawCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState({
    node: null,
    prereqs: [],
    postreqs: [],
    foundName: null
  });
  const [cyRef, setCyRef] = useState(null);

  useEffect(() => {
    // NOTE: Replace this with the actual URL or path to your JSON data
    fetch("/courses.json")
      .then(res => res.json())
      .then(realCourseData => {
        // Ensure data structure is consistent before parsing
        const processedCourses = realCourseData.map(course => {
          // Helper to extract course codes from a string (e.g., "CS135 and (MATH135 or MATH137)")
          function extractCodes(prereqStr) {
            if (!prereqStr) return [];
            return prereqStr.match(/\b[A-Z]{2,4}\d{3}[A-Z]?\b/gi) || [];
          }

          return {
            code: (course.code || "").toUpperCase(),
            name: course.name,
            // Simplified prereqs string for graph parsing
            prereqs: extractCodes(course.prereqs || "").join(" "),
            // Normalize postrequisites structure
            postrequisites: (course.postrequisites || []).map(pr => ({
              postrequisite: { code: (pr.code || "").toUpperCase() }
            }))
          };
        });

        setRawCourses(processedCourses);
        setElements(parseElements(processedCourses));
      })
      .catch(error => console.error("Error fetching courses:", error));
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    const query = search.trim().toLowerCase();
    if (!query) return setHighlighted({ node: null, prereqs: [], postreqs: [], foundName: null });

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
    const isCS = (s) => (s || "").startsWith("cs");

    // Extracting CS codes from the simplified prereqs string
    const prereqs =
      (found.prereqs?.match(/\bCS\d{3}[A-Z]?\b/gi) || []).map(s => s.toLowerCase());

    // Extracting CS codes from postrequisites array
    const postreqs = (found.postrequisites || [])
      .map(p => (p.postrequisite?.code || "").toLowerCase())
      .filter(isCS);

    const highlightedState = {
      node: code,
      prereqs,
      postreqs,
      foundName: found.name,
      notfound: false
    };

    setHighlighted(highlightedState);

    // CYTOSCAPE ANIMATION & ZOOM
    if (cyRef) {
      const targetNode = cyRef.$id(code);
      if (targetNode.length > 0) {
        targetNode.select();

        // Find all elements to fit: the node, its prereqs, and its postreqs
        const elesToFit = targetNode.union(
          cyRef.$id(prereqs.concat(postreqs).join(","))
        );

        // Use a wide padding to ensure the full context is visible
        cyRef.animate({
          fit: {
            eles: elesToFit,
            padding: 400 // Reduced from 420 for better focus
          }
        }, { duration: 600 });
      }
    }
  }

  // --- Map elements for highlighting ---
  const displayedElements = elements.map(el => {
    if (!el.data) {
      // Edge styling
      const source = el.data.source;
      const target = el.data.target;
      let classes = el.classes || "";

      // Highlight edges connected to the highlighted nodes
      if (highlighted.node) {
        if (
          (source === highlighted.node && highlighted.postreqs.includes(target)) ||
          (target === highlighted.node && highlighted.prereqs.includes(source))
        ) {
          classes += " active-edge";
        }
      }
      return { ...el, classes };
    }

    // Node styling
    const code = el.data.id;
    let classes = el.classes || "";

    if (highlighted.node) {
      if (code === highlighted.node) {
        classes += " highlighted-node main-node";
      } else if (highlighted.prereqs?.includes(code)) {
        classes += " highlighted-node prereq-node";
      } else if (highlighted.postreqs?.includes(code)) {
        classes += " highlighted-node postreq-node";
      }
    }
    return { ...el, classes };
  });

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", backgroundColor: "#f9f9f9" }}>

      {/* SEARCH BAR & FEEDBACK */}
      <form
        onSubmit={handleSearch}
        style={{
          position: "absolute",
          top: 15,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          background: "#fff",
          padding: 15,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minWidth: 400,
        }}
      >
        <div style={{ display: "flex", width: "100%", justifyContent: "center", marginBottom: 10 }}>
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              if (highlighted.node) setHighlighted({}); // Clear highlight on new input
            }}
            placeholder="Search by CS code (e.g., cs246) or name…"
            style={{
              flexGrow: 1,
              fontSize: 16,
              padding: "10px 12px",
              borderRadius: 6,
              border: "1px solid #ccc",
              marginRight: 10,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              borderRadius: 6,
              border: "none",
              background: "#1e90ff",
              color: "white",
              fontWeight: "bold",
              fontSize: 16,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            Find Course
          </button>
        </div>

        {/* Search Feedback Area */}
        {highlighted.notfound && (
          <span style={{ color: "#e74c3c", marginTop: 5, fontWeight: "bold" }}>
            Course "{search.trim().toUpperCase()}" not found.
          </span>
        )}

        {highlighted.node && (
          <div style={{
            marginTop: 10,
            padding: "8px 12px",
            border: "1px solid #bbd",
            borderRadius: 6,
            backgroundColor: "#eef",
            width: "100%",
            textAlign: "center"
          }}>
            <strong style={{ display: "block", marginBottom: 4, color: "#1e90ff" }}>
              Dependencies for {highlighted.node.toUpperCase()} - {highlighted.foundName}:
            </strong>
            <p style={{ margin: 0, fontSize: 14 }}>
              <span style={{ color: "#27ae60" }}>Prerequisites:</span> {highlighted.prereqs.length > 0 ? highlighted.prereqs.map(c => c.toUpperCase()).join(", ") : "None displayed"}
              <br />
              <span style={{ color: "#f39c12" }}>Leads To:</span> {highlighted.postreqs.length > 0 ? highlighted.postreqs.map(c => c.toUpperCase()).join(", ") : "None displayed"}
            </p>
          </div>
        )}
      </form>

      {/* CYTOSCAPE */}
      {/* Use a fixed key to prevent re-initialization unless elements change */}
      <CytoscapeComponent
        key={elements.length > 0 ? "elements-loaded" : "loading"}
        cy={setCyRef}
        elements={displayedElements}
        style={{ width: "100%", height: "100%" }}
        // DAGRE LAYOUT CONFIGURATION
        layout={{
          name: "dagre",
          rankDir: "BT", // Bottom to Top (prereqs at the bottom)
          nodeSep: 100, // Reduced from 150
          rankSep: 100, // Reduced from 200 for better fit
          edgeSep: 20,
          marginx: 40,
          marginy: 40,
          animate: true,
          animationDuration: 500,
          // ranker: "tight-tree", // Optional: use this for a more compact vertical layout
        }}
        // VISUAL STYLESHEET
        stylesheet={[
          // General Node Style
          {
            selector: "node",
            style: {
              label: "data(label)",
              "text-valign": "center",
              "text-halign": "center",
              "color": "#333",
              "width": 150,
              "height": 90,
              "font-size": 12,
              "font-weight": "normal",
              "text-wrap": "wrap",       // Enable text wrapping
              "text-max-width": 140,     // Max width for the wrapped text
              "text-outline-width": 1,
              "text-outline-color": "#fff",
              "border-width": 2,
              "shape": "round-rectangle",
              "line-height": 1.2,
              "transition-property": "background-color, border-color, width, height",
              "transition-duration": "0.4s",
            },
          },
          // Real Courses (CS courses in the dataset)
          {
            selector: "node.real",
            style: {
              "background-color": "#e0f7fa", // Light Cyan
              "border-color": "#00bcd4",     // Cyan
            },
          },
          // Phantom Courses (Referenced CS courses not in the dataset)
          {
            selector: "node.phantom",
            style: {
              "background-color": "#f8f9fa", // Light Grey
              "border-color": "#adb5bd",     // Grey
              "border-style": "dashed",
              "opacity": 0.8,
              "color": "#6c757d",
            },
          },
          // General Edge Style
          {
            selector: "edge",
            style: {
              "curve-style": "bezier",
              "target-arrow-shape": "triangle",
              "line-color": "#ccc",
              "target-arrow-color": "#ccc",
              "width": 2,
              "transition-property": "line-color, target-arrow-color, width",
              "transition-duration": "0.4s",
            },
          },
          // HIGHLIGHT STYLES
          {
            selector: "node.highlighted-node",
            style: {
              "border-width": 4,
              "text-outline-color": "#fff",   // use white outline so text doesn't look visually heavier
              "width": 160,
              "height": 100,
              "font-weight": "bold"
            }
          },
          // Main Searched Node
          {
            selector: "node.main-node",
            style: {
              "background-color": "#1e90ff",
              "border-color": "#0056b3",
              "color": "white",
              "font-weight": "bold",
              "text-outline-width": 0,      // <-- Now only the main node has the heavy outline
              "text-outline-color": "#fff"
            },
          },
          // Prerequisite Nodes
          {
            selector: "node.prereq-node",
            style: {
              "background-color": "#2ecc71", // Emerald Green
              "border-color": "#27ae60",
              "color": "white",
              "font-weight": "bold",
              "text-outline-width": 0,      // <-- Now only the main node has the heavy outline
              "text-outline-color": "#fff"
            },
          },
          // Postrequisite Nodes
          {
            selector: "node.postreq-node",
            style: {
              "background-color": "#f1c40f", // Sunflower Yellow
              "border-color": "#f39c12",
              "color": "#333",
              "font-weight": "normal"
            },
          },
          // Active Edges
          {
            selector: "edge.active-edge",
            style: {
              "line-color": "#d35400", // Darker Orange
              "target-arrow-color": "#d35400",
              "width": 4,
            },
          },

        ]}
        userZoomingEnabled={true}
        userPanningEnabled={true}
        boxSelectionEnabled={false}
        autoungrabify={false}
      />

      {/* LEGEND/HELP TEXT */}
      <div style={{
        position: "absolute",
        bottom: 10,
        right: 10,
        zIndex: 20,
        background: "rgba(255,255,255,0.9)",
        padding: 10,
        borderRadius: 8,
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        fontSize: 12
      }}>
        <p style={{ margin: 0, fontWeight: "bold" }}>Course Dependency Graph Legend:</p>
        <ul style={{ listStyleType: "square", paddingLeft: 20, margin: "5px 0 0 0" }}>
          <li style={{ color: "#00bcd4" }}>Course Node (Real)</li>
          <li style={{ color: "#adb5bd" }}>Course Node (Referenced/Phantom)</li>
          <li style={{ color: "#1e90ff", fontWeight: "bold" }}>Searched Course</li>
          <li style={{ color: "#2ecc71" }}>Prerequisite Course</li>
          <li style={{ color: "#f1c40f" }}>Postrequisite Course</li>
        </ul>
      </div>

    </div>
  );
}

export default App;