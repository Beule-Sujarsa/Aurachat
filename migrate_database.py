"""
Database Migration Script for AuraChat Social Media Platform
This script creates the new social media database schema based on the provided SQL structure.
"""

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os
import sys
import mysql.connector

# Global variable to store MySQL configuration
mysql_config = {}

def create_database_connection():
    """Create a connection to MySQL to create the database if it doesn't exist"""
    import getpass
    
    print("🔐 MySQL Connection Setup")
    print("Enter your MySQL credentials:")
    
    host = input("MySQL Host (default: localhost): ").strip() or 'localhost'
    username = input("MySQL Username (default: root): ").strip() or 'root'
    password = getpass.getpass("MySQL Password: ")
    
    try:
        connection = mysql.connector.connect(
            host=host,
            user=username,
            password=password
        )
        print("✅ MySQL connection successful!")
        
        # Store credentials for Flask app
        global mysql_config
        mysql_config = {
            'host': host,
            'username': username,
            'password': password
        }
        
        return connection
    except mysql.connector.Error as err:
        print(f"❌ Error connecting to MySQL: {err}")
        return None

def create_database_if_not_exists():
    """Create the socialmedia_db database if it doesn't exist"""
    connection = create_database_connection()
    if not connection:
        return False
    
    try:
        cursor = connection.cursor()
        cursor.execute("CREATE DATABASE IF NOT EXISTS socialmedia_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        print("✅ Database 'socialmedia_db' created successfully or already exists")
        connection.commit()
        cursor.close()
        connection.close()
        return True
    except mysql.connector.Error as err:
        print(f"❌ Error creating database: {err}")
        connection.close()
        return False

def setup_flask_app():
    """Setup Flask app with database configuration"""
    app = Flask(__name__)
    
    # Database configuration using stored credentials
    db_uri = f'mysql+pymysql://{mysql_config["username"]}:{mysql_config["password"]}@{mysql_config["host"]}/socialmedia_db'
    app.config['SQLALCHEMY_DATABASE_URI'] = db_uri
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    return app

def run_migration():
    """Run the database migration"""
    print("🚀 Starting AuraChat Social Media Database Migration...")
    
    # Step 1: Create database if not exists
    if not create_database_if_not_exists():
        print("❌ Failed to create database. Please check your MySQL configuration.")
        return False
    
    # Step 2: Setup Flask app and SQLAlchemy
    app = setup_flask_app()
    db = SQLAlchemy(app)
    
    # Step 3: Define models (matching the new schema)
    class User(db.Model):
        __tablename__ = 'user'
        
        id = db.Column(db.Integer, primary_key=True)
        username = db.Column(db.String(255), unique=True, nullable=False)
        email = db.Column(db.String(255), unique=True, nullable=False)
        password_hash = db.Column(db.String(255), nullable=False)
        profile_pic = db.Column(db.String(255), default='default.jpg')
        bio = db.Column(db.Text)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)
        
        # Relationships
        posts = db.relationship('Post', backref='author', lazy='dynamic', cascade='all, delete-orphan')
        likes = db.relationship('Like', backref='user', lazy='dynamic', cascade='all, delete-orphan')
        comments = db.relationship('Comment', backref='author', lazy='dynamic', cascade='all, delete-orphan')
        
        # Following relationships
        following = db.relationship(
            'Follow', 
            foreign_keys='Follow.follower_id',
            backref='follower', 
            lazy='dynamic',
            cascade='all, delete-orphan'
        )
        followers = db.relationship(
            'Follow', 
            foreign_keys='Follow.following_id',
            backref='followed', 
            lazy='dynamic',
            cascade='all, delete-orphan'
        )

    class Post(db.Model):
        __tablename__ = 'post'
        
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
        content = db.Column(db.Text, nullable=False)
        image_url = db.Column(db.String(255))
        created_at = db.Column(db.DateTime, default=datetime.utcnow)
        
        # Relationships
        likes = db.relationship('Like', backref='post', lazy='dynamic', cascade='all, delete-orphan')
        comments = db.relationship('Comment', backref='post', lazy='dynamic', cascade='all, delete-orphan')
        
        @property
        def likes_count(self):
            return self.likes.count()
            
        @property
        def comments_count(self):
            return self.comments.count()

    class Like(db.Model):
        __tablename__ = 'like'
        
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
        post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)
        
        # Unique constraint to prevent duplicate likes
        __table_args__ = (db.UniqueConstraint('user_id', 'post_id'),)

    class Comment(db.Model):
        __tablename__ = 'comment'
        
        id = db.Column(db.Integer, primary_key=True)
        user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
        post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
        content = db.Column(db.Text, nullable=False)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)

    class Follow(db.Model):
        __tablename__ = 'follow'
        
        id = db.Column(db.Integer, primary_key=True)
        follower_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
        following_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
        created_at = db.Column(db.DateTime, default=datetime.utcnow)
        
        # Unique constraint and check constraint
        __table_args__ = (
            db.UniqueConstraint('follower_id', 'following_id'),
            db.CheckConstraint('follower_id != following_id', name='check_no_self_follow')
        )
    
    # Step 4: Create tables
    with app.app_context():
        try:
            print("📊 Creating database tables...")
            db.create_all()
            print("✅ All tables created successfully!")
            
            # Step 5: Add some sample data (optional)
            print("📝 Adding sample data...")
            
            # Check if tables are empty before adding sample data
            if User.query.first() is None:
                # Create sample users
                sample_users = [
                    User(
                        username='john_doe',
                        email='john@example.com',
                        password_hash='hashed_password_1',
                        bio='Love coding and social media!'
                    ),
                    User(
                        username='jane_smith',
                        email='jane@example.com',
                        password_hash='hashed_password_2',
                        bio='Designer and tech enthusiast'
                    ),
                    User(
                        username='mike_wilson',
                        email='mike@example.com',
                        password_hash='hashed_password_3',
                        bio='Full-stack developer'
                    )
                ]
                
                for user in sample_users:
                    db.session.add(user)
                
                db.session.commit()
                print("✅ Sample users created!")
                
                # Create sample posts
                users = User.query.all()
                sample_posts = [
                    Post(
                        user_id=users[0].id,
                        content="Welcome to AuraChat! Excited to be here and connect with everyone."
                    ),
                    Post(
                        user_id=users[1].id,
                        content="Just finished working on a new design project. Love the creative process!"
                    ),
                    Post(
                        user_id=users[2].id,
                        content="Building amazing web applications with Flask and React. #coding"
                    )
                ]
                
                for post in sample_posts:
                    db.session.add(post)
                
                db.session.commit()
                print("✅ Sample posts created!")
                
                # Create some sample follows
                follow1 = Follow(follower_id=users[0].id, following_id=users[1].id)
                follow2 = Follow(follower_id=users[0].id, following_id=users[2].id)
                follow3 = Follow(follower_id=users[1].id, following_id=users[2].id)
                
                db.session.add_all([follow1, follow2, follow3])
                db.session.commit()
                print("✅ Sample follows created!")
            else:
                print("ℹ️  Database already contains data, skipping sample data creation.")
            
            print("\n🎉 Migration completed successfully!")
            print("📍 Database: socialmedia_db")
            print("🏗️  Tables created:")
            print("   - user")
            print("   - post") 
            print("   - like")
            print("   - comment")
            print("   - follow")
            print("\n✨ Your AuraChat social media platform is ready!")
            return True
            
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            return False

def check_prerequisites():
    """Check if all prerequisites are met"""
    print("🔍 Checking prerequisites...")
    
    # Check if required packages are installed
    try:
        import mysql.connector
        import pymysql
        print("✅ MySQL connector packages found")
    except ImportError as e:
        print(f"❌ Missing required package: {e}")
        print("💡 Please install required packages:")
        print("   pip install mysql-connector-python PyMySQL")
        return False
    
    return True

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 AuraChat Social Media Database Migration")
    print("=" * 60)
    
    if check_prerequisites():
        success = run_migration()
        if success:
            print("\n" + "=" * 60)
            print("✨ Migration completed successfully!")
            print("🎯 Next steps:")
            print("   1. Update your Flask app configuration")
            print("   2. Start the Flask development server")
            print("   3. Test the new social media features")
            print("=" * 60)
        else:
            print("\n❌ Migration failed. Please check the errors above.")
            sys.exit(1)
    else:
        print("\n❌ Prerequisites not met. Please install required packages and configure MySQL.")
        sys.exit(1)