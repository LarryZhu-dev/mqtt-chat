import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, PresencePayload, Reaction, RoomInfo, UserProfile, RoomConfig, VotePayload, OnlineUser } from '../types';
import { MqttService } from '../services/mqttService';
import { generateUUID } from '../utils/helpers';
import { InputArea } from './InputArea';
import { MessageBubble } from './MessageBubble';
import { LogOut, Trash2, Users, Settings, Lock, Globe, Check, X, ShieldAlert, Wifi, WifiOff, Clock, Copy } from 'lucide-react';

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

const HEARTBEAT_INTERVAL = 10000;
const PRUNE_TIMEOUT = 25000;
const VOTE_TIMEOUT = 60000;

export const ChatRoom: React.FC<ChatRoomProps> = ({ user, room: initialRoom, onLeave }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  
  const [isCopied, setIsCopied] = useState(false);
  const [globalContextMenu, setGlobalContextMenu] = useState<{x: number, y: number} | null>(null);

  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeVote, setActiveVote] = useState<ActiveVoteState | null>(null);
  const [voteTimeLeft, setVoteTimeLeft] = useState(0);

  const mqttRef = useRef<MqttService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const activeVoteRef = useRef(activeVote);
  const onlineUsersRef = useRef(onlineUsers);
  const roomConfigRef = useRef(roomConfig);

  const offlineQueueRef = useRef<ChatMessage[]>([]);

  useEffect(() => { activeVoteRef.current = activeVote; }, [activeVote]);
  useEffect(() => { onlineUsersRef.current = onlineUsers; }, [onlineUsers]);
  useEffect(() => { roomConfigRef.current = roomConfig; }, [roomConfig]);

  useEffect(() => {
    const service = new MqttService(user.clientId);
    mqttRef.current = service;

    service.setCallbacks({
      onConnectionChange: (connected) => {
          setIsConnected(connected);
          if (connected && offlineQueueRef.current.length > 0) {
              offlineQueueRef.current.forEach(msg => {
                  service.sendMessage(initialRoom.id, msg);
              });
              offlineQueueRef.current = [];
          }
      },
      onMessage: (msg) => {
        setMessages(prev => {
           if (prev.some(m => m.id === msg.id)) return prev;
           return [...prev, msg];
        });
        setTimeout(scrollToBottom, 100);
      },
      onPresence: (payload) => {
        setOnlineUsers(prev => {
             const newMap = new Map(prev);
             if (payload.type === 'leave') {
                 newMap.delete(payload.user.clientId);
             } else {
                 newMap.set(payload.user.clientId, { 
                     ...payload.user, 
                     lastSeen: Date.now() 
                 });
             }
             return newMap;
         });
      },
      onReaction: (data) => {
        handleReaction(data.targetId, data.reaction);
      },
      onConfigUpdate: (config) => {
          setRoomConfig(config);
      },
      onVote: (payload) => {
          handleVoteSignal(payload, activeVoteRef.current, onlineUsersRef.current, roomConfigRef.current);
      },
      onRoomListUpdate: () => {}
    });

    const lwtPayload = JSON.stringify({
        type: 'leave',
        user: user,
        roomId: initialRoom.id
    });

    service.connect(() => {
      service.joinRoom(initialRoom.id);
      const presence: PresencePayload = {
          type: 'join',
          user: user,
          roomId: initialRoom.id
      };
      service.sendPresence(initialRoom.id, presence);
      
      setTimeout(() => {
          setRoomConfig(prev => {
              if (!prev) {
                  const newConfig: RoomConfig = {
                      isPublic: initialRoom.isPublic,
                      topicName: initialRoom.topicName,
                      createdBy: user.username,
                      createdAt: Date.now()
                  };
                  service.publishRoomConfig(initialRoom.id, newConfig);
                  return newConfig;
              }
              return prev;
          });
      }, 1000);
    }, {
        topic: `darkmqtt/room/${initialRoom.id}/presence`,
        payload: lwtPayload
    });

    return () => {
      if (mqttRef.current) mqttRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
      const interval = setInterval(() => {
          const now = Date.now();
          if (mqttRef.current && isConnected) {
             const hb: PresencePayload = { type: 'heartbeat', user, roomId: initialRoom.id };
             mqttRef.current.sendPresence(initialRoom.id, hb);

             setOnlineUsers(prev => {
                const me = prev.get(user.clientId);
                if (me) {
                    const next = new Map<string, OnlineUser>(prev);
                    next.set(user.clientId, { ...me, lastSeen: now });
                    return next;
                }
                return prev;
             });

             if (roomConfig?.isPublic) {
                 mqttRef.current.updatePublicRoomListing(
                     initialRoom.id, 
                     roomConfig.topicName, 
                     onlineUsers.size || 1
                 );
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

      return () => {
          clearInterval(interval);
      };
  }, [isConnected, initialRoom.id, user, roomConfig, onlineUsers.size]);

  useEffect(() => {
      if (!activeVote) {
          setVoteTimeLeft(0);
          return;
      }
      const checkInterval = setInterval(() => {
          const elapsed = Date.now() - activeVote.timestamp;
          const left = Math.max(0, Math.ceil((VOTE_TIMEOUT - elapsed) / 1000));
          setVoteTimeLeft(left);

          if (elapsed > VOTE_TIMEOUT) {
              if (activeVote.initiatorId === user.clientId) {
                  const newConfig = { ...roomConfigRef.current!, isPublic: activeVote.targetState };
                  mqttRef.current?.publishRoomConfig(initialRoom.id, newConfig);
                  if (!newConfig.isPublic) {
                      mqttRef.current?.clearPublicRoomListing(initialRoom.id);
                  }
                  setActiveVote(null);
              } else {
                   setActiveVote(null);
              }
          }
      }, 1000);
      return () => clearInterval(checkInterval);
  }, [activeVote, user.clientId, initialRoom.id]);


  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        setMessages([]);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleCopyLink = () => {
      const url = new URL(window.location.href);
      url.searchParams.set('room', initialRoom.id);
      
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
          return {
              ...msg,
              reactions: {
                  ...msg.reactions,
                  [reaction.emoji]: [...currentReactions, reaction]
              }
          };
      }));
  };

  const handleVoteSignal = (
      payload: VotePayload, 
      currentVote: ActiveVoteState | null, 
      currentUsers: Map<string, UserProfile>,
      currentConfig: RoomConfig | null
  ) => {
      if (payload.type === 'proposal') {
          setActiveVote({
              id: payload.voteId,
              targetState: payload.targetState!,
              votes: new Map(),
              initiatorId: payload.initiatorId!,
              timestamp: payload.timestamp || Date.now()
          });
      } else if (payload.type === 'ballot' && currentVote && payload.voteId === currentVote.id) {
          if (payload.decision === 'veto') {
              setActiveVote(null);
              return;
          }

          const newVotes = new Map(currentVote.votes);
          newVotes.set(payload.voterId!, true);
          setActiveVote(prev => prev ? { ...prev, votes: newVotes } : null);

          if (newVotes.size >= currentUsers.size) {
             if (currentVote.initiatorId === user.clientId) {
                 const newConfig = { ...currentConfig!, isPublic: currentVote.targetState };
                 mqttRef.current?.publishRoomConfig(initialRoom.id, newConfig);
                 if (!newConfig.isPublic) {
                     mqttRef.current?.clearPublicRoomListing(initialRoom.id);
                 }
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

    const newMsg: ChatMessage = {
      id: generateUUID(),
      type: type,
      content: text, 
      imageUrl: imageBase64, 
      senderId: user.clientId,
      senderUsername: user.username,
      timestamp: Date.now(),
      replyToId: replyingTo?.id,
      replyToSummary: replySummary,
      reactions: {}
    };

    if (isConnected && mqttRef.current) {
        mqttRef.current.sendMessage(initialRoom.id, newMsg);
    } else {
        offlineQueueRef.current.push(newMsg);
        setMessages(prev => [...prev, newMsg]);
    }
    setReplyingTo(null);
  };

  const sendReaction = (msgId: string, emoji: string) => {
      if (!mqttRef.current) return;
      const reaction: Reaction = { emoji, fromClientId: user.clientId, fromUsername: user.username, timestamp: Date.now() };
      mqttRef.current.sendReaction(initialRoom.id, msgId, reaction);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const handleDeleteLocal = (id: string) => {
      setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleLeaveClick = () => {
      if (mqttRef.current) {
          const leavePayload: PresencePayload = { type: 'leave', user: user, roomId: initialRoom.id };
          mqttRef.current.sendPresence(initialRoom.id, leavePayload);
          
          if (onlineUsers.size <= 1 && roomConfig?.isPublic) {
              mqttRef.current.clearPublicRoomListing(initialRoom.id);
          }
          
          mqttRef.current.leaveRoom(initialRoom.id);
      }
      onLeave();
  };

  const startVote = (targetState: boolean) => {
      if (!mqttRef.current) return;
      const voteId = generateUUID();
      const payload: VotePayload = {
          type: 'proposal',
          voteId,
          action: 'toggle_privacy',
          targetState,
          initiatorId: user.clientId,
          timestamp: Date.now()
      };
      mqttRef.current.sendVote(initialRoom.id, payload);
  };

  const castVote = (decision: 'agree' | 'veto') => {
      if (!mqttRef.current || !activeVote) return;
      const payload: VotePayload = {
          type: 'ballot',
          voteId: activeVote.id,
          action: 'toggle_privacy',
          voterId: user.clientId,
          decision
      };
      mqttRef.current.sendVote(initialRoom.id, payload);
  };

  const handleGlobalContextMenu = (e: React.MouseEvent) => {
      if (e.target === containerRef.current) {
          e.preventDefault();
          setGlobalContextMenu({ x: e.clientX, y: e.clientY });
      }
  };

  useEffect(() => {
      const handleClick = () => {
          setGlobalContextMenu(null);
          setShowSettings(false);
      };
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="chat-layout animate-fade-in">
      {/* Header */}
      <header className="chat-header">
        <div className="flex items-center gap-4 overflow-hidden">
             <div className="flex items-center justify-center" style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-input)' }}>
                {isConnected ? <Wifi size={18} color="#4caf50" /> : <WifiOff size={18} color="#ef5350" />}
             </div>

             <div className="flex flex-col justify-center overflow-hidden">
                 <h2 className="flex items-center gap-2">
                     {roomConfig?.topicName || initialRoom.topicName}
                     {roomConfig && (
                         roomConfig.isPublic ? <Globe size={14} color="var(--accent)" /> : <Lock size={14} color="var(--text-secondary)" />
                     )}
                 </h2>
                 <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', display: 'flex', gap: '8px' }}>
                    <span>ID: {initialRoom.id}</span>
                    <button 
                        onClick={handleCopyLink}
                        className="btn-icon"
                        style={{ padding: '0 4px', width: 'auto', height: 'auto' }}
                        title="点击复制链接"
                    >
                         {isCopied ? <Check size={12} color="#4caf50" /> : <Copy size={12} color="var(--text-secondary)" />}
                    </button>
                 </div>
             </div>
        </div>
        
        <div className="flex items-center gap-2">
             <button 
                onClick={(e) => { e.stopPropagation(); setShowUserList(true); }}
                className="btn-icon"
                style={{ backgroundColor: 'var(--bg-input)', borderRadius: '99px', padding: '6px 12px', gap: '6px', fontSize: '14px', width: 'auto' }}
             >
                 <Users size={16} />
                 <span>{onlineUsers.size}</span>
             </button>
             
             <button
                onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                className="btn-icon"
                title="设置"
             >
                 <Settings size={20} />
             </button>

             <button 
                onClick={handleLeaveClick} 
                className="btn-icon"
                style={{ color: '#ef5350' }}
                title="退出房间"
             >
                 <LogOut size={20} />
             </button>
        </div>
      </header>

      {/* Global Context Menu */}
      {globalContextMenu && (
          <div 
             className="context-menu animate-fade-in"
             style={{ top: globalContextMenu.y, left: globalContextMenu.x }}
          >
              <button 
                 onClick={() => setMessages([])}
                 className="context-menu-item"
              >
                  <Trash2 size={16} /> 清空屏幕 (F8)
              </button>
          </div>
      )}

      {/* Settings Modal */}
      {showSettings && roomConfig && (
          <div 
            onClick={e => e.stopPropagation()}
            className="settings-popup animate-bounce-in"
          >
              <h3 style={{ fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', marginTop: 0 }}>
                  <Settings size={20} /> 房间设置
              </h3>
              
              <div className="flex flex-col gap-4">
                  <div style={{ backgroundColor: 'var(--bg-input)', padding: '16px', borderRadius: '12px' }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>隐私模式</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 'bold' }}>
                          {roomConfig.isPublic ? <Globe size={20} color="#4caf50"/> : <Lock size={20} color="#fdd835"/>}
                          {roomConfig.isPublic ? "公开房间" : "私密房间"}
                      </div>
                  </div>

                  {!activeVote ? (
                      <button 
                        onClick={() => startVote(!roomConfig.isPublic)}
                        className="btn-primary"
                        style={{ width: '100%', fontSize: '14px', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                      >
                          申请更改为 {roomConfig.isPublic ? '私密' : '公开'}
                      </button>
                  ) : (
                      <div style={{ padding: '12px', backgroundColor: 'rgba(138,180,248,0.1)', border: '1px solid rgba(138,180,248,0.2)', borderRadius: '12px', fontSize: '12px', color: 'var(--accent)', textAlign: 'center' }}>
                          正在进行变更投票...
                      </div>
                  )}

                  <div style={{ paddingTop: '16px', borderTop: '1px solid var(--bg-hover)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>房主: {roomConfig.createdBy}</span>
                      <span>{new Date(roomConfig.createdAt).toLocaleDateString()}</span>
                  </div>
              </div>
          </div>
      )}

      {/* Voting Overlay */}
      {activeVote && (
          <div className="vote-overlay animate-bounce-in">
              <div className="flex justify-between items-start" style={{ marginBottom: '16px' }}>
                <h4 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', margin: 0 }}>
                    <ShieldAlert color="var(--accent)" size={24} /> 
                    变更请求
                </h4>
                <div className="badge" style={{ backgroundColor: 'rgba(138,180,248,0.1)', color: 'var(--accent)', gap: '4px', fontFamily: 'monospace' }}>
                    <Clock size={14} /> {voteTimeLeft}s
                </div>
              </div>

              <div style={{ width: '100%', backgroundColor: 'var(--bg-hover)', height: '6px', borderRadius: '99px', marginBottom: '16px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: 'var(--accent)', height: '100%', width: `${(voteTimeLeft / 60) * 100}%`, transition: 'width 1s linear' }} />
              </div>

              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
                  有用户请求将当前房间更改为 
                  <strong style={{ margin: '0 4px', padding: '2px 6px', backgroundColor: 'var(--bg-hover)', borderRadius: '4px', color: 'white' }}>{activeVote.targetState ? '公开' : '私密'}</strong>
                  状态。
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '12px' }}>
                 <span>同意人数: {activeVote.votes.size} / {onlineUsers.size}</span>
                 {activeVote.votes.has(user.clientId) && <span style={{ color: '#4caf50', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={12}/> 已投票</span>}
              </div>

              {!activeVote.votes.has(user.clientId) && (
                  <div className="flex gap-4">
                      <button 
                        onClick={() => castVote('agree')}
                        className="btn-primary flex-1"
                        style={{ backgroundColor: '#2e7d32', color: 'white' }}
                      >
                          <Check size={18} /> 同意
                      </button>
                      <button 
                        onClick={() => castVote('veto')}
                        className="btn-primary flex-1"
                        style={{ backgroundColor: '#c62828', color: 'white' }}
                      >
                          <X size={18} /> 否决
                      </button>
                  </div>
              )}
          </div>
      )}

      {/* User List Modal */}
      {showUserList && (
          <div className="modal-overlay animate-fade-in" onClick={() => setShowUserList(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <div style={{ padding: '20px', borderBottom: '1px solid var(--bg-hover)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1rem' }}><Users size={20}/> 在线用户 ({onlineUsers.size})</h3>
                      <button onClick={() => setShowUserList(false)} className="btn-icon"><X size={24}/></button>
                  </div>
                  <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                      {Array.from(onlineUsers.values()).map((u: OnlineUser) => (
                          <div key={u.clientId} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', borderRadius: '12px', marginBottom: '8px' }} className="room-list-item">
                              <div className="avatar">
                                  {u.avatarBase64 ? (
                                      <img src={u.avatarBase64} alt={u.username} />
                                  ) : (
                                      <div className="avatar-placeholder">
                                          {u.username.substring(0, 1).toUpperCase()}
                                      </div>
                                  )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="flex justify-between items-center" style={{ marginBottom: '4px' }}>
                                      <p style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                          {u.username}
                                          {u.clientId === user.clientId && <span className="badge badge-me">ME</span>}
                                      </p>
                                      {Date.now() - u.lastSeen < 12000 ? (
                                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4caf50', boxShadow: '0 0 8px #4caf50' }} title="Online" />
                                      ) : (
                                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#fdd835' }} title="Idle" />
                                      )}
                                  </div>
                                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', opacity: 0.6, margin: 0 }}>{u.clientId}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Messages Area */}
      <div 
        className="message-area custom-scrollbar" 
        ref={containerRef} 
        onContextMenu={handleGlobalContextMenu}
      >
        <div style={{ flex: 1 }} />
        {messages.length === 0 && (
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', margin: '40px 0', opacity: 0.5, userSelect: 'none' }}>
                 <div style={{ width: '64px', height: '64px', borderRadius: '24px', backgroundColor: 'var(--bg-input)', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Globe size={32} />
                 </div>
                 <p style={{ fontSize: '14px' }}>房间已就绪，开始聊天吧</p>
             </div>
        )}
        {messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            isMe={msg.senderId === user.clientId}
            senderProfile={onlineUsers.get(msg.senderId)}
            onReply={setReplyingTo}
            onReact={sendReaction}
            onDeleteLocal={handleDeleteLocal}
            onScrollToMessage={scrollToMessage}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <InputArea 
        onSendMessage={sendMessage} 
        replyingTo={replyingTo ? { 
            id: replyingTo.id, 
            content: getMessageSummary(replyingTo), 
            username: replyingTo.senderUsername 
        } : null}
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  );
};