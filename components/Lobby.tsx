
import React, { useEffect, useState } from 'react';
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
  };

  return (
    <div className="min-h-screen bg-chrome-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 animate-fade-in">
        
        {/* Left: Configuration */}
        <div className="bg-chrome-800 p-8 rounded-3xl shadow-2xl flex flex-col justify-center">
          <div className="mb-8">
             <h1 className="text-4xl font-bold text-chrome-100 mb-2 tracking-tight">wcnm-chat</h1>
             <p className="text-chrome-300">匿名、轻量、即时的聊天</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Profile Section */}
            <div>
              <label className="block text-xs font-bold text-accent-text uppercase tracking-wider mb-4">您的身份</label>
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full bg-chrome-600 overflow-hidden shadow-inner ring-2 ring-transparent group-hover:ring-accent transition-all duration-300">
                    {avatar ? (
                      <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-chrome-300">
                        <Users size={32} />
                      </div>
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm">
                    <Upload size={20} className="text-white drop-shadow-md" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                </div>
                
                <div className="flex-1">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="给自己起个昵称..."
                    className="w-full bg-chrome-700 text-chrome-100 text-lg px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-accent transition-all placeholder-chrome-500 outline-none"
                    style={{ backgroundColor: '#3b3b3b' }}
                  />
                </div>
              </div>
            </div>

            {/* Room Section */}
            <div>
               <label className="block text-xs font-bold text-accent-text uppercase tracking-wider mb-4">房间设置</label>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                 <div className="relative">
                    <div className="absolute left-3 top-3 text-chrome-300"><Hash size={18}/></div>
                    <input
                        type="text"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value)}
                        placeholder="房间 ID"
                        className="w-full bg-chrome-700 pl-10 pr-4 py-3 rounded-xl text-chrome-100 focus:ring-2 focus:ring-accent outline-none font-mono transition-all placeholder-chrome-500"
                        style={{ backgroundColor: '#3b3b3b' }}
                        maxLength={16}
                    />
                 </div>
                 <div className="relative">
                    <div className="absolute left-3 top-3 text-chrome-300"><Info size={18}/></div>
                    <input
                        type="text"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        placeholder="房间话题"
                        className="w-full bg-chrome-700 pl-10 pr-4 py-3 rounded-xl text-chrome-100 focus:ring-2 focus:ring-accent outline-none transition-all placeholder-chrome-500"
                        style={{ backgroundColor: '#3b3b3b' }}
                    />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-3 p-1 bg-chrome-700 rounded-xl" style={{ backgroundColor: '#3b3b3b' }}>
                  <button 
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={clsx(
                        "py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 border-2", 
                        !isPublic 
                            ? "bg-chrome-800 border-accent text-accent shadow-md" 
                            : "bg-transparent border-transparent text-chrome-300 hover:text-chrome-100"
                    )}
                  >
                    <Lock size={16} /> 私密
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={clsx(
                        "py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 border-2", 
                        isPublic 
                            ? "bg-chrome-800 border-accent text-accent shadow-md" 
                            : "bg-transparent border-transparent text-chrome-300 hover:text-chrome-100"
                    )}
                  >
                    <Globe size={16} /> 公开
                  </button>
               </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/10 p-3 rounded-lg">
                    <ShieldAlert size={16} /> {error}
                </div>
            )}

            <button
              type="submit"
              className="w-full bg-accent hover:bg-accent-hover text-chrome-900 font-bold py-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
            >
              <LogIn size={20} /> 进入房间
            </button>
          </form>
        </div>

        {/* Right: Public Lobby List */}
        <div className="flex flex-col gap-4">
            <div className="bg-chrome-800 p-6 rounded-3xl shadow-2xl flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-chrome-100 flex items-center gap-2">
                    <Globe size={24} className="text-accent" /> 公开房间
                </h2>
                <span className="text-xs font-mono text-chrome-300 bg-chrome-600 px-2 py-1 rounded-md">Live</span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {publicRooms.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-chrome-300/50 gap-2">
                        <Globe size={48} strokeWidth={1} />
                        <p>暂无公开房间</p>
                    </div>
                ) : (
                    publicRooms.map((room, idx) => (
                        <div 
                            key={room.id}
                            onClick={() => { setRoomIdInput(room.id); setTopicInput(room.topicName); setIsPublic(true); }}
                            className="p-4 bg-chrome-600/30 hover:bg-chrome-600 rounded-xl cursor-pointer transition-all group animate-slide-up"
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-chrome-100 group-hover:text-accent transition">{room.topicName}</h3>
                                    <p className="text-xs text-chrome-300 font-mono mt-1 flex items-center gap-1">
                                        <Hash size={10} /> {room.id}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/20 px-2.5 py-1 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    {room.onlineCount}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            </div>

            <div className="bg-chrome-800 p-6 rounded-3xl shadow-2xl">
                <h3 className="font-bold text-chrome-100 mb-2 flex items-center gap-2 text-sm">
                    <ShieldAlert size={16} className="text-accent" /> 隐私提示
                </h3>
                <p className="text-xs text-chrome-300 leading-relaxed">
                   本系统不会加密任何消息，任何信息都会经过公开服务器（它可能被任何人查看或截获），只有用户身份为随机生成（即匿名），私密房间id即为密钥，泄露后会导致他人随意进入。公开房间会直接被所有人看到。
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};
