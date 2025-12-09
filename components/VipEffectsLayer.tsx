
import React, { useEffect, useRef } from 'react';
import { UserProfile } from '../types';

interface VipEffectsLayerProps {
  effect: 'creator' | 'fountain' | null;
  triggerUser: UserProfile | null;
  onComplete: () => void;
}

export const VipEffectsLayer: React.FC<VipEffectsLayerProps> = ({ effect, triggerUser, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Effect 1: Creator (995231030)
  // Logic: 
  // 1. Dark overlay (immediate)
  // 2. Avatar fade in from bottom + scale (100vh -> 0)
  // 3. Screen shake (8s)
  // 4. Text fades in
  useEffect(() => {
    if (effect !== 'creator') return;

    const timer = setTimeout(() => {
      onComplete();
    }, 13000); // 13s total duration

    return () => clearTimeout(timer);
  }, [effect, onComplete]);


  // Effect 2: Fountain (xiaozuotvt)
  // Logic:
  // 1. Canvas particle system for avatar fountain (2s)
  // 2. Danmaku layer for text (4s)
  useEffect(() => {
    if (effect !== 'fountain' || !triggerUser) return;
    
    // Canvas Fountain Logic
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particles: any[] = [];
    const avatarImg = new Image();
    // Default placeholder if no avatar
    avatarImg.src = triggerUser.avatarBase64 || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23ccc'/%3E%3C/svg%3E";

    let animationId: number;
    const startTime = Date.now();
    const duration = 2000; // 2s emission

    const createParticle = () => {
        const size = Math.random() * 150 + 50; // 50px to 200px
        particles.push({
            x: window.innerWidth / 2,
            y: window.innerHeight + 100,
            vx: (Math.random() - 0.5) * 20,
            vy: -(Math.random() * 20 + 15),
            gravity: 0.8,
            size: size,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10
        });
    };

    const loop = () => {
        const elapsed = Date.now() - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Emit particles
        if (elapsed < duration) {
            for(let i=0; i<5; i++) createParticle();
        }

        // Update & Draw
        particles.forEach((p, index) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.rotation += p.rotationSpeed;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.drawImage(avatarImg, -p.size/2, -p.size/2, p.size, p.size);
            ctx.restore();

            // Remove if off screen
            if (p.y > window.innerHeight + 200) {
                particles.splice(index, 1);
            }
        });

        if (elapsed < duration + 3000) { // Keep running until particles fall
            animationId = requestAnimationFrame(loop);
        } else {
            // Animation sequence finished, wait for danmaku (which runs in parallel via CSS)
        }
    };
    
    // Start loop when image loads
    if (avatarImg.complete) {
        loop();
    } else {
        avatarImg.onload = loop;
    }

    const timer = setTimeout(() => {
      onComplete();
    }, 6000); // 2s fountain + 4s danmaku

    return () => {
        cancelAnimationFrame(animationId);
        clearTimeout(timer);
    };
  }, [effect, triggerUser, onComplete]);


  if (!effect) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      
      {/* EFFECT 1: CREATOR */}
      {effect === 'creator' && triggerUser && (
        <div style={{ 
            position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto' // Block interaction
        }}>
           {/* Avatar Shake Wrapper */}
           <div style={{ animation: 'shake-hard 0.2s infinite', marginTop: '-10%' }}>
              <img 
                src={triggerUser.avatarBase64 || ''} 
                alt="Creator"
                style={{ 
                    width: '300px', height: '300px', borderRadius: '50%', 
                    boxShadow: '0 0 100px rgba(255,255,255,0.5)',
                    animation: 'rise-up 8s cubic-bezier(0.22, 1, 0.36, 1) forwards'
                }} 
              />
           </div>
           
           {/* Text Container */}
           <div style={{ 
               textAlign: 'center', color: 'white', marginTop: '40px',
               opacity: 0, animation: 'fadeIn 1s ease-out 9s forwards' 
           }}>
               <h1 style={{ fontSize: '4rem', fontWeight: 'bold', textShadow: '0 0 20px red', margin: 0, letterSpacing: '10px' }}>
                   造物主降临
               </h1>
               <p style={{ fontSize: '1.5rem', marginTop: '20px', letterSpacing: '5px', opacity: 0.8 }}>
                   既见真主，为何不拜
               </p>
           </div>
           
           {/* Name Reveal */}
           <div style={{
               position: 'absolute', bottom: '10%', fontSize: '2rem', color: '#8ab4f8',
               opacity: 0, animation: 'fadeIn 1s ease-out 8s forwards'
           }}>
               {triggerUser.username}
           </div>
        </div>
      )}


      {/* EFFECT 2: FOUNTAIN */}
      {effect === 'fountain' && (
          <>
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
            
            {/* Danmaku Layer - Delayed Start (2s) */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                {Array.from({ length: 20 }).map((_, i) => (
                    <div 
                        key={i}
                        style={{
                            position: 'absolute',
                            top: `${Math.random() * 100}%`,
                            right: '-20%', // Start off screen
                            fontSize: `${Math.random() * 30 + 20}px`,
                            color: `hsl(${Math.random() * 360}, 100%, 70%)`,
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            animation: `danmaku-slide 4s linear forwards`,
                            animationDelay: `${2 + Math.random() * 2}s` // Start after fountain (2s)
                        }}
                    >
                        屙你嘴里
                    </div>
                ))}
            </div>
          </>
      )}
    </div>
  );
};
