import React from 'react';
import appLogo from '../../assets/app-logo.png';

interface BrandMarkProps {
  size?: number;
  showLabel?: boolean;
  subtitle?: string;
}

export function BrandMark({
  size = 40,
  showLabel = false,
  subtitle = 'Calibration Studio',
}: BrandMarkProps) {
  return (
    <div className={`brand-mark ${showLabel ? 'with-label' : 'icon-only'}`}>
      <div
        className="brand-mark-frame"
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <img src={appLogo} alt="ECU Tuning Software logo" className="brand-mark-image" />
      </div>

      {showLabel && (
        <div className="brand-mark-copy">
          <span className="brand-mark-title">ECU Tuning</span>
          <span className="brand-mark-subtitle">{subtitle}</span>
        </div>
      )}

      <style>{`
        .brand-mark {
          display: inline-flex;
          align-items: center;
          gap: 12px;
        }

        .brand-mark-frame {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(74, 144, 217, 0.22);
          box-shadow: 0 14px 28px rgba(5, 17, 33, 0.34);
          background: linear-gradient(180deg, rgba(22, 33, 62, 0.95), rgba(15, 52, 96, 0.88));
        }

        .brand-mark-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .brand-mark-copy {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }

        .brand-mark-title {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-primary);
          line-height: 1;
        }

        .brand-mark-subtitle {
          font-size: 11px;
          color: var(--text-secondary);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          line-height: 1.2;
        }
      `}</style>
    </div>
  );
}
