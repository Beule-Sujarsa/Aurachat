# AuraChat Database Configuration
# Copy this file to config.py and update with your MySQL credentials

# MySQL Database Configuration
MYSQL_HOST = "localhost"
MYSQL_USER = "root"
MYSQL_PASSWORD = ""  # Add your MySQL password here
DATABASE_NAME = "socialmedia_db"

# Flask Configuration
SECRET_KEY = "your-secret-key-change-this-in-production"
JWT_SECRET_KEY = "your-jwt-secret-key-change-this-in-production"

# Flask-JWT-Extended configuration
JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours in seconds