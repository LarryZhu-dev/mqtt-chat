
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
const PRUNE_TIMEOUT = 25000; // If no heartbeat for 25s, remove user
const VOTE_TIMEOUT = 60000; // 60s to vote

export const ChatRoom: React.FC<ChatRoomProps> = ({ user, room: initialRoom, onLeave }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Use OnlineUser type which tracks lastSeen
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  
  // Header state
  const [isCopied, setIsCopied] = useState(false);
  
  // Global Context Menu
  const [globalContextMenu, setGlobalContextMenu] = useState<{x: number, y: number} | null>(null);

  // Room Config & Voting State
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeVote, setActiveVote] = useState<ActiveVoteState | null>(null);
  const [voteTimeLeft, setVoteTimeLeft] = useState(0);

  const mqttRef = useRef<MqttService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Fix Stale Closures in MQTT Callbacks
  const activeVoteRef = useRef(activeVote);
  const onlineUsersRef = useRef(onlineUsers);
  const roomConfigRef = useRef(roomConfig);

  // Offline Message Queue
  const offlineQueueRef = useRef<ChatMessage[]>([]);

  // Sync Refs
  useEffect(() => { activeVoteRef.current = activeVote; }, [activeVote]);
  useEffect(() => { onlineUsersRef.current = onlineUsers; }, [onlineUsers]);
  useEffect(() => { roomConfigRef.current = roomConfig; }, [roomConfig]);

  // Initialize MQTT
  useEffect(() => {
    const service = new MqttService(user.clientId);
    mqttRef.current = service;

    service.setCallbacks({
      onConnectionChange: (connected) => {
          setIsConnected(connected);
          // Flush offline queue when reconnected
          if (connected && offlineQueueRef.current.length > 0) {
              console.log(`Flushing ${offlineQueueRef.current.length} buffered messages...`);
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
                 // Update or Add user with current timestamp
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
          // Use Refs to access current state inside this stable callback
          handleVoteSignal(payload, activeVoteRef.current, onlineUsersRef.current, roomConfigRef.current);
      },
      onRoomListUpdate: () => {}
    });

    // Configure Last Will and Testament (LWT)
    // If we disconnect ungracefully, the broker will publish this 'leave' message
    const lwtPayload = JSON.stringify({
        type: 'leave',
        user: user,
        roomId: initialRoom.id
    });

    service.connect(() => {
      // 1. Join Room Topics
      service.joinRoom(initialRoom.id);
      
      // 2. Announce Join (Carries Avatar)
      const presence: PresencePayload = {
          type: 'join',
          user: user,
          roomId: initialRoom.id
      };
      service.sendPresence(initialRoom.id, presence);
      
      // 3. Handle Initial Config
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Heartbeat & Lobby Sync & User Pruning
  useEffect(() => {
      const interval = setInterval(() => {
          const now = Date.now();

          // 1. Send Heartbeat
          if (mqttRef.current && isConnected) {
             const hb: PresencePayload = { type: 'heartbeat', user, roomId: initialRoom.id };
             mqttRef.current.sendPresence(initialRoom.id, hb);

             // Update myself in my own list to prevent self-pruning
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

          // 2. Prune Ghost Users (Client-side cleanup)
          setOnlineUsers(prev => {
              let changed = false;
              const next = new Map<string, OnlineUser>(prev);
              next.forEach((u, key) => {
                  // If user hasn't been seen for PRUNE_TIMEOUT, remove them
                  if (now - u.lastSeen > PRUNE_TIMEOUT) {
                      console.log(`Pruning ghost user: ${u.username} (${key})`);
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

  // Vote Timeout Logic
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
                  console.log("Vote timeout - Defaulting to PASS");
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


  // Keyboard Shortcuts (F8 Clear)
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

  // --- Logic Handlers ---

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
        
        replySummary = {
            username: replyingTo.senderUsername,
            content: content
        };
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
          el.classList.add('bg-accent/20');
          setTimeout(() => el.classList.remove('bg-accent/20'), 1000);
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
    <div className="flex flex-col h-screen bg-chrome-900 overflow-hidden relative animate-fade-in">
      {/* Header */}
      <header className="flex-shrink-0 bg-chrome-800/90 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-md z-20 transition-all">
        <div className="flex items-center gap-4 overflow-hidden">
             <div className="flex items-center justify-center w-8 h-8 rounded-full bg-chrome-600">
                {isConnected ? (
                     <Wifi size={16} className="text-green-400" />
                 ) : (
                     <WifiOff size={16} className="text-red-500" />
                 )}
             </div>

             <div className="min-w-0 flex flex-col justify-center">
                 <h2 className="font-bold text-chrome-100 truncate flex items-center gap-2 text-lg">
                     {roomConfig?.topicName || initialRoom.topicName}
                     {roomConfig && (
                         roomConfig.isPublic ? <Globe size={14} className="text-accent" /> : <Lock size={14} className="text-chrome-300" />
                     )}
                 </h2>
                 <div className="flex items-center gap-2 text-xs text-chrome-300 font-mono">
                    <span>ID: {initialRoom.id}</span>
                    <button 
                        onClick={handleCopyLink}
                        className="hover:text-accent transition-colors flex items-center gap-1 group relative"
                        title="点击复制链接"
                    >
                         {isCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    </button>
                 </div>
             </div>
        </div>
        
        <div className="flex items-center gap-3">
             <button 
                onClick={(e) => { e.stopPropagation(); setShowUserList(true); }}
                className="hidden sm:flex items-center gap-2 text-chrome-300 text-sm bg-chrome-600 hover:bg-chrome-700 px-3 py-1.5 rounded-full transition-all"
             >
                 <Users size={16} />
                 <span>{onlineUsers.size}</span>
             </button>
             
             <div className="h-6 w-px bg-chrome-600 mx-1"></div>

             <button
                onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                className="p-2 text-chrome-300 hover:text-accent transition hover:bg-chrome-700 rounded-full"
                title="设置"
             >
                 <Settings size={20} />
             </button>

             <button 
                onClick={handleLeaveClick} 
                className="p-2 text-chrome-300 hover:text-red-400 hover:bg-red-900/20 rounded-full transition flex items-center gap-2"
                title="退出房间"
             >
                 <LogOut size={20} />
             </button>
        </div>
      </header>

      {/* --- Modals & Overlays --- */}

      {/* Global Context Menu */}
      {globalContextMenu && (
          <div 
             className="fixed z-50 bg-chrome-800 rounded-lg shadow-2xl py-1 min-w-[140px] animate-fade-in border border-chrome-600"
             style={{ top: globalContextMenu.y, left: globalContextMenu.x }}
          >
              <button 
                 onClick={() => setMessages([])}
                 className="w-full px-4 py-2.5 hover:bg-chrome-700 text-left text-sm text-chrome-100 flex items-center gap-2"
              >
                  <Trash2 size={16} /> 清空屏幕 (F8)
              </button>
          </div>
      )}

      {/* 1. Settings Modal */}
      {showSettings && roomConfig && (
          <div 
            onClick={e => e.stopPropagation()}
            className="absolute top-20 right-6 z-50 w-80 bg-chrome-800/95 backdrop-blur shadow-2xl rounded-2xl p-5 animate-bounce-in"
          >
              <h3 className="text-chrome-100 font-bold mb-4 flex items-center gap-2 text-lg">
                  <Settings size={20} /> 房间设置
              </h3>
              
              <div className="space-y-5">
                  <div className="bg-chrome-600/30 p-4 rounded-xl">
                      <p className="text-xs text-chrome-300 mb-2 uppercase tracking-wide">隐私模式</p>
                      <div className="flex items-center gap-2 text-base font-medium text-chrome-100">
                          {roomConfig.isPublic ? <Globe size={20} className="text-green-400"/> : <Lock size={20} className="text-yellow-400"/>}
                          {roomConfig.isPublic ? "公开房间" : "私密房间"}
                      </div>
                  </div>

                  {!activeVote ? (
                      <button 
                        onClick={() => startVote(!roomConfig.isPublic)}
                        className="w-full py-3 bg-chrome-600 hover:bg-accent hover:text-chrome-900 text-chrome-100 text-sm font-medium rounded-xl transition-all shadow-sm"
                      >
                          申请更改为 {roomConfig.isPublic ? '私密' : '公开'}
                      </button>
                  ) : (
                      <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-xs text-accent text-center animate-pulse">
                          正在进行变更投票...
                      </div>
                  )}

                  <div className="pt-4 border-t border-chrome-600">
                      <div className="flex justify-between text-[11px] text-chrome-400">
                        <span>房主: {roomConfig.createdBy}</span>
                        <span>{new Date(roomConfig.createdAt).toLocaleDateString()}</span>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 2. Voting Overlay */}
      {activeVote && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-chrome-800/95 backdrop-blur border-2 border-accent shadow-[0_0_30px_rgba(138,180,248,0.2)] rounded-2xl p-6 w-96 animate-bounce-in">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-white flex items-center gap-2 text-lg">
                    <ShieldAlert className="text-accent" size={24} /> 
                    变更请求
                </h4>
                <div className="flex items-center gap-1.5 text-xs font-mono text-accent bg-accent/10 px-2.5 py-1 rounded-full">
                    <Clock size={14} /> {voteTimeLeft}s
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-chrome-700 h-1.5 rounded-full mb-4 overflow-hidden">
                  <div 
                    className="bg-accent h-full transition-all duration-1000 ease-linear shadow-[0_0_10px_#8ab4f8]"
                    style={{ width: `${(voteTimeLeft / 60) * 100}%` }}
                  />
              </div>

              <p className="text-sm text-chrome-300 mb-6 leading-relaxed">
                  有用户请求将当前房间更改为 
                  <strong className="text-white mx-1 px-1 bg-chrome-700 rounded">{activeVote.targetState ? '公开' : '私密'}</strong>
                  状态。
              </p>
              
              <div className="flex items-center justify-between text-xs text-chrome-400 mb-4 bg-chrome-900/50 p-3 rounded-xl border border-chrome-700/50">
                 <span>同意人数: {activeVote.votes.size} / {onlineUsers.size}</span>
                 {activeVote.votes.has(user.clientId) && <span className="text-green-400 font-bold flex items-center gap-1"><Check size={12}/> 已投票</span>}
              </div>

              {!activeVote.votes.has(user.clientId) && (
                  <div className="flex gap-3">
                      <button 
                        onClick={() => castVote('agree')}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/20"
                      >
                          <Check size={18} /> 同意
                      </button>
                      <button 
                        onClick={() => castVote('veto')}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/20"
                      >
                          <X size={18} /> 否决
                      </button>
                  </div>
              )}
          </div>
      )}

      {/* 3. User List Modal */}
      {showUserList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowUserList(false)}>
              <div className="bg-chrome-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b border-chrome-600 flex justify-between items-center bg-chrome-800">
                      <h3 className="font-bold text-chrome-100 flex items-center gap-2 text-lg"><Users size={20}/> 在线用户 ({onlineUsers.size})</h3>
                      <button onClick={() => setShowUserList(false)} className="text-chrome-400 hover:text-white transition"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-chrome-900">
                      {Array.from(onlineUsers.values()).map((u: OnlineUser) => (
                          <div key={u.clientId} className="flex items-center gap-4 p-3 rounded-xl hover:bg-chrome-800 transition">
                              <div className="w-12 h-12 rounded-full bg-chrome-700 overflow-hidden">
                                  {u.avatarBase64 ? (
                                      <img src={u.avatarBase64} alt={u.username} className="w-full h-full object-cover"/>
                                  ) : (
                                      <div className="w-full h-full flex items-center justify-center font-bold text-lg text-chrome-300">
                                          {u.username.substring(0, 1).toUpperCase()}
                                      </div>
                                  )}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-center mb-1">
                                      <p className="text-chrome-100 font-bold truncate pr-2 flex items-center gap-2">
                                          {u.username}
                                          {u.clientId === user.clientId && <span className="text-[10px] bg-accent text-chrome-900 px-1.5 py-0.5 rounded font-bold">ME</span>}
                                      </p>
                                      {Date.now() - u.lastSeen < 12000 ? (
                                          <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" title="Online" />
                                      ) : (
                                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" title="Idle" />
                                      )}
                                  </div>
                                  <p className="text-xs text-chrome-400 font-mono truncate opacity-60">{u.clientId}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Messages Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar flex flex-col bg-chrome-900" 
        ref={containerRef} 
        onContextMenu={handleGlobalContextMenu}
      >
        <div className="flex-1" />
        {messages.length === 0 && (
             <div className="flex flex-col items-center justify-center text-chrome-600 my-10 opacity-50 select-none">
                 <div className="w-16 h-16 rounded-2xl bg-chrome-800 mb-4 flex items-center justify-center">
                    <Globe size={32} />
                 </div>
                 <p className="text-sm">房间已就绪，开始聊天吧</p>
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
