from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./study_system.db"
# Enable multithreading support for SQLite safely
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 1. High-Yield MCQs Mistakes Table
class MCQAttempt(Base):
    __tablename__ = "mcq_attempts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    question_text = Column(String, index=True)
    topic = Column(String, index=True)
    concept = Column(String, index=True, nullable=True)
    source_file = Column(String)
    difficulty = Column(String, default="Medium")
    user_answer = Column(String)
    correct_answer = Column(String)
    is_correct = Column(Boolean)
    timestamp = Column(DateTime, default=datetime.utcnow)

# 2. Spaced Repetition Study Plans
class StudyPlan(Base):
    __tablename__ = "study_plans"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, index=True)
    module_name = Column(String, default="General") 
    subject_name = Column(String, default="General") 
    study_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    reviews = relationship("StudyReview", back_populates="plan", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "module_name": self.module_name,
            "subject_name": self.subject_name,
            "study_date": self.study_date.isoformat() if self.study_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "reviews": [r.to_dict() for r in self.reviews]
        }

# 3. Spaced Repetition Reviews
class StudyReview(Base):
    __tablename__ = "study_reviews"
    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_id = Column(Integer, ForeignKey("study_plans.id"))
    review_number = Column(Integer)
    scheduled_date = Column(DateTime)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    rating = Column(String, nullable=True)
    
    plan = relationship("StudyPlan", back_populates="reviews")

    def to_dict(self):
        return {
            "id": self.id,
            "plan_id": self.plan_id,
            "review_number": self.review_number,
            "scheduled_date": self.scheduled_date.isoformat() if self.scheduled_date else None,
            "is_completed": self.is_completed,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "rating": self.rating
        }

# 4. Advanced Task Management Table
class TaskItem(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String)
    due_date = Column(String, nullable=True)
    priority = Column(String, default="Normal")
    category = Column(String, default="Study")
    is_completed = Column(Boolean, default=False)
    status = Column(String, default="Pending") # Pending, In-Progress, Completed
    duration_ms = Column(Integer, default=0) # For focus timer
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "due_date": self.due_date,
            "priority": self.priority,
            "category": self.category,
            "is_completed": self.is_completed,
            "status": self.status,
            "duration_ms": self.duration_ms
        }

# 5. MedPatient AI Consultation Sessions
class MedPatientSession(Base):
    __tablename__ = "medpatient_sessions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_profile = Column(JSON) # e.g. {"age": 61, "gender": "female", "chief_complaint": "SOB"}
    chat_history = Column(JSON) # Array of message objects
    lab_results = Column(JSON) # Requested labs and their outcomes
    final_diagnosis = Column(String, nullable=True)
    final_treatment = Column(String, nullable=True)
    evaluation_score = Column(Float, nullable=True)
    evaluation_feedback = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "patient_profile": self.patient_profile,
            "chat_history": self.chat_history,
            "lab_results": self.lab_results,
            "final_diagnosis": self.final_diagnosis,
            "final_treatment": self.final_treatment,
            "evaluation_score": self.evaluation_score,
            "evaluation_feedback": self.evaluation_feedback,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# Initialize all tables
Base.metadata.create_all(bind=engine)