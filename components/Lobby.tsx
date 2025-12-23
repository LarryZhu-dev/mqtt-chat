
import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, RoomInfo, BrokerConfig } from '../types';
import { generateUUID, compressImage, generateShortId, generateRandomUsername, generateAvatarFromSeed, getStoredBroker, saveBroker, deleteBroker } from '../utils/helpers';
import { Users, Lock, Globe, LogIn, Upload, ShieldAlert, Info, Hash, RefreshCw, Shuffle, Edit2, Server, X, Check, Activity, Github } from 'lucide-react';
import { MqttService } from '../services/mqttService';
import clsx from 'clsx';

interface LobbyProps {
  initialUser: UserProfile | null;
  onJoin: (user: UserProfile, room: RoomInfo, saveOptions: { saveUsername: boolean; saveAvatar: boolean }) => void;
  publicRooms: RoomInfo[];
  urlBroker?: BrokerConfig | null;
}

export const Lobby: React.FC<LobbyProps> = ({ initialUser, onJoin, publicRooms, urlBroker }) => {
  const [username, setUsername] = useState(initialUser?.username || '');
  const [avatar, setAvatar] = useState<string | null>(initialUser?.avatarBase64 || null);
  const [avatarColor, setAvatarColor] = useState<string | undefined>(initialUser?.avatarColor);

  const [isCustomUsername, setIsCustomUsername] = useState(!!initialUser?.username);
  const [isCustomAvatar, setIsCustomAvatar] = useState(!!initialUser?.avatarBase64);
  
  const [roomIdInput, setRoomIdInput] = useState('');
  const [topicInput, setTopicInput] = useState('闲聊');
  const [roomType, setRoomType] = useState<number>(0); 
  const [error, setError] = useState('');

  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [savedBroker, setSavedBroker] = useState<BrokerConfig | null>(getStoredBroker());
  const [brokerForm, setBrokerForm] = useState<BrokerConfig>(savedBroker || {
    host: '',
    port: 8084,
    username: '',
    password: '',
    path: '/mqtt'
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);

  const [isJoining, setIsJoining] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [isClosingAvatarMenu, setIsClosingAvatarMenu] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     if(!roomIdInput) handleRefreshRoomId();
     if(!username) handleRefreshUsername();
     if (urlBroker) setRoomType(2);
  }, []);

  // Update avatar whenever username changes, if it's not a manually uploaded one
  useEffect(() => {
    if (!isCustomAvatar && username.trim()) {
      const { base64, color } = generateAvatarFromSeed(username.trim());
      setAvatar(base64);
      setAvatarColor(color);
    }
  }, [username, isCustomAvatar]);

  const handleRefreshUsername = () => { 
    const newName = generateRandomUsername();
    setUsername(newName); 
    setIsCustomUsername(false); 
  };

  const handleRefreshRoomId = () => { setRoomIdInput(generateShortId(6)); };

  const handleRandomAvatar = () => {
      // Re-randomizing avatar for same username? We just toggle isCustomAvatar off
      // so it follows the username again
      setIsCustomAvatar(false);
      handleCloseAvatarMenu();
  };

  const handleToggleAvatarMenu = () => { if (showAvatarMenu) handleCloseAvatarMenu(); else setShowAvatarMenu(true); };
  const handleCloseAvatarMenu = () => { setIsClosingAvatarMenu(true); setTimeout(() => { setShowAvatarMenu(false); setIsClosingAvatarMenu(false); }, 300); };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await compressImage(e.target.files[0], 100, 0.6);
        setAvatar(base64); setAvatarColor(undefined); setIsCustomAvatar(true);
      } catch (err) { setError("图片处理失败"); }
    }
  };

  const handleTestBroker = () => {
      setIsTesting(true); setTestResult(null);
      const testClient = new MqttService(`test_${generateShortId(4)}`, brokerForm);
      let timeout = setTimeout(() => { testClient.disconnect(); setTestResult('fail'); setIsTesting(false); }, 10000);
      testClient.connect(() => { clearTimeout(timeout); testClient.disconnect(); setTestResult('success'); setIsTesting(false); });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError('请输入用户名'); return; }
    const cleanRoomId = roomIdInput.replace(/[^a-zA-Z0-9]/g, '');
    if (cleanRoomId.length === 0) { setError('房间号格式不正确'); return; }

    let activeBroker: BrokerConfig | undefined = (roomType === 2) ? (urlBroker || savedBroker || undefined) : undefined;
    if (roomType === 2 && !activeBroker) { setError('请先配置自定义 Broker'); return; }

    setIsJoining(true);
    setTimeout(() => {
        const user: UserProfile = { clientId: initialUser?.clientId || `web_${generateUUID()}`, username: username.trim(), avatarBase64: avatar, avatarColor: avatarColor, vipCode: initialUser?.vipCode };
        const room: RoomInfo = { id: cleanRoomId, topicName: topicInput.trim() || cleanRoomId, isPublic: roomType === 1, onlineCount: 0, lastActivity: Date.now(), isCustom: roomType === 2, customBroker: activeBroker };
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('room', cleanRoomId);
        if (roomType === 2 && activeBroker) {
            const { password, ...safeBroker } = activeBroker;
            newUrl.searchParams.set('b', btoa(JSON.stringify(safeBroker)));
        } else newUrl.searchParams.delete('b');
        window.history.pushState({}, '', newUrl);
        onJoin(user, room, { saveUsername: isCustomUsername, saveAvatar: isCustomAvatar });
    }, 400);
  };

  const isBrokerFormValid = !!(brokerForm.host && brokerForm.port && brokerForm.path);
  
  // Segmented control calculations
  const hasCustom = !!(savedBroker || urlBroker);
  const numOptions = hasCustom ? 3 : 2;
  const optionWidthPercent = 100 / numOptions;

  return (
    <div className="lobby-container">
      {/* Top Actions */}
      <div 
        className={clsx(isJoining ? "animate-fade-up-out" : "animate-fade-down-in")}
        style={{ position: 'fixed', top: '20px', right: '20px', display: 'flex', gap: '12px', zIndex: 100 }}
      >
          <button 
            onClick={() => setShowBrokerModal(true)}
            className="btn-icon"
            style={{ 
                backgroundColor: savedBroker ? 'rgba(138, 180, 248, 0.1)' : 'var(--bg-surface)', 
                border: savedBroker ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.05)',
                width: 'auto', borderRadius: '12px', padding: '8px 16px', gap: '8px', color: savedBroker ? 'var(--accent)' : 'var(--text-secondary)'
            }}
          >
              <Server size={18} />
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{savedBroker ? '已配置 Broker' : '自定义 Broker'}</span>
          </button>
      </div>

      <div className="lobby-grid">
        {/* (1, 1) - Main Identity & Room Form */}
        <div className={clsx("lobby-card", isJoining ? "animate-panel-left-out" : "animate-panel-left-in")}>
          <div style={{ marginBottom: '2rem' }}>
             <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>wcnm-chat</h1>
             <p style={{ color: 'var(--text-muted)' }}>匿名、轻量、即时的聊天</p>
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>您的身份</label>
              <div className="flex items-center gap-4">
                <div ref={avatarContainerRef} style={{ position: 'relative', width: '70px', height: '70px' }}>
                  {(showAvatarMenu || isClosingAvatarMenu) && (
                      <>
                        <button type="button" onClick={handleRandomAvatar} title="跟随用户名生成" className={clsx("btn-icon", isClosingAvatarMenu ? "animate-bubble-down" : "animate-bubble-up")} style={{ position: 'absolute', top: '-40px', left: '-10px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--accent)', width: '36px', height: '36px', zIndex: 20 }}><Shuffle size={16} color="var(--accent)" /></button>
                        <button type="button" onClick={() => fileInputRef.current?.click()} title="上传自定义头像" className={clsx("btn-icon", isClosingAvatarMenu ? "animate-bubble-down" : "animate-bubble-up")} style={{ position: 'absolute', top: '-40px', right: '-10px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--text-muted)', width: '36px', height: '36px', zIndex: 20 }}><Upload size={16} /></button>
                      </>
                  )}
                  <div className="avatar" style={{ width: '100%', height: '100%', border: '2px solid var(--bg-input)', cursor: 'pointer', borderRadius: '12px' }} onClick={handleToggleAvatarMenu}>
                    {avatar ? <img src={avatar} alt="Avatar" style={{ imageRendering: 'pixelated' }} /> : <div className="avatar-placeholder"><Users size={28} /></div>}
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                </div>
                <div className="flex-1 relative">
                  <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setIsCustomUsername(true); }} placeholder="给自己起个昵称..." className="styled-input" style={{ paddingRight: '40px' }} />
                  <button type="button" onClick={handleRefreshUsername} className="btn-icon" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}><RefreshCw size={16} title="随机名字" /></button>
                </div>
              </div>
              {!isCustomAvatar && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>头像根据昵称实时生成 (Pixel Art)</p>}
            </div>

            <div style={{ marginTop: '1rem' }}>
               <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>房间设置</label>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                 <div className="relative">
                    <div style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }}><Hash size={18}/></div>
                    <input type="text" value={roomIdInput} onChange={(e) => setRoomIdInput(e.target.value)} placeholder="房间 ID" className="styled-input" style={{ paddingLeft: '40px', paddingRight: '40px', fontFamily: 'monospace' }} maxLength={32} />
                    <button type="button" onClick={handleRefreshRoomId} className="btn-icon" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}><RefreshCw size={16} /></button>
                 </div>
                 <div className="relative">
                    <div style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }}><Info size={18}/></div>
                    <input type="text" value={topicInput} onChange={(e) => setTopicInput(e.target.value)} placeholder="话题" className="styled-input" style={{ paddingLeft: '40px' }} />
                 </div>
               </div>
               
               <div className="segmented-control" style={{ gridTemplateColumns: `repeat(${numOptions}, 1fr)` }}>
                  <div className="segmented-bg" style={{ 
                      width: `calc(${optionWidthPercent}% - 8px)`,
                      transform: `translateX(calc(${roomType} * (100% + 8px)))` 
                  }} />
                  <div className={clsx("segmented-option", roomType === 0 && "active")} onClick={() => setRoomType(0)}><Lock size={16} /> 私密</div>
                  <div className={clsx("segmented-option", roomType === 1 && "active")} onClick={() => setRoomType(1)}><Globe size={16} /> 公开</div>
                  {hasCustom && (<div className={clsx("segmented-option", roomType === 2 && "active")} onClick={() => setRoomType(2)}><Server size={16} /> 自定义</div>)}
               </div>
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: '0.875rem', backgroundColor: 'rgba(239, 83, 80, 0.1)', padding: '12px', borderRadius: '8px' }}><ShieldAlert size={16} /> {error}</div>}
            <button type="submit" className="btn-primary" disabled={isJoining}><LogIn size={20} /> 进入房间</button>
          </form>
        </div>

        {/* (1, 2) - Public Rooms List */}
        <div className={clsx("lobby-card flex-1 overflow-hidden", isJoining ? "animate-panel-tr-out" : "animate-panel-tr-in")}>
            <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
                <h2 className="flex items-center gap-2" style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}><Globe size={24} color="var(--accent)" /> 公开房间</h2>
                <span className="badge badge-green">Live</span>
            </div>
            <div className="flex-1 custom-scrollbar" style={{ overflowY: 'auto' }}>
                {publicRooms.length === 0 ? (
                    <div style={{ height: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', opacity: 0.5, gap: '8px' }}><Globe size={48} /><p>暂无公开房间</p></div>
                ) : (
                    publicRooms.map((room, idx) => (
                        <div key={room.id} onClick={() => { setRoomIdInput(room.id); setTopicInput(room.topicName); setRoomType(1); }} className="room-list-item animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                            <div className="flex justify-between">
                                <div><h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '1rem' }}>{room.topicName}</h3><p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', margin: 0 }}>ID: {room.id}</p></div>
                                <div className="badge badge-green">{room.onlineCount} 在线</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* (2, 1) - Privacy Notice (Animated to Bottom Left) */}
        <div className={clsx("lobby-card", isJoining ? "animate-panel-bl-out" : "animate-panel-bl-in")}>
            <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', margin: '0 0 12px 0', color: 'var(--text-secondary)' }}><ShieldAlert size={18} /> 隐私提示</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
               推荐使用自定义 Broker。公开房间和私密房间都将经过 EMQX 公共服务器。公开房间展示在列表，私密房间不展示，但知道 ID 的人仍可进入。
            </p>
        </div>

        {/* (2, 2) - Disclaimer (Animated to Bottom Right) */}
        <div className={clsx("lobby-card", isJoining ? "animate-panel-br-out" : "animate-panel-br-in")}>
            <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', margin: '0 0 12px 0', color: 'var(--text-secondary)' }}><Info size={18} /> 免责声明</h3>
            <p style={{ fontSize: '12px', color: 'rgba(154, 160, 166, 0.7)', lineHeight: 1.5, margin: 0 }}>
                本平台仅提供 MQTT 客户端。用户信息均保存在本地存储，本系统不保存任何信息（自定义服务器除外）。用户发表言论不代表本平台观点。代码完全开源。
            </p>
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
               <Github size={14} /> <span style={{ fontSize: '10px' }}>Open Source</span>
            </div>
        </div>
      </div>

      {/* Broker Modal */}
      {showBrokerModal && (
          <div className="modal-overlay animate-fade-in" onClick={() => setShowBrokerModal(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                  <div style={{ padding: '24px', borderBottom: '1px solid var(--bg-hover)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><Server color="var(--accent)" /> 配置自定义 Broker</h3>
                      <button onClick={() => setShowBrokerModal(false)} className="btn-icon"><X size={24}/></button>
                  </div>
                  <div style={{ padding: '24px', overflowY: 'auto' }}>
                      <div className="flex flex-col gap-4">
                          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '12px' }}>
                              <input type="text" placeholder="Host" className="styled-input" value={brokerForm.host} onChange={e => setBrokerForm({...brokerForm, host: e.target.value})} />
                              <input type="number" placeholder="Port" className="styled-input" value={brokerForm.port} onChange={e => setBrokerForm({...brokerForm, port: parseInt(e.target.value) || 0})} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <input type="text" placeholder="User" className="styled-input" value={brokerForm.username} onChange={e => setBrokerForm({...brokerForm, username: e.target.value})} />
                              <input type="password" placeholder="Pass" className="styled-input" value={brokerForm.password} onChange={e => setBrokerForm({...brokerForm, password: e.target.value})} />
                          </div>
                          <input type="text" placeholder="Path (/mqtt)" className="styled-input" value={brokerForm.path} onChange={e => setBrokerForm({...brokerForm, path: e.target.value})} />
                      </div>
                      {testResult && (<div style={{ marginTop: '16px', color: testResult === 'success' ? '#81c995' : '#ef5350', fontSize: '14px' }}>{testResult === 'success' ? '连接成功！' : '连接失败。'}</div>)}
                  </div>
                  <div style={{ padding: '24px', backgroundColor: 'var(--bg-hover)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button onClick={handleTestBroker} disabled={isTesting || !isBrokerFormValid} className="btn-primary" style={{ backgroundColor: 'var(--bg-input)', color: 'white' }}>{isTesting ? '测试中...' : '测试'}</button>
                      {testResult === 'success' && (<button onClick={() => { saveBroker(brokerForm); setSavedBroker(brokerForm); setShowBrokerModal(false); setRoomType(2); }} className="btn-primary">保存并应用</button>)}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
