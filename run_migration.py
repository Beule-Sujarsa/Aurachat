#!/usr/bin/env python
import pymysql

try:
    conn = pymysql.connect(
        host='127.0.0.1',
        user='root',
        password='BeuleSQL2025',
        database='socialmedia_db'
    )
    
    cursor = conn.cursor()
    
    # Add missing columns
    columns_to_add = [
        ("ALTER TABLE user ADD COLUMN profile_pic LONGTEXT DEFAULT 'default.jpg'", "profile_pic"),
        ("ALTER TABLE user ADD COLUMN bio TEXT", "bio"),
        ("ALTER TABLE user ADD COLUMN is_private BOOLEAN DEFAULT FALSE", "is_private"),
        ("ALTER TABLE user ADD COLUMN theme VARCHAR(20) DEFAULT 'light'", "theme")
    ]
    
    for sql, col_name in columns_to_add:
        try:
            cursor.execute(sql)
            print(f"✓ Added {col_name} column")
        except pymysql.err.OperationalError as e:
            if "Duplicate column" in str(e):
                print(f"✓ {col_name} column already exists")
            else:
                print(f"✗ Error with {col_name}: {e}")
    
    conn.commit()
    conn.close()
    print("\n✅ Migration complete!")
    
except Exception as e:
    print(f"❌ Database error: {e}")
