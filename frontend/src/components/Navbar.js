import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMenuOpen(false);
  };

  return (
    <nav className="navbar" style={{
      height: 'var(--navbar-height)',
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      transition: 'all var(--transition-normal)'
    }}>
      <div className="container">
        <div className="flex items-center justify-between" style={{ height: 'var(--navbar-height)' }}>
          {/* Logo */}
          <Link to={user ? "/dashboard" : "/"} className="navbar-brand">
            <div className="flex items-center gap-2">
              <div style={{
                width: '32px',
                height: '32px',
                background: 'var(--primary-gradient)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold'
              }}>
                A
              </div>
              <span style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                background: 'var(--primary-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                AuraChat
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="navbar-nav" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="btn btn-secondary"
              style={{
                padding: '8px 12px',
                fontSize: '1.2rem',
                minWidth: '44px'
              }}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {user ? (
              <>
                {/* Desktop Menu */}
                <div className="desktop-menu" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <Link 
                    to="/feed" 
                    className="nav-link"
                    style={{
                      color: 'var(--text-primary)',
                      padding: '8px 16px',
                      borderRadius: 'var(--border-radius-sm)',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    📱 Feed
                  </Link>
                  <Link 
                    to="/profile" 
                    className="nav-link"
                    style={{
                      color: 'var(--text-primary)',
                      padding: '8px 16px',
                      borderRadius: 'var(--border-radius-sm)',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    👤 Profile
                  </Link>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Welcome, {user.username}
                  </span>
                  <button 
                    onClick={handleLogout}
                    className="btn btn-outline"
                    style={{ padding: '8px 16px' }}
                  >
                    Logout
                  </button>
                </div>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="mobile-menu-btn btn btn-secondary"
                  style={{
                    display: 'none',
                    padding: '8px 12px',
                    fontSize: '1.2rem'
                  }}
                >
                  ☰
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Link to="/login" className="btn btn-outline">
                  Login
                </Link>
                <Link to="/register" className="btn btn-primary">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {user && (
          <div 
            className="mobile-menu"
            style={{
              display: isMenuOpen ? 'block' : 'none',
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderTop: 'none',
              padding: '1rem',
              boxShadow: 'var(--box-shadow)'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Link 
                to="/feed" 
                onClick={() => setIsMenuOpen(false)}
                style={{
                  color: 'var(--text-primary)',
                  padding: '12px',
                  borderRadius: 'var(--border-radius-sm)',
                  textAlign: 'center'
                }}
              >
                📱 Feed
              </Link>
              <Link 
                to="/profile" 
                onClick={() => setIsMenuOpen(false)}
                style={{
                  color: 'var(--text-primary)',
                  padding: '12px',
                  borderRadius: 'var(--border-radius-sm)',
                  textAlign: 'center'
                }}
              >
                👤 Profile
              </Link>
              <div style={{
                padding: '12px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                borderTop: '1px solid var(--border-color)',
                marginTop: '0.5rem'
              }}>
                Welcome, {user.username}
              </div>
              <button 
                onClick={handleLogout}
                className="btn btn-danger"
                style={{ width: '100%' }}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .nav-link:hover {
          background-color: var(--bg-tertiary);
        }

        @media (max-width: 768px) {
          .desktop-menu {
            display: none !important;
          }
          
          .mobile-menu-btn {
            display: block !important;
          }
        }
      `}</style>
    </nav>
  );
};

export default Navbar;