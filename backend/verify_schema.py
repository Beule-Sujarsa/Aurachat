from app import db, create_app
from sqlalchemy import text

app = create_app()
with app.app_context():
    print("=== Database Schema Verification ===\n")
    
    # Check all tables
    result = db.session.execute(text("SHOW TABLES"))
    tables = [row[0] for row in result]
    print(f"✓ Tables found: {', '.join(tables)}\n")
    
    # Check user table columns
    print("User table structure:")
    result = db.session.execute(text("SHOW COLUMNS FROM user"))
    for row in result:
        col_name = row[0]
        col_type = row[1]
        print(f"  - {col_name}: {col_type}")
    
    # Check if followers table exists
    if 'followers' not in tables:
        print("\n⚠️  WARNING: 'followers' table is missing!")
        print("Creating followers table...")
        try:
            db.session.execute(text("""
                CREATE TABLE IF NOT EXISTS followers (
                    follower_id INT NOT NULL,
                    followed_id INT NOT NULL,
                    PRIMARY KEY (follower_id, followed_id),
                    FOREIGN KEY (follower_id) REFERENCES user(id) ON DELETE CASCADE,
                    FOREIGN KEY (followed_id) REFERENCES user(id) ON DELETE CASCADE,
                    INDEX idx_follower (follower_id),
                    INDEX idx_followed (followed_id)
                ) ENGINE=InnoDB
            """))
            db.session.commit()
            print("✓ Followers table created successfully!")
        except Exception as e:
            print(f"✗ Error creating followers table: {e}")
            db.session.rollback()
    else:
        print("\n✓ Followers table exists")
    
    print("\n=== Verification Complete ===")
