from app import db, create_app
from sqlalchemy import text

app = create_app()
with app.app_context():
    result = db.session.execute(text("SHOW COLUMNS FROM user WHERE Field='profile_pic'"))
    for row in result:
        print(f"Column: {row[0]}, Type: {row[1]}, Null: {row[2]}, Key: {row[3]}, Default: {row[4]}")
