from fsrs import FSRS, Card, Rating
from datetime import datetime, timezone
from database import SessionLocal, FSRSCard, Lecture, ReviewEvent

f = FSRS()

def _sync_db_to_fsrs(db_card: FSRSCard) -> Card:
    card = Card()
    card.due = db_card.due.replace(tzinfo=timezone.utc) if db_card.due else datetime.now(timezone.utc)
    card.stability = db_card.stability
    card.difficulty = db_card.difficulty
    card.elapsed_days = db_card.elapsed_days
    card.scheduled_days = db_card.scheduled_days
    card.reps = db_card.reps
    card.lapses = db_card.lapses
    card.state = db_card.state
    if db_card.last_review:
        card.last_review = db_card.last_review.replace(tzinfo=timezone.utc)
    return card

def _sync_fsrs_to_db(card: Card, db_card: FSRSCard):
    db_card.due = card.due.replace(tzinfo=None)
    db_card.stability = card.stability
    db_card.difficulty = card.difficulty
    db_card.elapsed_days = card.elapsed_days
    db_card.scheduled_days = card.scheduled_days
    db_card.reps = card.reps
    db_card.lapses = card.lapses
    db_card.state = card.state
    if card.last_review:
        db_card.last_review = card.last_review.replace(tzinfo=None)

def process_lecture_review(lecture_id: str, rating_val: int, duration_secs: int = 0):
    db = SessionLocal()
    db_card = db.query(FSRSCard).filter(FSRSCard.lecture_id == lecture_id).first()
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    
    if not db_card or not lecture:
        db.close()
        return None
        
    card = _sync_db_to_fsrs(db_card)
    
    # Map strict UI ratings to FSRS: 1=Again, 2=Hard, 3=Good, 4=Easy
    rating_map = {1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy}
    fsrs_rating = rating_map.get(rating_val, Rating.Good)
    
    now = datetime.now(timezone.utc)
    scheduling_info = f.repeat(card, now)
    new_card = scheduling_info[fsrs_rating].card
    
    # Apply to DB
    _sync_fsrs_to_db(new_card, db_card)
    
    # Deterministic Status Update based on FSRS state
    if new_card.state == 0: lecture.status = "New"
    elif new_card.state in [1, 3]: lecture.status = "Learning"
    elif new_card.state == 2:
        lecture.status = "Mature" if new_card.scheduled_days > 21 else "Reviewing"
        
    # Log the strict review event
    event = ReviewEvent(lecture_id=lecture_id, rating=rating_val, duration_secs=duration_secs, created_at=now.replace(tzinfo=None))
    db.add(event)
    
    db.commit()
    next_due = db_card.due
    db.close()
    return next_due