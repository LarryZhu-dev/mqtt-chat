
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
  
  // Effect 1: Creator (995231030)
  // Logic: 
  // 1. Dark overlay (immediate)
  // 2. Full Body Shake (0-8s)
  // 3. Avatar Rise (0-8s)
  // 4. Text fades in (8s)
  // 5. Cleanup (11s)
  useEffect(() => {
    if (effect !== 'creator') return;

    // Start Shake
    document.body.classList.add('shake-body');
    setShowCreatorText(false);

    // Stop Shake & Show Text at 8s
    const shakeTimer = setTimeout(() => {
        document.body.classList.remove('shake-body');
        setShowCreatorText(true);
    }, 8000);

    // Complete Animation
    const endTimer = setTimeout(() => {
      onComplete();
      setShowCreatorText(false);
    }, 11000); // 8s + 3s text

    return () => {
        document.body.classList.remove('shake-body');
        clearTimeout(shakeTimer);
        clearTimeout(endTimer);
    };
  }, [effect, onComplete]);


  // Effect 2: Fountain (xiaozuotvt)
  // Logic:
  // 1. Canvas particle system (0-2s) - Emits from full bottom width
  // 2. Danmaku layer (2s-6s)
  // 3. Cleanup (6s)
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

    const timer = setTimeout(() => {
      onComplete();
    }, 6500); // 2s fountain + 4s danmaku + buffer

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
            position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'auto' // Block interaction
        }}>
           {/* Avatar Rising */}
           <div style={{ position: 'absolute', top: '20%', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
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
           
           {/* Text Container (Shows after shake ends) */}
           {showCreatorText && (
               <div style={{ 
                   textAlign: 'center', color: 'white', marginTop: '40vh',
                   animation: 'fadeIn 1s ease-out forwards',
                   zIndex: 10
               }}>
                   <h1 style={{ fontSize: '4rem', fontWeight: 'bold', textShadow: '0 0 20px red', margin: 0, letterSpacing: '10px' }}>
                       造物主降临
                   </h1>
                   <p style={{ fontSize: '1.5rem', marginTop: '20px', letterSpacing: '5px', opacity: 0.8 }}>
                       既见真主，为何不拜
                   </p>
                   <div style={{ fontSize: '2rem', color: '#8ab4f8', marginTop: '20px', fontWeight: 'bold' }}>
                       {triggerUser.username}
                   </div>
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
                {Array.from({ length: 40 }).map((_, i) => (
                    <div 
                        key={i}
                        style={{
                            position: 'absolute',
                            top: `${Math.random() * 90}%`,
                            left: '100%',
                            fontSize: `${Math.random() * 40 + 30}px`,
                            color: `hsl(${Math.random() * 360}, 100%, 70%)`,
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            textShadow: '0 0 5px black',
                            // Animation duration 4s, delay between 2s and 4s
                            animation: `danmaku-slide 4s linear forwards`,
                            animationDelay: `${2 + Math.random() * 1.5}s` 
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
