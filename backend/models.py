from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from database import Base

class Course(Base):
    __tablename__ = "courses"
    code        = Column(String, primary_key=True)
    name        = Column(Text)
    description = Column(Text)
    prereqs_json = Column(JSONB)        # was wrongly named "prerequisites"
    coreqs      = Column(Text)
    antireqs    = Column(Text)

class CourseEdge(Base):
    __tablename__ = "course_edges"
    from_code = Column(String, primary_key=True)
    to_code   = Column(String, primary_key=True)
    kind      = Column(String)

class PrereqEdge(Base):
    __tablename__ = "prereq_edges"
    course_code = Column(String, primary_key=True)
    prereq_code = Column(String, primary_key=True)
    relation    = Column(String)