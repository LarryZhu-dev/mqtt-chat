import React, { useState, useEffect } from 'react';

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);

  // Prevent background scrolling when lightbox is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    // Scroll up to zoom in, scroll down to zoom out
    const delta = e.deltaY * -0.001;
    setScale(prev => Math.min(Math.max(0.1, prev + delta), 5));
  };

  return (
    <div 
        className="lightbox-overlay" 
        onClick={onClose}
        onWheel={handleWheel}
    >
      <img 
        src={src} 
        alt="Full size" 
        className="lightbox-image"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()} 
        draggable={false}
      />
      <div style={{ position: 'absolute', bottom: '20px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', pointerEvents: 'none' }}>
        滚轮缩放 • 点击背景关闭
      </div>
    </div>
  );
};
