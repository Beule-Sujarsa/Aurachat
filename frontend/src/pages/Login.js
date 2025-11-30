import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { loginUser } from '../services/api';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await loginUser(formData);
      console.log('Login successful:', response);
      alert('Login successful!');
      // Handle successful login (redirect, store token, etc.)
    } catch (error) {
      console.error('Login error:', error);
      if (error.response && error.response.data && error.response.data.error) {
        setError(error.response.data.error);
      } else if (error.message === 'Network Error') {
        setError('Cannot connect to server. Please check if the backend is running.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Login to AuraChat</h2>
        
        {error && (
          <div style={{ color: 'red', textAlign: 'center', marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        
        <button type="submit" className="btn" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
        
        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;