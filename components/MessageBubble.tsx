
import React, { useEffect, useState } from 'react';
import { ChatMessage, Reaction, UserProfile } from '../types';
import clsx from 'clsx';
import { Reply, SmilePlus, Trash2, Copy, Download } from 'lucide-react';

interface MessageBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  senderProfile?: UserProfile; // Resolved profile
  onReply: (msg: ChatMessage) => void;
  onReact: (msgId: string, emoji: string) => void;
  onDeleteLocal: (msgId: string) => void;
  onScrollToMessage: (id: string) => void;
}

const REACTION_OPTIONS = ["👍", "❤️", "😂", "😮", "😡", "🎉"];

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
    message, 
    isMe, 
    senderProfile,
    onReply, 
    onReact,
    onDeleteLocal,
    onScrollToMessage 
}) => {
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, alignRight: boolean, alignBottom: boolean} | null>(null);

  // Close context menu on click elsewhere
  useEffect(() => {
      const closeMenu = () => setContextMenu(null);
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleRightClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); 
      
      const clickX = e.clientX;
      const clickY = e.clientY;
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      setContextMenu({ 
          x: clickX, 
          y: clickY,
          alignRight: clickX > screenW - 150, 
          alignBottom: clickY > screenH - 200
      });
  };

  // Sender resolution
  const avatarSrc = senderProfile?.avatarBase64 || message.senderAvatar;
  const username = senderProfile?.username || message.senderUsername;
  
  return (
    <div 
        id={`msg-${message.id}`}
        className={clsx(
            "flex w-full mb-6 group relative animate-slide-up",
            isMe ? "justify-end" : "justify-start" 
        )}
        onMouseLeave={() => setShowReactionMenu(false)}
    >
      <div className={clsx("flex max-w-[85%] sm:max-w-[70%] gap-3", isMe ? "flex-row-reverse" : "flex-row")}>
        
        {/* Avatar */}
        <div className="flex-shrink-0 flex flex-col items-center pt-1">
            <div className="w-9 h-9 rounded-full bg-chrome-700 overflow-hidden border border-chrome-600 shadow-sm">
            {avatarSrc ? (
                <img src={avatarSrc} alt="av" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-chrome-300 font-bold text-xs">
                {username.substring(0, 2).toUpperCase()}
                </div>
            )}
            </div>
        </div>

        {/* Content Wrapper */}
        <div className={clsx("flex flex-col", isMe ? "items-end" : "items-start")}>
            
            {!isMe && (
                <span className="text-[11px] text-chrome-300 mb-1 ml-1 opacity-70">
                    {username}
                </span>
            )}

            {/* Message Bubble */}
            <div 
                onContextMenu={handleRightClick}
                className={clsx(
                    "relative px-4 py-2.5 rounded-2xl shadow-sm text-[15px] leading-relaxed break-words min-w-[60px] cursor-default border",
                    isMe 
                        ? "bg-accent text-chrome-900 rounded-tr-sm border-accent/50" 
                        : "bg-chrome-700 text-chrome-100 rounded-tl-sm border-chrome-600" 
                )}
            >
                 {/* Reply Reference */}
                 {message.replyToId && (
                    <div 
                        onClick={() => onScrollToMessage(message.replyToId!)}
                        className={clsx(
                            "mb-2 p-2 rounded-lg text-xs cursor-pointer border-l-2 select-none",
                            isMe ? "bg-black/10 border-chrome-900/30 hover:bg-black/20" : "bg-black/20 border-accent/50 hover:bg-black/30"
                        )}
                    >
                         <span className={isMe ? "text-chrome-800" : "text-chrome-300"}>
                            {message.replyToSummary 
                                ? <><span className="font-bold opacity-80">{message.replyToSummary.username}</span>: {message.replyToSummary.content}</>
                                : <span className="italic">引用了一条消息...</span>
                            } 
                        </span>
                    </div>
                 )}

                 {/* Content */}
                 {message.type === 'text' && <p className="whitespace-pre-wrap">{message.content}</p>}
                 {/* Fix: use imageUrl for pure image type */}
                 {message.type === 'image' && (
                     <div className="rounded-xl overflow-hidden my-1">
                        <img src={message.imageUrl} alt="Content" className="max-h-[300px] object-contain cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => window.open(message.imageUrl, '_blank')} />
                     </div>
                 )}
                 {message.type === 'mixed' && (
                     <div className="flex flex-col gap-2">
                         <div className="rounded-xl overflow-hidden">
                            <img src={message.imageUrl} alt="Content" className="max-h-[300px] object-contain cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => window.open(message.imageUrl, '_blank')} />
                         </div>
                         <p className="whitespace-pre-wrap">{message.content}</p>
                     </div>
                 )}

                {/* Quick Actions Hover (Desktop) */}
                <div className={clsx(
                    "absolute -top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-chrome-800 rounded-lg p-0.5 shadow-lg border border-chrome-600 z-10",
                    isMe ? "left-0 -translate-x-full mr-2" : "right-0 translate-x-full ml-2"
                )}>
                    <button onClick={() => onReply(message)} className="p-1.5 hover:bg-chrome-700 rounded-md text-chrome-300 hover:text-accent transition" title="引用">
                        <Reply size={14} />
                    </button>
                    <button 
                        onClick={() => setShowReactionMenu(!showReactionMenu)} 
                        className="p-1.5 hover:bg-chrome-700 rounded-md text-chrome-300 hover:text-yellow-400 transition relative" 
                        title="表情回复"
                    >
                        <SmilePlus size={14} />
                    </button>
                </div>

                 {/* Reaction Menu Popup */}
                 {showReactionMenu && (
                     <div className={clsx(
                         "absolute -top-10 z-20 flex gap-1 bg-chrome-800 p-1.5 rounded-full border border-chrome-600 shadow-xl w-max animate-bounce-in",
                         isMe ? "right-0" : "left-0"
                     )}>
                         {REACTION_OPTIONS.map(emoji => (
                             <button 
                                key={emoji}
                                onClick={() => { onReact(message.id, emoji); setShowReactionMenu(false); }}
                                className="hover:scale-125 transition text-xl px-1"
                             >
                                 {emoji}
                             </button>
                         ))}
                     </div>
                 )}
            </div>

            {/* Reactions Display */}
            {Object.keys(message.reactions).length > 0 && (
                <div className={clsx("flex flex-wrap gap-1 mt-1.5 max-w-[200px]", isMe ? "justify-end" : "justify-start")}>
                    {Object.entries(message.reactions).map(([emoji, users]) => {
                         const userList = (users as Reaction[]).map(u => u.fromUsername).join('\n');
                         const count = (users as Reaction[]).length;
                         return (
                            <div 
                                key={emoji} 
                                className="group/tooltip relative bg-chrome-800 border border-chrome-600 rounded-full px-2 py-0.5 text-xs text-chrome-300 flex items-center gap-1 cursor-help hover:border-accent transition-colors"
                            >
                                <span>{emoji}</span>
                                <span className="font-mono text-[10px]">{count}</span>
                                
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/tooltip:block bg-black/90 text-white text-[10px] p-2 rounded whitespace-pre z-30 shadow-lg border border-chrome-600 animate-fade-in">
                                    {userList}
                                </div>
                            </div>
                         );
                    })}
                </div>
            )}
            
            {/* Timestamp */}
            <span className={clsx("text-[10px] mt-1 select-none font-medium opacity-60", isMe ? "text-chrome-300" : "text-chrome-400")}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
          <div 
            className="fixed z-50 bg-chrome-800 border border-chrome-600 rounded-lg shadow-2xl py-1 min-w-[140px] flex flex-col animate-fade-in"
            style={{ 
                top: contextMenu.alignBottom ? contextMenu.y - 120 : contextMenu.y, 
                left: contextMenu.alignRight ? contextMenu.x - 140 : contextMenu.x  
            }}
            onClick={(e) => e.stopPropagation()}
          >
              <button 
                className="px-4 py-2 hover:bg-chrome-700 text-left text-sm text-chrome-100 flex items-center gap-3 transition-colors"
                onClick={() => { onReply(message); setContextMenu(null); }}
              >
                  <Reply size={14} /> 引用回复
              </button>
              
              <div className="relative group/menu">
                <button className="w-full px-4 py-2 hover:bg-chrome-700 text-left text-sm text-chrome-100 flex items-center gap-3 transition-colors">
                    <SmilePlus size={14} /> 快速表情
                </button>
                <div className="absolute left-full top-0 ml-2 bg-chrome-800 border border-chrome-600 rounded-lg shadow-xl p-1 hidden group-hover/menu:flex gap-1 w-max transform -translate-x-1">
                    {REACTION_OPTIONS.slice(0, 4).map(e => (
                        <button key={e} onClick={() => { onReact(message.id, e); setContextMenu(null); }} className="hover:scale-125 px-1 transition text-lg">{e}</button>
                    ))}
                </div>
              </div>

              {message.imageUrl && (
                  <button 
                    className="px-4 py-2 hover:bg-chrome-700 text-left text-sm text-chrome-100 flex items-center gap-3 transition-colors"
                    onClick={() => { window.open(message.imageUrl, '_blank'); setContextMenu(null); }}
                  >
                     <Download size={14} /> 查看原图
                  </button>
              )}

              <div className="h-px bg-chrome-600 my-1 mx-2 opacity-50"></div>
              
              <button 
                className="px-4 py-2 hover:bg-red-900/30 text-left text-sm text-red-300 flex items-center gap-3 transition-colors"
                onClick={() => { onDeleteLocal(message.id); setContextMenu(null); }}
              >
                  <Trash2 size={14} /> 删除 (本地)
              </button>
          </div>
      )}
    </div>
  );
};
