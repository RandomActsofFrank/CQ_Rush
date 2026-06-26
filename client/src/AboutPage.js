import React from 'react';
import { Link } from 'react-router-dom';
import {
  APP_NAME,
  APP_VERSION,
  BRAND_ASSETS,
  DONATION_URL,
  GITHUB_URL
} from './branding';
import AppFooter from './AppFooter';
import './About.css';

export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-shell">
        <img
          src={BRAND_ASSETS.banner}
          alt={`${APP_NAME} banner`}
          className="about-banner"
        />

        <div className="about-card">
          <p className="about-tagline">
            Free, open-source ARRL Field Day logging software for clubs and individual operators.
          </p>

          <section className="about-section">
            <h2>Free &amp; open source</h2>
            <p>
              {APP_NAME} is free to use, modify, and deploy. Source code is available on GitHub
              (release <strong>v{APP_VERSION}</strong>).
              There is no license fee and no account required with us to run your own instance.
            </p>
            <p>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                View source on GitHub
              </a>
            </p>
          </section>

          <section className="about-section">
            <h2>Donationware</h2>
            <p>
              If {APP_NAME} helps your club during Field Day or daily logging, a voluntary donation
              is appreciated but never required. Donations support continued development and hosting.
            </p>

            <div className="about-donate">
              <div className="about-donate-qr">
                <img src={BRAND_ASSETS.donateQr} alt="Donation QR code" />
                <span>Scan to donate</span>
              </div>
              <div className="about-donate-actions">
                <a
                  className="about-donate-button"
                  href={DONATION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Donate with PayPal
                </a>
                <p className="about-donate-note">
                  Opens PayPal in a new tab. Suggested donation — any amount helps.
                </p>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Field Day logging</h2>
            <p>
              Log contacts, track ARRL sections, coordinate operators, export Cabrillo, and run a
              public display for your club. Configure your own club name, security, and station
              settings in the admin panel.
            </p>
          </section>

          <div className="about-back">
            <Link to="/" className="about-back-link">← Back to logbook</Link>
          </div>
        </div>

        <AppFooter className="about-footer" />
      </div>
    </div>
  );
}
