from models import Course
from sqlalchemy.orm import Session
from sqlalchemy import func

def extract_courses_from_node(node) -> list:
    """
    Recursively flattens the nested prereq JSON structure into a list of
    (course_code, gate_type) tuples.
    
    Handles structures like:
    {"course": "cs245"}                    -> leaf node
    {"one_of": [...]}                      -> OR gate
    {"all": [...]}                         -> AND gate (treated as one_of at top level)
    """
    results = []  # list of {"code": str, "gate": str}

    if isinstance(node, dict):
        if "course" in node:
            # Leaf node - actual course reference
            results.append(node["course"].replace(" ", "").lower())
        else:
            # Gate node - recurse into its children
            for gate_key in ["all", "one_of"]:
                if gate_key in node:
                    for child in node[gate_key]:
                        results.extend(extract_courses_from_node(child))

    elif isinstance(node, list):
        for item in node:
            results.extend(extract_courses_from_node(item))

    return results


def build_prereq_tree(db: Session, course_code: str, visited: set = None):
    if visited is None:
        visited = set()

    clean_code = course_code.replace(" ", "").lower()

    if clean_code in visited:
        return None
    visited.add(clean_code)

    course = db.query(Course).filter(
        func.lower(Course.code) == clean_code
    ).first()

    if not course:
        return None

    result = {
        "code": course.code,
        "name": course.name,
        "description": course.description,
        "prerequisites": {}
    }

    if course.prereqs_json and "all" in course.prereqs_json:
        all_prereq_codes = []
        one_of_groups = []

        for item in course.prereqs_json["all"]:
            if "one_of" in item:
                # This is an OR group - pick the first resolvable course
                group_codes = extract_courses_from_node(item)
                one_of_groups.append(group_codes)
                # Add all options so the tree shows them
                for code in group_codes:
                    child = build_prereq_tree(db, code, visited)
                    if child:
                        result["prerequisites"].setdefault("one_of", []).append(child)
            elif "course" in item:
                # Direct required course
                child = build_prereq_tree(db, item["course"], visited)
                if child:
                    result["prerequisites"].setdefault("all_of", []).append(child)

    return result