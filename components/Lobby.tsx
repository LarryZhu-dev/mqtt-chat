import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, RoomInfo } from '../types';
import { generateUUID, compressImage, generateShortId } from '../utils/helpers';
import { Users, Lock, Globe, LogIn, Upload, ShieldAlert, Info, Hash } from 'lucide-react';
import clsx from 'clsx';

interface LobbyProps {
  initialUser: UserProfile | null;
  onJoin: (user: UserProfile, room: RoomInfo) => void;
  publicRooms: RoomInfo[];
}

export const Lobby: React.FC<LobbyProps> = ({ initialUser, onJoin, publicRooms }) => {
  // User State
  const [username, setUsername] = useState(initialUser?.username || '');
  const [avatar, setAvatar] = useState<string | null>(initialUser?.avatarBase64 || null);
  
  // Room State
  const [roomIdInput, setRoomIdInput] = useState('');
  const [topicInput, setTopicInput] = useState('闲聊');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState('');

  // Animation State
  const [isJoining, setIsJoining] = useState(false);
  const [joinRect, setJoinRect] = useState<{top: number, left: number, width: number, height: number} | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Generate random room on mount if empty
  useEffect(() => {
     if(!roomIdInput) setRoomIdInput(generateShortId(6));
  }, []);

  // Sync state when initialUser loads from localStorage
  useEffect(() => {
    if (initialUser) {
      setUsername(prev => prev ? prev : (initialUser.username || ''));
      setAvatar(prev => prev ? prev : (initialUser.avatarBase64 || null));
      
      if (initialUser.username && initialUser.username.startsWith('User_') === false) {
          setUsername(initialUser.username);
      }
      if (initialUser.avatarBase64) {
          setAvatar(initialUser.avatarBase64);
      }
    }
  }, [initialUser]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await compressImage(e.target.files[0], 100, 0.6);
        setAvatar(base64);
      } catch (err) {
        setError("图片处理失败");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }

    const cleanRoomId = roomIdInput.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanRoomId.length === 0 || cleanRoomId.length > 16) {
      setError('房间号必须是 1-16 位字母或数字');
      return;
    }

    // Trigger Animation
    if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setJoinRect({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
        });
        setIsJoining(true);
        
        // Wait for animation to finish effectively
        setTimeout(() => {
             const user: UserProfile = {
              clientId: initialUser?.clientId || `web_${generateUUID()}`,
              username: username.trim(),
              avatarBase64: avatar
            };

            const room: RoomInfo = {
              id: cleanRoomId,
              topicName: topicInput.trim() || cleanRoomId,
              isPublic,
              onlineCount: 0,
              lastActivity: Date.now()
            };

            onJoin(user, room);
        }, 600);
    }
  };

  return (
    <div className="lobby-container">
      {/* Zoom Entry Animation Overlay */}
      {isJoining && joinRect && (
          <div 
             className="zoom-overlay"
             style={{
                 top: joinRect.top,
                 left: joinRect.left,
                 width: joinRect.width,
                 height: joinRect.height,
             }}
          >
              <LogIn size={48} color="#202124" />
          </div>
      )}

      <div className={`lobby-grid animate-fade-in ${isJoining ? 'opacity-0' : ''}`} style={{ transition: 'opacity 0.2s' }}>
        
        {/* Left: Configuration */}
        <div className="lobby-card">
          <div style={{ marginBottom: '2rem' }}>
             <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>wcnm-chat</h1>
             <p style={{ color: 'var(--text-muted)' }}>匿名、轻量、即时的聊天</p>
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* Profile Section */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  您的身份
              </label>
              <div className="flex items-center gap-4">
                <div style={{ position: 'relative', width: '70px', height: '70px' }}>
                  <div className="avatar" style={{ width: '100%', height: '100%', border: '2px solid var(--bg-input)' }}>
                    {avatar ? (
                      <img src={avatar} alt="Avatar" />
                    ) : (
                      <div className="avatar-placeholder">
                        <Users size={28} />
                      </div>
                    )}
                  </div>
                  <label 
                    style={{ 
                        position: 'absolute', inset: 0, 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%', 
                        cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                  >
                    <Upload size={20} color="white" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                </div>
                
                <div className="flex-1">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="给自己起个昵称..."
                    className="styled-input"
                  />
                </div>
              </div>
            </div>

            {/* Room Section */}
            <div style={{ marginTop: '1rem' }}>
               <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                   房间设置
               </label>
               
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                 <div className="relative">
                    <div style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }}><Hash size={18}/></div>
                    <input
                        type="text"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value)}
                        placeholder="房间 ID"
                        className="styled-input"
                        style={{ paddingLeft: '40px', fontFamily: 'monospace' }}
                        maxLength={16}
                    />
                 </div>
                 <div className="relative">
                    <div style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }}><Info size={18}/></div>
                    <input
                        type="text"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        placeholder="房间话题"
                        className="styled-input"
                        style={{ paddingLeft: '40px' }}
                    />
                 </div>
               </div>

               {/* Segmented Control Toggle */}
               <div className="segmented-control" onClick={() => setIsPublic(!isPublic)}>
                  <div className="segmented-bg" style={{ transform: isPublic ? 'translateX(100%)' : 'translateX(0)' }} />
                  <div className={clsx("segmented-option", !isPublic && "active")}>
                    <Lock size={16} /> 私密
                  </div>
                  <div className={clsx("segmented-option", isPublic && "active")}>
                    <Globe size={16} /> 公开
                  </div>
               </div>
            </div>

            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', fontSize: '0.875rem', backgroundColor: 'rgba(239, 83, 80, 0.1)', padding: '12px', borderRadius: '8px' }}>
                    <ShieldAlert size={16} /> {error}
                </div>
            )}

            <button 
                ref={btnRef}
                type="submit" 
                className="btn-primary" 
                style={{ marginTop: '1rem' }}
                disabled={isJoining}
            >
              <LogIn size={20} /> 进入房间
            </button>
          </form>
        </div>

        {/* Right: Public Lobby List */}
        <div className="flex flex-col gap-4">
            <div className="lobby-card flex-1 overflow-hidden">
                <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
                    <h2 className="flex items-center gap-2" style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>
                        <Globe size={24} color="var(--accent)" /> 公开房间
                    </h2>
                    <span className="badge badge-green">Live</span>
                </div>
                
                <div className="flex-1 custom-scrollbar" style={{ overflowY: 'auto' }}>
                    {publicRooms.length === 0 ? (
                        <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', opacity: 0.5, gap: '8px' }}>
                            <Globe size={48} strokeWidth={1} />
                            <p>暂无公开房间</p>
                        </div>
                    ) : (
                        publicRooms.map((room, idx) => (
                            <div 
                                key={room.id}
                                onClick={() => { setRoomIdInput(room.id); setTopicInput(room.topicName); setIsPublic(true); }}
                                className="room-list-item animate-slide-up"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className="flex justify-between" style={{ alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ fontWeight: 'bold', marginBottom: '4px', margin: 0, fontSize: '1rem' }}>{room.topicName}</h3>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                                            <Hash size={10} /> {room.id}
                                        </p>
                                    </div>
                                    <div className="badge badge-green">
                                        {room.onlineCount}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="lobby-card">
                <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>
                    <ShieldAlert size={16} /> 隐私提示
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                   本系统不会加密任何消息，任何信息都会经过公开服务器（它可能被任何人查看或截获）。用户身份为随机生成（匿名），私密房间 ID 即为密钥，泄露后会导致他人随意进入。公开房间会直接被所有人看到。
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};