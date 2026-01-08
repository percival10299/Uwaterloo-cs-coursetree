import requests
import json
import time

cs_courses = [
    "cs115", "cs116", "cs135", "cs136", "cs136l",
    "cs145", "cs146", "cs240", "cs240e", 
    "cs241", "cs241e", "cs245", "cs245e", "cs246", "cs246e", "cs251", "cs341", "cs343", "cs346", "cs348", "cs349", "cs350", "cs360", "cs365", "cs370", "cs371",
    "cs442", "cs444", "cs445", "cs446", "cs447", "cs448", "cs449",
    "cs450", "cs451", "cs452", "cs453", "cs454", "cs456", "cs458", "cs459", "cs462", "cs466", "cs467", "cs476", "cs479", "cs480", "cs482", "cs484", "cs485", "cs486", "cs488", "cs489", "cs490", "cs492",
    "cs497", "cs499t"
]

url = "https://uwflow.com/graphql"
headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
query = """
query getCourse($code: String) {
  course(where: {code: {_eq: $code}}) {
    code
    name
    description
    prereqs
    antireqs
    coreqs
    postrequisites {
      postrequisite {
        code
        name
      }
    }
  }
}
"""

def get_course_data(code):
    payload = {
        "operationName": "getCourse",
        "variables": {"code": code},
        "query": query
    }
    r = requests.post(url, json=payload, headers=headers)
    try:
        return r.json()
    except Exception as e:
        print(f"Error for {code}: {e}")
        return {}

all_data = []

for code in cs_courses:
    data = get_course_data(code)
    course_list = data.get("data", {}).get("course", [])
    if course_list and len(course_list) > 0:
        course = course_list[0]
        # Flatten postrequisites for output format
        postreqs = [
            {
                "code": pr["postrequisite"]["code"],
                "name": pr["postrequisite"]["name"]
            }
            for pr in (course.get("postrequisites") or [])
            if pr.get("postrequisite")
        ]
        course_entry = {
            "code": course.get("code"),
            "name": course.get("name"),
            "description": course.get("description"),
            "prereqs": course.get("prereqs"),
            "antireqs": course.get("antireqs"),
            "coreqs": course.get("coreqs"),
            "postrequisites": postreqs
        }
        all_data.append(course_entry)
        print(f"Collected: {code} - {course.get('name')}")
    else:
        print(f"Skipped or not found: {code}")
    time.sleep(0.3)

with open("./uw-course-tree/public/courses.json", "w") as f:
    json.dump(all_data, f, indent=2, ensure_ascii=False)

