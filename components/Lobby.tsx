
import React, { useEffect, useState } from 'react';
import { UserProfile, RoomInfo } from '../types';
import { generateUUID, compressImage, generateShortId } from '../utils/helpers';
import { Users, Lock, Globe, LogIn, Upload, ShieldAlert, Info } from 'lucide-react';
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await compressImage(e.target.files[0], 100, 0.6); // Heavy compression for avatar
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
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8">
        
        {/* Left: Configuration */}
        <div className="bg-chrome-800 p-8 rounded-2xl border border-chrome-600 shadow-2xl">
          <h1 className="text-3xl font-bold text-chrome-100 mb-2">Dark MQTT Chat</h1>
          
          <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-lg mb-6 text-xs text-yellow-200/80">
             <h3 className="font-bold flex items-center gap-2 mb-2 text-yellow-100">
               <ShieldAlert size={14} /> 隐私与安全须知
             </h3>
             <ul className="space-y-1 list-disc list-inside">
               <li>基于 EMQX 免费公共服务器，无需注册，完全匿名。</li>
               <li><strong>注意：</strong> 消息未端到端加密，请勿发送密码等敏感信息。</li>
               <li>私密房间 ID 即为“密钥”，请妥善保管，避免泄露。</li>
               <li>
                   Tip: 使用 URL <code className="bg-black/30 px-1 rounded select-all">?room=任意ID</code> 
                   可快速创建或加入私密房间。
               </li>
             </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Profile Section */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-chrome-300 uppercase tracking-wider">身份设置</label>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-full bg-chrome-700 border-2 border-chrome-600 overflow-hidden flex-shrink-0 group">
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-chrome-600">
                      <Users size={24} />
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition">
                    <Upload size={16} className="text-white" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  </label>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="输入昵称"
                    className="w-full bg-chrome-900 border border-chrome-600 rounded px-3 py-2 text-chrome-100 focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <hr className="border-chrome-600" />

            {/* Room Section */}
            <div className="space-y-4">
               <label className="block text-sm font-medium text-chrome-300 uppercase tracking-wider">房间设置</label>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs text-chrome-300 mb-1 block">房间 ID</label>
                    <input
                        type="text"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value)}
                        placeholder="例: room123"
                        className="w-full bg-chrome-900 border border-chrome-600 rounded px-3 py-2 text-chrome-100 focus:border-accent focus:outline-none font-mono"
                        maxLength={16}
                    />
                 </div>
                 <div>
                    <label className="text-xs text-chrome-300 mb-1 block">房间主题</label>
                    <input
                        type="text"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        placeholder="例: 技术交流"
                        className="w-full bg-chrome-900 border border-chrome-600 rounded px-3 py-2 text-chrome-100 focus:border-accent focus:outline-none"
                    />
                 </div>
               </div>

               <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={clsx("flex-1 py-2 rounded border transition flex items-center justify-center gap-2", !isPublic ? "bg-accent/10 border-accent text-accent" : "border-chrome-600 text-chrome-300 hover:bg-chrome-700")}
                  >
                    <Lock size={16} /> 私密房间
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={clsx("flex-1 py-2 rounded border transition flex items-center justify-center gap-2", isPublic ? "bg-accent/10 border-accent text-accent" : "border-chrome-600 text-chrome-300 hover:bg-chrome-700")}
                  >
                    <Globe size={16} /> 公开大厅
                  </button>
               </div>
               
               <p className="text-xs text-chrome-400 flex items-start gap-1">
                   <Info size={12} className="mt-0.5 flex-shrink-0" />
                   {isPublic 
                     ? "公开房间将显示在右侧列表，所有人可见。" 
                     : "私密房间不显示在列表，需通过 ID 或 URL 进入。"
                   }
               </p>
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              className="w-full bg-accent hover:bg-accent-hover text-chrome-900 font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              <LogIn size={20} /> 进入房间
            </button>

          </form>
        </div>

        {/* Right: Public Lobby List */}
        <div className="bg-chrome-800 p-8 rounded-2xl border border-chrome-600 shadow-xl overflow-hidden flex flex-col">
          <h2 className="text-xl font-bold text-chrome-100 mb-4 flex items-center gap-2">
            <Globe size={20} className="text-accent" /> 公开房间大厅
          </h2>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
             {publicRooms.length === 0 ? (
                 <div className="text-center text-chrome-600 mt-10">
                     <p>暂无公开房间。</p>
                     <p className="text-sm">来创建第一个吧！</p>
                 </div>
             ) : (
                 publicRooms.map(room => (
                     <div 
                        key={room.id}
                        onClick={() => { setRoomIdInput(room.id); setTopicInput(room.topicName); setIsPublic(true); }}
                        className="p-4 bg-chrome-700 hover:bg-chrome-600 rounded-lg cursor-pointer transition border border-transparent hover:border-chrome-300 group"
                     >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-chrome-100 group-hover:text-accent transition">{room.topicName}</h3>
                                <p className="text-xs text-chrome-300 font-mono">ID: {room.id}</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-green-400 bg-black/20 px-2 py-1 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                {room.onlineCount} 在线
                            </div>
                        </div>
                     </div>
                 ))
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
