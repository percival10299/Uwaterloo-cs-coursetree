from sqlalchemy import Column, Integer, String, JSON
from database import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(String)
    prerequisites = Column(JSON)
    postrequisites = Column(JSON)  