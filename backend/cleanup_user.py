from app import create_app, db
from app.models import User, UserProfile

app = create_app()

with app.app_context():
    # Delete user 'beule'
    user = User.query.filter_by(username='beule').first()
    if user:
        db.session.delete(user)
        db.session.commit()
        print(f"User 'beule' (ID: {user.id}) deleted successfully")
    else:
        print("User 'beule' not found")
