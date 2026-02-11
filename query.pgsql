WITH RECURSIVE course_tree AS (
  SELECT id, code, parent_id, 0 AS depth
  FROM courses
  WHERE parent_id IS NULL

  UNION ALL

  SELECT c.id, c.code, c.parent_id, ct.depth + 1
  FROM courses c
  JOIN course_tree ct ON c.parent_id = ct.id
)
SELECT * FROM course_tree ORDER BY depth;