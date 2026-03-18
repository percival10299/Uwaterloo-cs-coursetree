from sqlalchemy.orm import Session
from sqlalchemy import func
import models

def build_prereq_tree(db: Session, course_code: str, memo: dict = None):
    """
    Recursive Depth-First Search (DFS) to build a prerequisite tree.
    Uses Memoization to prevent redundant database hits (N+1 problem).
    """
    if memo is None:
        memo = {}

    # 1. Memoization Check: Have we seen this course in this request before?
    if course_code in memo:
        return memo[course_code]

    # 2. Database Lookup: Normalize on-the-fly to ensure match
    course = db.query(models.Course).filter(
        func.replace(models.Course.code, " ", "").ilike(course_code)
    ).first()

    if not course:
        return None

    # 3. Base Case: If there are no prerequisites, it's a leaf node.
    if not course.prerequisites:
        leaf = {
            "code": course.code,
            "name": course.name,
            "prerequisites": None
        }
        memo[course_code] = leaf
        return leaf

    # 4. Recursive Step: Resolve the JSON logic
    # We assume the structure is {"all": ["CS136", "MATH135"]} or similar
    resolved_prereqs = {}
    
    for logic_gate, items in course.prerequisites.items():
        resolved_list = []
        for item in items:
            # If the item is a course string, recurse!
            if isinstance(item, str):
                child_node = build_prereq_tree(db, item.replace(" ", "").upper(), memo)
                if child_node:
                    resolved_list.append(child_node)
            
            # If the item is a nested logic dict (e.g. {"one_of": [...]})
            elif isinstance(item, dict):
                # Handle nested logic if necessary
                pass 
                
        resolved_prereqs[logic_gate] = resolved_list

    # 5. Build and Cache the Node
    node = {
        "code": course.code,
        "name": course.name,
        "description": course.description,
        "prerequisites": resolved_prereqs
    }
    
    memo[course_code] = node
    return node