
import React, { useState, useEffect } from 'react';
import { Lobby } from './components/Lobby';
import { ChatRoom } from './components/ChatRoom';
import { UserProfile, RoomInfo, PublicRoomPayload, BrokerConfig } from './types';
import { getStoredUser, saveUser, generateUUID, generateRandomUsername } from './utils/helpers';
import { MqttService } from './services/mqttService';
import { Crown, Check, X } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [publicRooms, setPublicRooms] = useState<RoomInfo[]>([]);
  const [urlBroker, setUrlBroker] = useState<BrokerConfig | null>(null);
  
  const [showVipInput, setShowVipInput] = useState(false);
  const [vipInputVal, setVipInputVal] = useState('');
  const [savedVipCode, setSavedVipCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    const sessionClientId = `web_${generateUUID()}`;
    const stored = getStoredUser();
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const brokerParam = params.get('b');

    let initUsername = stored?.username || '';
    if (!initUsername && roomParam) {
        initUsername = generateRandomUsername();
    }

    const user: UserProfile = {
        clientId: sessionClientId,
        username: initUsername,
        avatarBase64: stored?.avatarBase64 || null,
        avatarColor: stored?.avatarColor,
        vipCode: undefined
    };
    setCurrentUser(user);

    // Process Broker URL Param
    let brokerFromUrl: BrokerConfig | null = null;
    if (brokerParam) {
        try {
            brokerFromUrl = JSON.parse(atob(brokerParam));
            setUrlBroker(brokerFromUrl);
        } catch (e) {
            console.error("Failed to parse broker from URL", e);
        }
    }

    if (roomParam) {
        const roomId = roomParam.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
        if (roomId) {
            const room: RoomInfo = {
                id: roomId,
                topicName: roomId,
                isPublic: false,
                onlineCount: 0,
                lastActivity: Date.now(),
                isCustom: !!brokerFromUrl,
                customBroker: brokerFromUrl || undefined
            };
            // If it's a standard room (not custom), we can auto-join if we have basic user info
            // For custom rooms, we stay on Lobby to let them enter password if needed
            if (!brokerFromUrl) {
                setCurrentRoom(room);
            } else {
                // If it's custom, we set it in the Lobby state via urlBroker prop
            }
        }
    }

    const lobbyClient = new MqttService(`lobby_watcher_${Math.random().toString(16).substr(2, 8)}`);
    lobbyClient.setCallbacks({
        onRoomListUpdate: (payload: PublicRoomPayload) => {
            if (!payload || payload.userCount <= 0) {
                 setPublicRooms(prev => prev.filter(r => r.id !== payload.roomId));
            } else {
                 setPublicRooms(prev => {
                     const idx = prev.findIndex(r => r.id === payload.roomId);
                     const newRoom: RoomInfo = {
                         id: payload.roomId,
                         topicName: payload.topicName,
                         isPublic: true,
                         onlineCount: payload.userCount,
                         lastActivity: Date.now()
                     };
                     if (idx >= 0) {
                         const copy = [...prev];
                         copy[idx] = newRoom;
                         return copy;
                     }
                     return [...prev, newRoom];
                 });
            }
        },
        onConnectionChange: () => {},
        onMessage: () => {},
        onPresence: () => {},
        onReaction: () => {},
        onConfigUpdate: () => {},
        onVote: () => {}
    });

    lobbyClient.connect(() => {
        lobbyClient.subscribeToLobby();
    });

    return () => {
        lobbyClient.disconnect();
    };
  }, []);

  useEffect(() => {
    (window as any).VIPA = () => {
        setShowVipInput(true);
        console.log("%c 欢迎，尊贵的 VIP ", "background: #ffd700; color: #000; font-size: 20px; font-weight: bold; padding: 4px; border-radius: 4px;");
    };
  }, []);

  useEffect(() => {
      if (currentUser && savedVipCode !== currentUser.vipCode) {
          setCurrentUser(prev => prev ? ({ ...prev, vipCode: savedVipCode }) : null);
      }
  }, [savedVipCode]);

  const handleVipSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const code = vipInputVal.trim();
      if (code === '995231030' || code === 'xiaozuotvt') {
          setSavedVipCode(code);
          alert("VIP 身份已激活。特效将在特定场景触发。");
          setShowVipInput(false);
      } else {
          alert("无效的口令");
      }
  };

  const handleJoin = (user: UserProfile, room: RoomInfo, saveOptions: { saveUsername: boolean; saveAvatar: boolean }) => {
    const stored = getStoredUser() || {};
    saveUser({ 
        username: saveOptions.saveUsername ? user.username : stored.username, 
        avatarBase64: saveOptions.saveAvatar ? user.avatarBase64 : stored.avatarBase64,
        avatarColor: saveOptions.saveAvatar ? user.avatarColor : stored.avatarColor
    });
    const finalUser = { ...user, vipCode: savedVipCode };
    setCurrentUser(finalUser);
    setCurrentRoom(room);
  };

  const handleLeave = () => {
    setCurrentRoom(null);
    window.history.pushState({}, '', window.location.pathname);
  };

  return (
    <>
        {currentRoom && currentUser ? (
            <ChatRoom user={currentUser} room={currentRoom} onLeave={handleLeave} />
        ) : (
            <Lobby 
                initialUser={currentUser} 
                onJoin={handleJoin} 
                publicRooms={publicRooms}
                urlBroker={urlBroker}
            />
        )}

        {showVipInput && (
            <div className="modal-overlay animate-fade-in" onClick={() => setShowVipInput(false)}>
                <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '24px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <Crown size={48} color="#ffd700" style={{ marginBottom: '16px' }} />
                        <h2 style={{ margin: 0, color: '#ffd700' }}>欢迎，尊贵的 VIP</h2>
                        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>请输入专属口令激活特权</p>
                    </div>
                    <form onSubmit={handleVipSubmit}>
                        <input 
                            type="password"
                            value={vipInputVal}
                            onChange={e => setVipInputVal(e.target.value)}
                            placeholder="在此输入口令..."
                            className="styled-input"
                            autoFocus
                            style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px' }}
                        />
                        <div className="flex gap-4" style={{ marginTop: '20px' }}>
                            <button type="button" onClick={() => setShowVipInput(false)} className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                                <X size={20} /> 取消
                            </button>
                            <button type="submit" className="btn-primary" style={{ flex: 1, backgroundColor: '#ffd700', color: 'black' }}>
                                <Check size={20} /> 激活
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </>
  );
};

export default App;
