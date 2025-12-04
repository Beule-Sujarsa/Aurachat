from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app import db
from app.models import User
import re

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/auth/register', methods=['POST'])
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['username', 'email', 'password']
        for field in required_fields:
            if not data or not data.get(field):
                return jsonify({'message': f'{field} is required'}), 400
        
        # Validate username format
        if not re.match(r'^[a-zA-Z0-9_]+$', data['username']):
            return jsonify({'message': 'Username can only contain letters, numbers, and underscores'}), 400
        
        if len(data['username']) < 3 or len(data['username']) > 20:
            return jsonify({'message': 'Username must be between 3 and 20 characters'}), 400
        
        # Validate email format
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', data['email']):
            return jsonify({'message': 'Invalid email format'}), 400
        
        # Validate password strength
        if len(data['password']) < 6:
            return jsonify({'message': 'Password must be at least 6 characters long'}), 400
        
        # Check if user already exists
        existing_user = User.query.filter_by(username=data['username']).first()
        if existing_user:
            return jsonify({'message': 'Username already taken. Please choose a different username or login if this is your account.'}), 409
        
        existing_email = User.query.filter_by(email=data['email']).first()
        if existing_email:
            return jsonify({'message': 'Email already registered. Please use a different email or login if this is your account.'}), 409
        
        # Create new user
        user = User(
            username=data['username'],
            email=data['email'],
            bio=data.get('bio', ''),
            theme=data.get('theme', 'light')
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Create access token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'message': 'User created successfully',
            'token': access_token,
            'user': user.to_dict()
        }), 201
        
    except ValueError as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Registration failed: {str(e)}'}), 500


@auth_bp.route('/auth/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        
        if not data.get('username') or not data.get('password'):
            return jsonify({'message': 'Username and password are required'}), 400
        
        # Find user by username
        user = User.query.filter_by(username=data['username']).first()
        
        if user and user.check_password(data['password']):
            # Create access token
            access_token = create_access_token(identity=user.id)
            
            return jsonify({
                'message': 'Login successful',
                'token': access_token,
                'user': user.to_dict()
            }), 200
        else:
            return jsonify({'message': 'Invalid username or password'}), 401
            
    except Exception as e:
        return jsonify({'message': f'Login failed: {str(e)}'}), 500


@auth_bp.route('/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user information"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'user': user.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    """User logout endpoint"""
    try:
        # In a real application, you might want to blacklist the token
        # For now, we'll just return a success message
        return jsonify({'message': 'Logout successful'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/auth/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data.get('current_password') or not data.get('new_password'):
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify current password
        if not user.check_password(data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Validate new password
        if len(data['new_password']) < 6:
            return jsonify({'error': 'New password must be at least 6 characters long'}), 400
        
        # Update password
        user.set_password(data['new_password'])
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Password change failed: {str(e)}'}), 500