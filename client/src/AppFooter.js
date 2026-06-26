import React from 'react';
import { Link } from 'react-router-dom';
import { COPYRIGHT_LINE } from './branding';

export default function AppFooter({ className = '' }) {
  return (
    <footer className={`app-footer ${className}`.trim()}>
      <Link to="/about" className="app-footer-link">
        {COPYRIGHT_LINE}
      </Link>
    </footer>
  );
}
