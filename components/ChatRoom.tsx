
import React, { useEffect, useRef, useState, UIEvent, useCallback } from 'react';
import { ChatMessage, PresencePayload, Reaction, RoomInfo, UserProfile, RoomConfig, VotePayload, OnlineUser } from '../types';
import { MqttService } from '../services/mqttService';
import { generateUUID } from '../utils/helpers';
import { InputArea } from './InputArea';
import { MessageBubble } from './MessageBubble';
import { ImageLightbox } from './ImageLightbox';
import { VipEffectsLayer } from './VipEffectsLayer';
import { LogOut, Trash2, Users, Settings, Lock, Globe, Check, X, ShieldAlert, Wifi, WifiOff, Clock, Copy, Reply, Download, ArrowDown, Server } from 'lucide-react';

interface ChatRoomProps {
  user: UserProfile;
  room: RoomInfo;
  onLeave: () => void;
}

interface ActiveVoteState {
    id: string;
    targetState: boolean;
    votes: Map<string, boolean>;
    initiatorId: string;
    timestamp: number;
}

const PRUNE_TIMEOUT = 25000;
const VOTE_TIMEOUT = 60000;
const SCROLL_THRESHOLD = 150; 

export const ChatRoom: React.FC<ChatRoomProps> = ({ user, room: initialRoom, onLeave }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  
  const [isCopied, setIsCopied] = useState(false);
  
  const [globalContextMenu, setGlobalContextMenu] = useState<{x: number, y: number} | null>(null);
  const [msgContextMenu, setMsgContextMenu] = useState<{ x: number; y: number; message: ChatMessage } | null>(null);

  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeVote, setActiveVote] = useState<ActiveVoteState | null>(null);
  const [voteTimeLeft, setVoteTimeLeft] = useState(0);

  const [insertTextRequest, setInsertTextRequest] = useState<{ text: string; id: number } | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [hasUnreadMention, setHasUnreadMention] = useState(false);
  
  const [activeVipEffect, setActiveVipEffect] = useState<'creator' | 'fountain' | null>(null);
  const [vipTriggerUser, setVipTriggerUser] = useState<UserProfile | null>(null);
  
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const mqttRef = useRef<MqttService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleIntervalRef = useRef<any>(null);
  
  const activeVoteRef = useRef(activeVote);
  const onlineUsersRef = useRef(onlineUsers);
  const roomConfigRef = useRef(roomConfig);

  const offlineQueueRef = useRef<ChatMessage[]>([]);

  useEffect(() => { activeVoteRef.current = activeVote; }, [activeVote]);
  useEffect(() => { onlineUsersRef.current = onlineUsers; }, [onlineUsers]);
  useEffect(() => { roomConfigRef.current = roomConfig; }, [roomConfig]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      const dist = scrollHeight - scrollTop - clientHeight;
      const near = dist < SCROLL_THRESHOLD;
      setIsNearBottom(near);
      if (near) setUnreadCount(0);
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setUnreadCount(0);
    setIsNearBottom(true);
  };

  useEffect(() => {
    const originalTitle = document.title;
    if (hasUnreadMention) {
        if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);
        let showNotify = true;
        titleIntervalRef.current = setInterval(() => {
            document.title = showNotify ? "🔔 有人提到我 - wcnm-chat" : originalTitle;
            showNotify = !showNotify;
        }, 1000);
    } else {
        if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);
        titleIntervalRef.current = null;
        document.title = originalTitle;
    }
    return () => {
        if (titleIntervalRef.current) clearInterval(titleIntervalRef.current);
        document.title = originalTitle;
    };
  }, [hasUnreadMention]);

  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') setHasUnreadMention(false);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleVipComplete = useCallback(() => {
    setActiveVipEffect(null);
    setVipTriggerUser(null);
  }, []);

  useEffect(() => {
    const service = new MqttService(user.clientId, initialRoom.customBroker);
    mqttRef.current = service;

    service.setCallbacks({
      onConnectionChange: (connected) => {
          setIsConnected(connected);
          if (connected && offlineQueueRef.current.length > 0) {
              offlineQueueRef.current.forEach(msg => service.sendMessage(initialRoom.id, msg));
              offlineQueueRef.current = [];
          }
      },
      onMessage: (msg) => {
        setMessages(prev => {
           if (prev.some(m => m.id === msg.id)) return prev;
           return [...prev, msg];
        });
        if (msg.senderId !== user.clientId && document.hidden) {
            const isMentioned = (msg.type === 'text' || msg.type === 'mixed') && msg.content.includes(`@${user.username}`);
            if (isMentioned) setHasUnreadMention(true);
        }
      },
      onPresence: (payload) => {
        setOnlineUsers(prev => {
             const newMap = new Map(prev);
             if (payload.type === 'leave') newMap.delete(payload.user.clientId);
             else newMap.set(payload.user.clientId, { ...payload.user, lastSeen: Date.now() });
             return newMap;
         });
         if (payload.type === 'join' && payload.user.vipCode) {
             if (payload.user.vipCode === '995231030') {
                 setVipTriggerUser(payload.user);
                 setActiveVipEffect('creator');
             } else if (payload.user.vipCode === 'xiaozuotvt') {
                 setVipTriggerUser(payload.user);
                 setActiveVipEffect('fountain');
                 if (payload.user.clientId !== user.clientId) {
                     setTimeout(() => {
                         const forcedMsg: ChatMessage = {
                             id: generateUUID(), type: 'text', content: '屙我嘴里', senderId: user.clientId, senderUsername: user.username, senderAvatar: user.avatarBase64, timestamp: Date.now(), reactions: {}
                         };
                         service.sendMessage(initialRoom.id, forcedMsg);
                     }, 4000);
                 }
             }
         }
      },
      onReaction: (data) => handleReaction(data.targetId, data.reaction),
      onConfigUpdate: (config) => setRoomConfig(config),
      onVote: (payload) => handleVoteSignal(payload, activeVoteRef.current, onlineUsersRef.current, roomConfigRef.current),
      onRoomListUpdate: () => {}
    });

    const lwtPayload = JSON.stringify({ type: 'leave', user: user, roomId: initialRoom.id });

    service.connect(() => {
      service.joinRoom(initialRoom.id);
      service.sendPresence(initialRoom.id, { type: 'join', user: user, roomId: initialRoom.id });
      setTimeout(() => {
          setRoomConfig(prev => {
              if (!prev) {
                  const newConfig: RoomConfig = { isPublic: initialRoom.isPublic, topicName: initialRoom.topicName, createdBy: user.username, createdAt: Date.now() };
                  service.publishRoomConfig(initialRoom.id, newConfig);
                  return newConfig;
              }
              return prev;
          });
      }, 1000);
    }, { topic: `darkmqtt/room/${initialRoom.id}/presence`, payload: lwtPayload });

    return () => { if (mqttRef.current) mqttRef.current.disconnect(); };
  }, []);

  useEffect(() => {
      if (messages.length === 0) return;
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId === user.clientId) {
          scrollToBottom();
          return;
      }
      if (isNearBottom) setTimeout(scrollToBottom, 100);
      else setUnreadCount(prev => prev + 1);
  }, [messages]);

  useEffect(() => {
      const interval = setInterval(() => {
          const now = Date.now();
          if (mqttRef.current && isConnected) {
             mqttRef.current.sendPresence(initialRoom.id, { type: 'heartbeat', user, roomId: initialRoom.id });
             setOnlineUsers(prev => {
                const me = prev.get(user.clientId);
                if (me) {
                    const next = new Map<string, OnlineUser>(prev);
                    next.set(user.clientId, { ...me, lastSeen: now });
                    return next;
                }
                return prev;
             });
             // Only update global lobby if it's NOT a custom broker
             if (roomConfig?.isPublic && !initialRoom.isCustom) {
                 mqttRef.current.updatePublicRoomListing(initialRoom.id, roomConfig.topicName, onlineUsers.size || 1);
             }
          }
          setOnlineUsers(prev => {
              let changed = false;
              const next = new Map<string, OnlineUser>(prev);
              next.forEach((u, key) => {
                  if (now - u.lastSeen > PRUNE_TIMEOUT) {
                      next.delete(key);
                      changed = true;
                  }
              });
              return changed ? next : prev;
          });
      }, 5000); 
      return () => clearInterval(interval);
  }, [isConnected, initialRoom.id, user, roomConfig, onlineUsers.size, initialRoom.isCustom]);

  useEffect(() => {
      if (!activeVote) { setVoteTimeLeft(0); return; }
      const checkInterval = setInterval(() => {
          const elapsed = Date.now() - activeVote.timestamp;
          const left = Math.max(0, Math.ceil((VOTE_TIMEOUT - elapsed) / 1000));
          setVoteTimeLeft(left);
          if (elapsed > VOTE_TIMEOUT) {
              if (activeVote.initiatorId === user.clientId) {
                  const newConfig = { ...roomConfigRef.current!, isPublic: activeVote.targetState };
                  mqttRef.current?.publishRoomConfig(initialRoom.id, newConfig);
                  if (!newConfig.isPublic) mqttRef.current?.clearPublicRoomListing(initialRoom.id);
                  setActiveVote(null);
              } else setActiveVote(null);
          }
      }, 1000);
      return () => clearInterval(checkInterval);
  }, [activeVote, user.clientId, initialRoom.id]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') { e.preventDefault(); setMessages([]); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleCopyLink = () => {
      const url = new URL(window.location.href);
      url.searchParams.set('room', initialRoom.id);
      if (initialRoom.isCustom && initialRoom.customBroker) {
          const { password, ...safeBroker } = initialRoom.customBroker;
          url.searchParams.set('b', btoa(JSON.stringify(safeBroker)));
      }
      navigator.clipboard.writeText(url.toString()).then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      });
  };

  const handleReaction = (msgId: string, reaction: Reaction) => {
      setMessages(prev => prev.map(msg => {
          if (msg.id !== msgId) return msg;
          const currentReactions = msg.reactions[reaction.emoji] || [];
          if (currentReactions.some(r => r.fromClientId === reaction.fromClientId)) return msg;
          return { ...msg, reactions: { ...msg.reactions, [reaction.emoji]: [...currentReactions, reaction] } };
      }));
  };

  const handleVoteSignal = (payload: VotePayload, currentVote: ActiveVoteState | null, currentUsers: Map<string, UserProfile>, currentConfig: RoomConfig | null) => {
      if (payload.type === 'proposal') {
          setActiveVote({ id: payload.voteId, targetState: payload.targetState!, votes: new Map(), initiatorId: payload.initiatorId!, timestamp: payload.timestamp || Date.now() });
      } else if (payload.type === 'ballot' && currentVote && payload.voteId === currentVote.id) {
          if (payload.decision === 'veto') { setActiveVote(null); return; }
          const newVotes = new Map(currentVote.votes);
          newVotes.set(payload.voterId!, true);
          setActiveVote(prev => prev ? { ...prev, votes: newVotes } : null);
          if (newVotes.size >= currentUsers.size) {
             if (currentVote.initiatorId === user.clientId) {
                 const newConfig = { ...currentConfig!, isPublic: currentVote.targetState };
                 mqttRef.current?.publishRoomConfig(initialRoom.id, newConfig);
                 if (!newConfig.isPublic) mqttRef.current?.clearPublicRoomListing(initialRoom.id);
             }
             setActiveVote(null);
          }
      }
  };

  const getMessageSummary = (msg: ChatMessage): string => {
      if (msg.type === 'image') return '[图片]';
      if (msg.type === 'mixed') return `[图片] ${msg.content}`;
      return msg.content;
  };

  const sendMessage = (text: string, imageBase64?: string) => {
    let type: 'text' | 'image' | 'mixed' = 'text';
    if (imageBase64 && text) type = 'mixed';
    else if (imageBase64) type = 'image';
    let replySummary = undefined;
    if (replyingTo) {
        let content = getMessageSummary(replyingTo);
        if (content.length > 50) content = content.substring(0, 50) + '...';
        replySummary = { username: replyingTo.senderUsername, content: content };
    }
    const newMsg: ChatMessage = { id: generateUUID(), type, content: text, imageUrl: imageBase64, senderId: user.clientId, senderUsername: user.username, senderAvatar: user.avatarBase64, timestamp: Date.now(), replyToId: replyingTo?.id, replyToSummary: replySummary, reactions: {} };
    if (isConnected && mqttRef.current) mqttRef.current.sendMessage(initialRoom.id, newMsg);
    else { offlineQueueRef.current.push(newMsg); setMessages(prev => [...prev, newMsg]); }
    setReplyingTo(null);
    scrollToBottom();
  };

  const sendReaction = (msgId: string, emoji: string) => {
      if (!mqttRef.current) return;
      mqttRef.current.sendReaction(initialRoom.id, msgId, { emoji, fromClientId: user.clientId, fromUsername: user.username, timestamp: Date.now() });
  };
  
  const scrollToMessage = (id: string) => {
      const el = document.getElementById(`msg-${id}`);
      if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const originalBg = el.style.backgroundColor;
          el.style.backgroundColor = 'var(--bg-hover)';
          setTimeout(() => el.style.backgroundColor = originalBg, 1000);
      }
  };

  const handleDeleteLocal = (id: string) => setMessages(prev => prev.filter(m => m.id !== id));

  const handleLeaveClick = () => {
      if (mqttRef.current) {
          mqttRef.current.sendPresence(initialRoom.id, { type: 'leave', user: user, roomId: initialRoom.id });
          if (onlineUsers.size <= 1 && roomConfig?.isPublic) mqttRef.current.clearPublicRoomListing(initialRoom.id);
          mqttRef.current.leaveRoom(initialRoom.id);
      }
      onLeave();
  };

  const startVote = (targetState: boolean) => {
      if (!mqttRef.current) return;
      mqttRef.current.sendVote(initialRoom.id, { type: 'proposal', voteId: generateUUID(), action: 'toggle_privacy', targetState, initiatorId: user.clientId, timestamp: Date.now() });
  };

  const castVote = (decision: 'agree' | 'veto') => {
      if (!mqttRef.current || !activeVote) return;
      mqttRef.current.sendVote(initialRoom.id, { type: 'ballot', voteId: activeVote.id, action: 'toggle_privacy', voterId: user.clientId, decision });
  };

  const handleGlobalContextMenu = (e: React.MouseEvent) => {
      if (e.target === containerRef.current) { e.preventDefault(); setGlobalContextMenu({ x: e.clientX, y: e.clientY }); setMsgContextMenu(null); }
  };

  const handleMessageContextMenu = (e: React.MouseEvent, msg: ChatMessage) => { e.preventDefault(); e.stopPropagation(); setGlobalContextMenu(null); setMsgContextMenu({ x: e.clientX, y: e.clientY, message: msg }); };

  useEffect(() => {
      const handleClick = () => { setGlobalContextMenu(null); setMsgContextMenu(null); setShowSettings(false); };
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="chat-layout animate-fade-in">
      <VipEffectsLayer effect={activeVipEffect} triggerUser={vipTriggerUser} onComplete={handleVipComplete} />

      <header className="chat-header">
        <div className="flex items-center gap-4 overflow-hidden h-full">
             <div className="flex items-center justify-center shrink-0" style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-input)' }}>
                {isConnected ? <Wifi size={18} color="#4caf50" /> : <WifiOff size={18} color="#ef5350" />}
             </div>
             <div className="room-info-block">
                 <h2 className="flex items-center gap-2">
                     {roomConfig?.topicName || initialRoom.topicName}
                     {initialRoom.isCustom ? <Server size={14} color="var(--accent)" /> : roomConfig && (roomConfig.isPublic ? <Globe size={14} color="var(--accent)" /> : <Lock size={14} color="var(--text-secondary)" />)}
                 </h2>
                 <div className="room-subtitle">
                    <span>ID: {initialRoom.id}</span>
                    <button onClick={handleCopyLink} className="btn-icon" style={{ padding: '0 4px', width: 'auto', height: 'auto' }} title="点击复制链接">{isCopied ? <Check size={12} color="#4caf50" /> : <Copy size={12} color="var(--text-secondary)" />}</button>
                 </div>
             </div>
        </div>
        <div className="flex items-center gap-2">
             <button onClick={(e) => { e.stopPropagation(); setShowUserList(true); }} className="btn-icon" style={{ backgroundColor: 'var(--bg-input)', borderRadius: '99px', padding: '6px 12px', gap: '6px', fontSize: '14px', width: 'auto' }}>
                 <Users size={16} /> <span>{onlineUsers.size}</span>
             </button>
             {!initialRoom.isCustom && (
                 <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} className="btn-icon" title="设置"><Settings size={20} /></button>
             )}
             <button onClick={handleLeaveClick} className="btn-icon" style={{ color: '#ef5350' }} title="退出房间"><LogOut size={20} /></button>
        </div>
      </header>

      {globalContextMenu && <div className="context-menu animate-fade-in" style={{ top: globalContextMenu.y, left: globalContextMenu.x }}><button onClick={() => setMessages([])} className="context-menu-item"><Trash2 size={16} /> 清空屏幕 (F8)</button></div>}
      
      {msgContextMenu && (
          <div className="context-menu animate-fade-in" style={{ top: msgContextMenu.y + 2, left: msgContextMenu.x + 2, transform: `translate(${msgContextMenu.x > window.innerWidth * 0.5 ? '-100%' : '0'}, ${msgContextMenu.y > window.innerHeight * 0.5 ? '-100%' : '0'})` }} onClick={(e) => e.stopPropagation()}>
             <div style={{ padding: '8px', display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{["👍", "❤️", "😂", "😮", "😡", "🎉"].map(emoji => (<button key={emoji} onClick={() => { sendReaction(msgContextMenu.message.id, emoji); setMsgContextMenu(null); }} className="btn-icon" style={{ fontSize: '18px', padding: '4px', width: '28px', height: '28px' }}>{emoji}</button>))}</div>
              <button className="context-menu-item" onClick={() => { setReplyingTo(msgContextMenu.message); setMsgContextMenu(null); }}><Reply size={14} /> 引用回复</button>
              <button className="context-menu-item" onClick={() => { const text = msgContextMenu.message.content || ""; navigator.clipboard.writeText(text); setMsgContextMenu(null); }}><Copy size={14} /> 复制内容</button>
              {msgContextMenu.message.imageUrl && (<button className="context-menu-item" onClick={() => { window.open(msgContextMenu.message.imageUrl, '_blank'); setMsgContextMenu(null); }}><Download size={14} /> 查看原图</button>)}
              <div style={{ height: '1px', backgroundColor: 'var(--bg-hover)', margin: '4px 8px', opacity: 0.5 }} /><button className="context-menu-item" style={{ color: '#ef5350' }} onClick={() => { handleDeleteLocal(msgContextMenu.message.id); setMsgContextMenu(null); }}><Trash2 size={14} /> 删除 (本地)</button>
          </div>
      )}

      {showSettings && roomConfig && (
          <div onClick={e => e.stopPropagation()} className="settings-popup animate-bounce-in">
              <h3 style={{ fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', marginTop: 0 }}><Settings size={20} /> 房间设置</h3>
              <div className="flex flex-col gap-4">
                  <div style={{ backgroundColor: 'var(--bg-input)', padding: '16px', borderRadius: '12px' }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>隐私模式</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 'bold' }}>{roomConfig.isPublic ? <Globe size={20} color="#4caf50"/> : <Lock size={20} color="#fdd835"/>} {roomConfig.isPublic ? "公开房间" : "私密房间"}</div>
                  </div>
                  {!activeVote ? (<button onClick={() => startVote(!roomConfig.isPublic)} className="btn-primary" style={{ width: '100%', fontSize: '14px', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>申请更改为 {roomConfig.isPublic ? '私密' : '公开'}</button>) : (<div style={{ padding: '12px', backgroundColor: 'rgba(138,180,248,0.1)', border: '1px solid rgba(138,180,248,0.2)', borderRadius: '12px', fontSize: '12px', color: 'var(--accent)', textAlign: 'center' }}>正在进行变更投票...</div>)}
                  <div style={{ paddingTop: '16px', borderTop: '1px solid var(--bg-hover)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}><span>房主: {roomConfig.createdBy}</span><span>{new Date(roomConfig.createdAt).toLocaleDateString()}</span></div>
              </div>
          </div>
      )}

      {activeVote && (
          <div className="vote-overlay animate-bounce-in">
              <div className="flex justify-between items-start" style={{ marginBottom: '16px' }}>
                <h4 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', margin: 0 }}><ShieldAlert color="var(--accent)" size={24} /> 变更请求</h4>
                <div className="badge" style={{ backgroundColor: 'rgba(138,180,248,0.1)', color: 'var(--accent)', gap: '4px', fontFamily: 'monospace' }}><Clock size={14} /> {voteTimeLeft}s</div>
              </div>
              <div style={{ width: '100%', backgroundColor: 'var(--bg-hover)', height: '6px', borderRadius: '99px', marginBottom: '16px', overflow: 'hidden' }}><div style={{ backgroundColor: 'var(--accent)', height: '100%', width: `${(voteTimeLeft / 60) * 100}%`, transition: 'width 1s linear' }} /></div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>有用户请求将当前房间更改为 <strong style={{ margin: '0 4px', padding: '2px 6px', backgroundColor: 'var(--bg-hover)', borderRadius: '4px', color: 'white' }}>{activeVote.targetState ? '公开' : '私密'}</strong> 状态。</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '12px' }}><span>同意人数: {activeVote.votes.size} / {onlineUsers.size}</span>{activeVote.votes.has(user.clientId) && <span style={{ color: '#4caf50', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={12}/> 已投票</span>}</div>
              {!activeVote.votes.has(user.clientId) && (<div className="flex gap-4"><button onClick={() => castVote('agree')} className="btn-primary flex-1" style={{ backgroundColor: '#2e7d32', color: 'white' }}><Check size={18} /> 同意</button><button onClick={() => castVote('veto')} className="btn-primary flex-1" style={{ backgroundColor: '#c62828', color: 'white' }}><X size={18} /> 否决</button></div>)}
          </div>
      )}

      {showUserList && (
          <div className="modal-overlay animate-fade-in" onClick={() => setShowUserList(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '20px', borderBottom: '1px solid var(--bg-hover)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem' }}><Users size={20}/> 在线用户 ({onlineUsers.size})</h3><button onClick={() => setShowUserList(false)} className="btn-icon"><X size={24}/></button></div>
                  <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                      {Array.from(onlineUsers.values()).map((u: OnlineUser) => (
                          <div key={u.clientId} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', borderRadius: '12px', marginBottom: '8px' }} className="room-list-item">
                              <div className="avatar">{u.avatarBase64 ? (<img src={u.avatarBase64} alt={u.username} />) : (<div className="avatar-placeholder">{u.username.substring(0, 1).toUpperCase()}</div>)}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="flex justify-between items-center" style={{ marginBottom: '4px' }}><p style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>{u.username} {u.vipCode && <span className="badge" style={{ backgroundColor: '#ffd700', color: 'black' }}>VIP</span>} {u.clientId === user.clientId && <span className="badge badge-me">ME</span>}</p>{Date.now() - u.lastSeen < 12000 ? (<div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4caf50', boxShadow: '0 0 8px #4caf50' }} title="Online" />) : (<div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fdd835' }} title="Idle" />)}</div>
                                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', opacity: 0.6, margin: 0 }}>{u.clientId}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {viewingImage && <ImageLightbox src={viewingImage} onClose={() => setViewingImage(null)} />}

      <div className="message-area custom-scrollbar" ref={containerRef} onScroll={handleScroll} onContextMenu={handleGlobalContextMenu}>
        <div style={{ flex: 1 }} />
        {messages.length === 0 && (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', margin: '40px 0', opacity: 0.5, userSelect: 'none' }}><div style={{ width: '64px', height: '64px', borderRadius: '24px', backgroundColor: 'var(--bg-input)', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={32} /></div><p style={{ fontSize: '14px' }}>房间已就绪，开始聊天吧</p></div>)}
        {messages.map((msg) => (<MessageBubble key={msg.id} message={msg} isMe={msg.senderId === user.clientId} senderProfile={onlineUsers.get(msg.senderId)} currentUsername={user.username} onReply={setReplyingTo} onReact={sendReaction} onDeleteLocal={handleDeleteLocal} onScrollToMessage={scrollToMessage} onContextMenu={handleMessageContextMenu} onMention={(name) => setInsertTextRequest({ text: `@${name} `, id: Date.now() })} onViewImage={setViewingImage} />))}
        <div ref={messagesEndRef} />
        {!isNearBottom && (<div style={{ position: 'sticky', bottom: '10px', display: 'flex', justifyContent: 'center', width: '100%', pointerEvents: 'none', zIndex: 10 }}><button onClick={() => scrollToBottom(true)} className="animate-bounce-in" style={{ pointerEvents: 'auto', backgroundColor: 'var(--accent)', color: '#202124', border: 'none', borderRadius: '24px', padding: '8px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}><ArrowDown size={16} />{unreadCount > 0 ? `${unreadCount} 条新消息` : '回到底部'}</button></div>)}
      </div>

      <InputArea onSendMessage={sendMessage} replyingTo={replyingTo ? { id: replyingTo.id, content: getMessageSummary(replyingTo), username: replyingTo.senderUsername } : null} onCancelReply={() => setReplyingTo(null)} insertText={insertTextRequest} />
    </div>
  );
};
