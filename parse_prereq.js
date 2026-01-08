// parse_prereqs.js
// Usage: node parse_prereqs.js
const fs = require("fs");

const INPUT = "uw-course-tree/public/courses.json";
const OUTPUT = "courses_parsed.json";

// ---------------- helpers ----------------
function normalizeCode(code) {
  return code.trim().toLowerCase();
}

function expandSlashAlternatives(token) {
  return token
    .split("/")
    .map(s => s.trim())
    .filter(Boolean)
    .map(normalizeCode);
}

function extractCourseTokens(text) {
  const re = /\b[A-Z]{2,6}\s*\d{2,3}[A-Z]{0,2}\b/g;
  const matches = text.match(re) || [];
  return matches.map(s => s.replace(/\s+/g, ""));
}

function stripOuterParens(s) {
  let t = s.trim();
  while (t.startsWith("(") && t.endsWith(")")) {
    let depth = 0;
    let wraps = true;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (depth === 0 && i < t.length - 1) {
        wraps = false;
        break;
      }
    }
    if (!wraps) break;
    t = t.slice(1, -1).trim();
  }
  return t;
}

function splitTopLevel(s, word /* "or" | "and" */) {
  const parts = [];
  let cur = "";
  let depth = 0;
  const tokens = s.split(/\s+/);

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    for (const ch of tok) {
      if (ch === "(") depth++;
      if (ch === ")") depth = Math.max(0, depth - 1);
    }

    const isSplitter = depth === 0 && tok.toLowerCase() === word;
    if (isSplitter) {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
    } else {
      cur += (cur ? " " : "") + tok;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function splitTopLevelCommas(s) {
  const parts = [];
  let cur = "";
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

// Split off restriction text that begins after ';' OR after a period that
// starts a restrictions sentence like "Honours ...", "BCFM ...", "BSE ...", etc.
function splitMainAndRestrictions(prereqStr) {
  let s = (prereqStr || "").trim();

  // Prefer semicolon if present
  const semi = s.indexOf(";");
  if (semi !== -1) {
    return {
      main: s.slice(0, semi).trim(),
      restrictions: s.slice(semi + 1).trim(),
    };
  }

  // Otherwise split on a period that starts a restrictions clause
  // e.g. "... or CS247. Honours Computer Science, ... students only"
  const re = /\.(\s+)(?=(Honours\b|BCFM\b|BSE\b|Software\b|Computer\b|Mathematics\b|Data\b))/i;
  const m = s.match(re);
  if (m) {
    const idx = s.search(re);
    return {
      main: s.slice(0, idx).trim(),
      restrictions: s.slice(idx + 1).trim(),
    };
  }

  return { main: s, restrictions: "" };
}

function stripNonPrereqStuff(prereqStr) {
  const { main } = splitMainAndRestrictions(prereqStr);
  let s = main.trim();
  s = s.replace(/\.\s*$/, "");
  return s.trim();
}

function extractPrograms(prereqStr) {
  if (!prereqStr || typeof prereqStr !== "string") return [];
  const { restrictions } = splitMainAndRestrictions(prereqStr);
  const text = restrictions.trim();
  if (!text) return [];

  const programs = [];

  // Common UW program restriction phrases in your data
  if (/Honours\s+Mathematics/i.test(text)) programs.push("Honours Mathematics");
  if (/Honours\s+Computer\s+Science/i.test(text)) programs.push("Honours Computer Science");
  if (/Honours\s+Data\s+Science/i.test(text)) programs.push("Honours Data Science");

  // Short program codes that appear in lists
  if (/\bBCFM\b/i.test(text)) programs.push("BCFM");
  if (/\bBSE\b/i.test(text)) programs.push("BSE");

  // You can add more here if your file contains more program labels.

  return [...new Set(programs)];
}

function simplify(node) {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node.all)) {
    node.all = node.all.map(simplify).filter(Boolean);
    if (node.all.length === 0) return null;
    if (node.all.length === 1) {
      const only = node.all[0];
      if (node.programs && only && typeof only === "object") {
        return { ...only, programs: [...new Set([...(only.programs || []), ...node.programs])] };
      }
      return only;
    }
  }

  if (Array.isArray(node.one_of)) {
    node.one_of = node.one_of.map(simplify).filter(Boolean);
    if (node.one_of.length === 0) return null;
    if (node.one_of.length === 1) {
      const only = node.one_of[0];
      if (node.programs && only && typeof only === "object") {
        return { ...only, programs: [...new Set([...(only.programs || []), ...node.programs])] };
      }
      return only;
    }
  }

  return node;
}

// ---------------- leaf parsers ----------------
function parseMinGradeClause(clause) {
  const pMatch =
    clause.match(/at\s+least\s+(\d+)\s*%/i) ||
    clause.match(/grade\s+of\s+(?:at\s+least\s+)?(\d+)\s*%/i) ||
    clause.match(/\b(\d+)\s*%\s*(?:or\s+(?:higher|above))\b/i);

  if (!pMatch) return null;
  const percent = Number(pMatch[1]);

  const inMatch = clause.match(
    /\bin\s+([A-Z]{2,6}\s*\d{2,3}[A-Z]{0,2}(?:\s*\/\s*[A-Z]{2,6}\s*\d{2,3}[A-Z]{0,2})*)\b/i
  );
  if (inMatch) {
    const raw = inMatch[1].replace(/\s+/g, "");
    const expanded = expandSlashAlternatives(raw);
    return { min_grade: { course: expanded[0], percent } };
  }

  const leadCourse = clause.match(/^\s*([A-Z]{2,6}\s*\d{2,3}[A-Z]{0,2})\b/i);
  if (leadCourse && /with\s+a\s+grade/i.test(clause)) {
    return { min_grade: { course: normalizeCode(leadCourse[1].replace(/\s+/g, "")), percent } };
  }

  return null;
}

function parseCourseList(clause) {
  const rawTokens = extractCourseTokens(clause);
  const expanded = [];
  for (const t of rawTokens) expanded.push(...expandSlashAlternatives(t));
  return [...new Set(expanded)];
}

// ---------------- expression parser ----------------
function parseExpr(text) {
  let s = stripOuterParens(text.trim());
  if (!s) return null;

  // Prevent boolean OR from "or higher/above"
  s = s.replace(/\bor\s+(higher|above)\b/gi, " ");

  // 1) OR first
  const orParts = splitTopLevel(s, "or");
  if (orParts.length > 1) {
    return { one_of: orParts.map(p => parseExpr(p)).filter(Boolean) };
  }

  // 2) AND next
  const andParts = splitTopLevel(s, "and");
  if (andParts.length > 1) {
    return { all: andParts.map(p => parseExpr(p)).filter(Boolean) };
  }

  // 3) min_grade on single piece
  const mg = parseMinGradeClause(s);
  if (mg) return mg;

  // 4) "One of ..." (commas become OR options)
  if (/^\s*one\s+of\b/i.test(s)) {
    const rest = s.replace(/^\s*one\s+of\b/i, "").trim();
    const commaParts = splitTopLevelCommas(rest);
    const opts = [];
    for (const p of commaParts) {
      const sub = parseExpr(p);
      if (sub) opts.push(sub);
    }
    return opts.length ? { one_of: opts } : null;
  }

  // 5) Otherwise: courses
  const courses = parseCourseList(s);
  if (courses.length === 0) return null;
  if (courses.length === 1) return { course: courses[0] };

  // ✅ FIX: if the original text contains '/', treat as OR alternatives
  if (s.includes("/")) {
    return { one_of: courses.map(c => ({ course: c })) };
  }

  // multiple courses without explicit AND/OR -> treat as all
  return { all: courses.map(c => ({ course: c })) };
}

// ---------------- top-level prereq parser ----------------
function parsePrereqs(prereqStr) {
  if (!prereqStr || typeof prereqStr !== "string") return null;

  const programs = extractPrograms(prereqStr);
  const main = stripNonPrereqStuff(prereqStr);
  if (!main) return programs.length ? { programs } : null;

  let result;

  if (/^\s*one\s+of\b/i.test(main)) {
    result = simplify(parseExpr(main));
  } else {
    // commas are AND at top-level
    const commaClauses = splitTopLevelCommas(main);
    const all = [];
    for (const c of commaClauses) {
      const node = parseExpr(c);
      if (node) all.push(node);
    }
    result = simplify(all.length ? { all } : null);
  }

  if (result && programs.length) return { ...result, programs };
  if (!result && programs.length) return { programs };
  return result;
}

// ---------------- main ----------------
const raw = fs.readFileSync(INPUT, "utf8");
const courses = JSON.parse(raw);

const out = courses.map(course => {
  const copy = { ...course };
  copy.prereqs = parsePrereqs(course.prereqs);
  return copy;
});

fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2), "utf8");
console.log(`Wrote ${OUTPUT} with parsed prereqs.`);
