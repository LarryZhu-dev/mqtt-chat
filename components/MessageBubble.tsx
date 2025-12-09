import React, { useEffect, useState } from 'react';
import { ChatMessage, Reaction, UserProfile } from '../types';
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
        className={`message-row animate-slide-up ${isMe ? "me" : "others"}`}
        onMouseLeave={() => setShowReactionMenu(false)}
    >
      <div className="flex gap-2" style={{ maxWidth: '80%' }}>
        
        {/* Avatar */}
        {!isMe && (
            <div className="avatar">
            {avatarSrc ? (
                <img src={avatarSrc} alt="av" />
            ) : (
                <div className="avatar-placeholder">
                {username.substring(0, 1).toUpperCase()}
                </div>
            )}
            </div>
        )}

        {/* Content Wrapper */}
        <div className="message-container">
            
            {!isMe && (
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', marginLeft: '4px', opacity: 0.8 }}>
                    {username}
                </span>
            )}

            {/* Message Bubble */}
            <div 
                onContextMenu={handleRightClick}
                className="bubble"
            >
                 {/* Reply Reference */}
                 {message.replyToId && (
                    <div 
                        className="reply-context"
                        onClick={() => onScrollToMessage(message.replyToId!)}
                    >
                         <span style={{ color: isMe ? 'rgba(0,0,0,0.7)' : 'var(--text-secondary)' }}>
                            {message.replyToSummary 
                                ? <><span style={{ fontWeight: 'bold', opacity: 0.9 }}>{message.replyToSummary.username}</span>: {message.replyToSummary.content}</>
                                : <span style={{ fontStyle: 'italic' }}>引用了一条消息...</span>
                            } 
                        </span>
                    </div>
                 )}

                 {/* Content */}
                 {message.type === 'text' && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{message.content}</p>}
                 {message.type === 'image' && (
                     <div style={{ borderRadius: '8px', overflow: 'hidden', margin: '4px 0' }}>
                        <img src={message.imageUrl} alt="Content" style={{ maxHeight: '300px', maxWidth: '100%', objectFit: 'contain', cursor: 'pointer', display: 'block' }} onClick={() => window.open(message.imageUrl, '_blank')} />
                     </div>
                 )}
                 {message.type === 'mixed' && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                         <div style={{ borderRadius: '8px', overflow: 'hidden' }}>
                            <img src={message.imageUrl} alt="Content" style={{ maxHeight: '300px', maxWidth: '100%', objectFit: 'contain', cursor: 'pointer', display: 'block' }} onClick={() => window.open(message.imageUrl, '_blank')} />
                         </div>
                         <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{message.content}</p>
                     </div>
                 )}

                 {/* Reaction Menu Popup */}
                 {showReactionMenu && (
                     <div className="animate-bounce-in" style={{ 
                         position: 'absolute', top: '-40px', [isMe ? 'right' : 'left']: 0, zIndex: 20,
                         display: 'flex', gap: '4px', backgroundColor: 'var(--bg-surface)', padding: '6px',
                         borderRadius: '99px', border: '1px solid var(--bg-hover)', boxShadow: 'var(--shadow-md)'
                     }}>
                         {REACTION_OPTIONS.map(emoji => (
                             <button 
                                key={emoji}
                                onClick={() => { onReact(message.id, emoji); setShowReactionMenu(false); }}
                                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', transition: 'transform 0.1s' }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                             >
                                 {emoji}
                             </button>
                         ))}
                     </div>
                 )}
            </div>

            {/* Reactions Display */}
            {Object.keys(message.reactions).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    {Object.entries(message.reactions).map(([emoji, users]) => {
                         const userList = (users as Reaction[]).map(u => u.fromUsername).join('\n');
                         const count = (users as Reaction[]).length;
                         return (
                            <div 
                                key={emoji} 
                                title={userList}
                                className="reaction-pill"
                            >
                                <span>{emoji}</span>
                                <span style={{ fontSize: '10px' }}>{count}</span>
                            </div>
                         );
                    })}
                </div>
            )}
            
            {/* Timestamp */}
            <span className="msg-timestamp">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
          <div 
            className="context-menu animate-fade-in"
            style={{ 
                top: contextMenu.alignBottom ? contextMenu.y - 120 : contextMenu.y, 
                left: contextMenu.alignRight ? contextMenu.x - 140 : contextMenu.x  
            }}
            onClick={(e) => e.stopPropagation()}
          >
              <button 
                className="context-menu-item"
                onClick={() => { onReply(message); setContextMenu(null); }}
              >
                  <Reply size={14} /> 引用回复
              </button>
              
              <button 
                className="context-menu-item"
                onClick={() => { setShowReactionMenu(true); setContextMenu(null); }}
              >
                  <SmilePlus size={14} /> 快速表情
              </button>

              {message.imageUrl && (
                  <button 
                    className="context-menu-item"
                    onClick={() => { window.open(message.imageUrl, '_blank'); setContextMenu(null); }}
                  >
                     <Download size={14} /> 查看原图
                  </button>
              )}

              <div style={{ height: '1px', backgroundColor: 'var(--bg-hover)', margin: '4px 8px', opacity: 0.5 }} />
              
              <button 
                className="context-menu-item"
                style={{ color: '#ef5350' }}
                onClick={() => { onDeleteLocal(message.id); setContextMenu(null); }}
              >
                  <Trash2 size={14} /> 删除 (本地)
              </button>
          </div>
      )}
    </div>
  );
};