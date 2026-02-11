WITH RECURSIVE chain AS (
  SELECT course_code, prereq_code, 1 AS depth
  FROM prereq_edges
  WHERE course_code = 'cs240'
  UNION ALL
  SELECT c.course_code, p.prereq_code, c.depth + 1
  FROM chain c
  JOIN prereq_edges p ON p.course_code = c.prereq_code
  WHERE c.depth < 6
)
SELECT * FROM chain ORDER BY depth, prereq_code;
