
import React, { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../types';

interface VipEffectsLayerProps {
  effect: 'creator' | 'fountain' | null;
  triggerUser: UserProfile | null;
  onComplete: () => void;
}

export const VipEffectsLayer: React.FC<VipEffectsLayerProps> = ({ effect, triggerUser, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCreatorText, setShowCreatorText] = useState(false);
  const hasRunRef = useRef(false);
  
  // Reset hasRun when effect becomes null
  useEffect(() => {
    if (!effect) {
      hasRunRef.current = false;
    }
  }, [effect]);

  // Effect 1: Creator (995231030)
  useEffect(() => {
    if (effect !== 'creator') return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    // Timeline:
    // 0s - 12s: Rising Animation + Violent Shake
    // 12s: Shake stops, Text Fades In
    // 17s: Complete

    setShowCreatorText(false);

    // Show text after the rise is complete (12s)
    const textTimer = setTimeout(() => {
        setShowCreatorText(true);
    }, 12000);

    // Complete Animation
    const endTimer = setTimeout(() => {
      onComplete();
      setShowCreatorText(false);
    }, 17000); 

    return () => {
        clearTimeout(textTimer);
        clearTimeout(endTimer);
    };
  }, [effect, onComplete]);


  // Effect 2: Fountain (xiaozuotvt)
  useEffect(() => {
    if (effect !== 'fountain' || !triggerUser) return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    
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
    const emissionDuration = 2000; // 2s emission

    const createParticle = () => {
        const size = Math.random() * 150 + 50; // 50px to 200px
        const x = Math.random() * canvas.width; // Full width emission
        
        particles.push({
            x: x,
            y: window.innerHeight + size, // Start below screen
            vx: (Math.random() - 0.5) * 5, // Slight horizontal drift
            vy: -(Math.random() * 25 + 15), // Strong upward force
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
        if (elapsed < emissionDuration) {
            // High density emission
            for(let i=0; i<8; i++) createParticle();
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

            // Remove if off screen (bottom)
            if (p.y > window.innerHeight + 200) {
                particles.splice(index, 1);
            }
        });

        if (elapsed < emissionDuration + 3000) { // Keep running until particles fall
            animationId = requestAnimationFrame(loop);
        }
    };
    
    // Start loop when image loads
    if (avatarImg.complete) {
        loop();
    } else {
        avatarImg.onload = loop;
    }

    // Extended timeout to 15s to cover max animation duration (11s) + margin
    // Prevents jitter/flash at the end
    const timer = setTimeout(() => {
      onComplete();
    }, 15000); 

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
        // The Shaking Container. Oversized to prevent edges from showing during shake.
        <div style={{ 
            position: 'absolute', 
            width: '110vw', height: '110vh', left: '-5vw', top: '-5vh',
            backgroundColor: 'rgba(0,0,0,0.85)', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto', // Block interaction
            animation: 'shake-violent 12s linear forwards' // Shake the whole world
        }}>
           {/* Avatar Rising - Rise duration extended to 12s with cubic-bezier for slow stop */}
           <div style={{ 
               position: 'absolute', top: '25%', left: 0, right: 0, display: 'flex', justifyContent: 'center',
               animation: 'rise-up-slow 12s cubic-bezier(0.1, 0.6, 0.3, 1) forwards'
           }}>
              <img 
                  src={triggerUser.avatarBase64 || ''} 
                  alt="Creator"
                  style={{ 
                      width: '300px', height: '300px', borderRadius: '50%', 
                      boxShadow: '0 0 100px rgba(255,255,255,0.5)',
                      display: 'block'
                  }} 
              />
           </div>
           
           {/* Text Container (Shows after rise ends) */}
           {showCreatorText && (
               <div style={{ 
                   textAlign: 'center', color: 'white', marginTop: '40vh',
                   zIndex: 10
               }}>
                   {/* 1. Username appears first */}
                   <div style={{ 
                       fontSize: '2rem', color: '#8ab4f8', marginBottom: '20px', fontWeight: 'bold',
                       opacity: 0,
                       animation: 'fadeIn 1s ease-out forwards',
                       animationDelay: '0s'
                   }}>
                       {triggerUser.username}
                   </div>

                   {/* 2. Main Title appears second */}
                   <h1 style={{ 
                       fontSize: '4rem', fontWeight: 'bold', textShadow: '0 0 20px red', margin: 0, letterSpacing: '10px',
                       opacity: 0,
                       animation: 'fadeIn 1s ease-out forwards',
                       animationDelay: '1.2s'
                   }}>
                       造物主降临
                   </h1>

                   {/* 3. Subtitle appears last */}
                   <p style={{ 
                       fontSize: '1.5rem', marginTop: '20px', letterSpacing: '5px', opacity: 0,
                       animation: 'fadeIn 1s ease-out forwards',
                       animationDelay: '2.8s'
                   }}>
                       既见真主，为何不拜
                   </p>
               </div>
           )}
        </div>
      )}


      {/* EFFECT 2: FOUNTAIN */}
      {effect === 'fountain' && (
          <>
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
            
            {/* Danmaku Layer - Delayed Start (Starts at 2s) */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                {Array.from({ length: 300 }).map((_, i) => { // Increased to 300
                    const delay = 2 + Math.random() * 3; // 2s - 5s
                    const duration = 4 + Math.random() * 5; // 4s - 9s
                    
                    return (
                        <div 
                            key={i}
                            style={{
                                position: 'absolute',
                                // Spread vertically 5% to 95% to avoid edge clipping
                                top: `${Math.random() * 90 + 5}%`,
                                left: '100%',
                                fontSize: `${Math.random() * 40 + 20}px`,
                                color: `hsl(${Math.random() * 360}, 100%, 70%)`,
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                textShadow: '0 0 5px black',
                                willChange: 'transform',
                                animation: `danmaku-slide ${duration}s linear forwards`,
                                animationDelay: `${delay}s` 
                            }}
                        >
                            屙你嘴里
                        </div>
                    );
                })}
            </div>
          </>
      )}
    </div>
  );
};
