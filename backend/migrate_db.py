#!/usr/bin/env python3
"""
Database migration script for AuraChat.
Run this script to perform database migrations.
"""

import os
import sys

# Add the parent directory to Python path to import our app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import User
from sqlalchemy import text

def update_schema():
    """Update database schema with any new columns"""
    app = create_app()
    
    with app.app_context():
        print("Checking database schema...")
        
        try:
            # Check if we need to add new columns to user table
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('user')]
            
            # Add any missing columns
            if 'bio' not in columns:
                print("Adding bio column...")
                db.session.execute(text('ALTER TABLE user ADD COLUMN bio TEXT'))
                db.session.commit()
            
            if 'profile_pic' not in columns:
                print("Adding profile_pic column as LONGTEXT...")
                db.session.execute(text("ALTER TABLE user ADD COLUMN profile_pic LONGTEXT DEFAULT 'default.jpg'"))
                db.session.commit()
            else:
                # Ensure profile_pic column can hold large base64/data URIs
                try:
                    print("Ensuring profile_pic column is LONGTEXT to store large data...")
                    db.session.execute(text("ALTER TABLE user MODIFY COLUMN profile_pic LONGTEXT"))
                    db.session.commit()
                except Exception as e:
                    print(f"Note: {e}")
                    # If MODIFY fails, continue — column may already be LONGTEXT or DB may not support modify
                    pass
            
            if 'is_private' not in columns:
                print("Adding is_private column...")
                db.session.execute(text('ALTER TABLE user ADD COLUMN is_private BOOLEAN DEFAULT FALSE'))
                db.session.commit()
            
            if 'theme' not in columns:
                print("Adding theme column...")
                db.session.execute(text("ALTER TABLE user ADD COLUMN theme VARCHAR(20) DEFAULT 'light'"))
                db.session.commit()
                
            print("Database schema updated successfully!")
            
        except Exception as e:
            print(f"Error updating schema: {e}")
            db.session.rollback()
            return False
        
        print("Migration completed successfully!")
        return True

def recreate_tables():
    """Recreate all tables with the new schema"""
    app = create_app()
    
    with app.app_context():
        print("Recreating database tables...")
        
        # Drop all tables and recreate them
        db.drop_all()
        db.create_all()
        
        print("Database tables recreated successfully!")
        return True

if __name__ == '__main__':
    print("AuraChat Database Migration")
    print("=" * 40)
    
    choice = input("Choose migration option:\n1. Update schema (add new columns)\n2. Recreate all tables\nEnter choice (1 or 2): ")
    
    if choice == '1':
        if update_schema():
            print("\n✅ Migration completed successfully!")
        else:
            print("\n❌ Migration failed!")
    elif choice == '2':
        confirm = input("⚠️  This will delete all existing data! Are you sure? (yes/no): ")
        if confirm.lower() == 'yes':
            if recreate_tables():
                print("\n✅ Database recreated successfully!")
            else:
                print("\n❌ Database recreation failed!")
        else:
            print("Operation cancelled.")
    else:
        print("Invalid choice!")