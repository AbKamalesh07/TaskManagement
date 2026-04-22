import React, { useState } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5000/api';

function LoginForm() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'admin'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect based on role
        if (data.user.role === 'admin') {
          window.location.href = '/admin-dashboard';
        } else if (data.user.role === 'staff') {
          window.location.href = '/staff-dashboard';
        } else {
          window.location.href = '/student-dashboard';
        }
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      setError('Cannot connect to server. Please make sure backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>🎓 College Management System</h1>
        <p className="subtitle">Please login to continue</p>
        
        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            {/* Removed the "I am a:" label */}
            <div className="role-selector">
              <label className="role-option">
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={formData.role === 'admin'}
                  onChange={handleChange}
                />
                <span className="radio-custom"></span>
                🔧 Administrator
              </label>
              <label className="role-option">
                <input
                  type="radio"
                  name="role"
                  value="staff"
                  checked={formData.role === 'staff'}
                  onChange={handleChange}
                />
                <span className="radio-custom"></span>
                👨‍🏫 Staff Member
              </label>
              <label className="role-option">
                <input
                  type="radio"
                  name="role"
                  value="student"
                  checked={formData.role === 'student'}
                  onChange={handleChange}
                />
                <span className="radio-custom"></span>
                🎒 Student
              </label>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="username" className="form-label">Username:</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Enter your username"
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="form-label">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Enter your password"
              className="form-input"
            />
          </div>
          
          <button type="submit" disabled={loading} className="login-btn">
            {loading ? (
              <>
                <span className="spinner"></span>
                Logging in...
              </>
            ) : (
              '🚪 Login'
            )}
          </button>
        </form>

        {/* Removed the login-info section with demo accounts */}
      </div>
    </div>
  );
}

export default LoginForm;