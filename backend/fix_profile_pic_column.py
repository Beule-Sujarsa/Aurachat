from app import db, create_app
from sqlalchemy import text

app = create_app()
with app.app_context():
    try:
        # Change profile_pic column to LONGTEXT
        db.session.execute(text("ALTER TABLE user MODIFY COLUMN profile_pic LONGTEXT"))
        db.session.commit()
        print("✓ Successfully changed profile_pic column to LONGTEXT")
        
        # Verify the change
        result = db.session.execute(text("SHOW COLUMNS FROM user WHERE Field='profile_pic'"))
        for row in result:
            print(f"Column: {row[0]}, Type: {row[1]}")
    except Exception as e:
        print(f"Error: {e}")
        db.session.rollback()
