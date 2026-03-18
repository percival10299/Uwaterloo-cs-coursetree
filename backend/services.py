from models import Course
from sqlalchemy.orm import Session
from sqlalchemy import func

def build_prereq_tree(db: Session, course_code: str, visited: set = None):
    if visited is None:
        visited = set()
    if course_code in visited:
        return None
    visited.add(course_code)

    # Query using the correct primary key column
    course = db.query(Course).filter(
        func.replace(Course.code, " ", "").ilike(course_code)
    ).first()

    if not course:
        return None

    result = {
        "code": course.code,
        "name": course.name,
        "description": course.description,
        "prerequisites": {}
    }

    # Recursively resolve prereqs from prereqs_json
    if course.prereqs_json:
        for gate, codes in course.prereqs_json.items():  # e.g. {"all_of": ["CS135"], "one_of": [...]}
            resolved = []
            for code in codes:
                child = build_prereq_tree(db, code.replace(" ", "").upper(), visited)
                if child:
                    resolved.append(child)
            if resolved:
                result["prerequisites"][gate] = resolved

    return result