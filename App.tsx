
import React, { useState, useEffect } from 'react';
import { Lobby } from './components/Lobby';
import { ChatRoom } from './components/ChatRoom';
import { UserProfile, RoomInfo, PublicRoomPayload } from './types';
import { getStoredUser, saveUser, generateUUID, generateShortId } from './utils/helpers';
import { MqttService } from './services/mqttService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [publicRooms, setPublicRooms] = useState<RoomInfo[]>([]);
  
  // Initialize User & Check URL Params
  useEffect(() => {
    // 1. Ensure Unique Client ID for this session (Fixes multi-window issue)
    const sessionClientId = `web_${generateUUID()}`;
    const stored = getStoredUser();
    
    // Merge stored profile with new ClientID
    const user: UserProfile = {
        clientId: sessionClientId,
        username: stored?.username || `User_${generateShortId(4)}`,
        avatarBase64: stored?.avatarBase64 || null
    };
    setCurrentUser(user);

    // 2. Check URL Params for Auto-Join (?room=xyz)
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
        const roomId = roomParam.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
        if (roomId) {
            const room: RoomInfo = {
                id: roomId,
                topicName: roomId, // Default topic name
                isPublic: false, // Default to Private for URL-based joins for better privacy
                onlineCount: 0,
                lastActivity: Date.now()
            };
            setCurrentRoom(room);
        }
    }

    // 3. Lobby Watcher
    // We use a temporary anonymous client just for the lobby list
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

    // Connect without LWT for lobby listener
    lobbyClient.connect(() => {
        lobbyClient.subscribeToLobby();
    });

    return () => {
        lobbyClient.disconnect();
    };
  }, []);

  const handleJoin = (user: UserProfile, room: RoomInfo) => {
    // Save only username/avatar preferences, not the session clientID
    saveUser({ username: user.username, avatarBase64: user.avatarBase64 });
    setCurrentUser(user);
    setCurrentRoom(room);
  };

  const handleLeave = () => {
    setCurrentRoom(null);
    // Clear URL param without reload
    window.history.pushState({}, '', window.location.pathname);
  };

  if (currentRoom && currentUser) {
    return <ChatRoom user={currentUser} room={currentRoom} onLeave={handleLeave} />;
  }

  return (
    <Lobby 
        initialUser={currentUser} 
        onJoin={handleJoin} 
        publicRooms={publicRooms}
    />
  );
};

export default App;
