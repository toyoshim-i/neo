import React from 'react';

interface CRTScanlineOverlayProps {
  enabled?: boolean;
  maskReadingZone?: boolean;
}

export const CRTScanlineOverlay: React.FC<CRTScanlineOverlayProps> = ({
  enabled = true,
  maskReadingZone = true,
}) => {
  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-50 pointer-events-none crt-scanlines ${
        maskReadingZone ? 'crt-mask-reading-zone' : ''
      }`}
    />
  );
};
