import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Smile, X } from 'lucide-react';
import { compressImage } from '../utils/helpers';
import { EmojiPicker } from './EmojiPicker';

interface InputAreaProps {
  onSendMessage: (text: string, image?: string) => void;
  replyingTo: { id: string; content: string; username: string } | null;
  onCancelReply: () => void;
  insertText?: { text: string; id: number } | null;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSendMessage, replyingTo, onCancelReply, insertText }) => {
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyingTo) {
      textAreaRef.current?.focus();
    }
  }, [replyingTo?.id]);

  useEffect(() => {
    if (insertText) {
      setText(prev => prev + insertText.text);
      // Focus and move cursor to end
      if (textAreaRef.current) {
          textAreaRef.current.focus();
          // Timeout helps ensure focus happens after state update in some cases
          setTimeout(() => {
             const len = textAreaRef.current?.value.length || 0;
             textAreaRef.current?.setSelectionRange(len, len);
          }, 0);
      }
    }
  }, [insertText]);

  const handleSend = () => {
    if (!text.trim() && !pendingImage) return;
    onSendMessage(text, pendingImage || undefined);
    setText('');
    setPendingImage(null);
    setShowEmoji(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          try {
            const base64 = await compressImage(blob);
            setPendingImage(base64);
          } catch (err) {
            console.error("图片处理失败", err);
          }
        }
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await compressImage(file);
        setPendingImage(base64);
      } catch (err) {
        console.error("图片上传失败", err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="input-area-wrapper">
      <div className="input-area-content">
        
        {/* Reply Context */}
        {replyingTo && (
          <div className="animate-slide-up" style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              backgroundColor: 'var(--bg-input)', padding: '8px 16px', borderRadius: '12px', 
              fontSize: '13px', borderLeft: '3px solid var(--accent)' 
          }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>
              回复 <span style={{ fontWeight: 'bold', color: 'var(--accent-text)' }}>{replyingTo.username}</span>: {replyingTo.content.substring(0, 50)}...
            </div>
            <button onClick={onCancelReply} className="btn-icon" style={{ padding: '4px' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Pending Image Preview */}
        {pendingImage && (
            <div className="image-preview-wrapper animate-bounce-in">
                <img src={pendingImage} alt="Preview" className="image-preview-img" />
                <button 
                  onClick={() => setPendingImage(null)}
                  className="image-preview-close"
                >
                    <X size={12} />
                </button>
            </div>
        )}

        {/* Emoji Picker Popover */}
        {showEmoji && (
          <div className="animate-fade-in" style={{ position: 'absolute', bottom: '70px', left: '0', zIndex: 40 }}>
            <EmojiPicker 
                onSelect={(emoji) => { setText(prev => prev + emoji); textAreaRef.current?.focus(); }}
                onClose={() => setShowEmoji(false)}
            />
          </div>
        )}

        <div className="flex gap-2 items-end">
          <button 
              onClick={() => setShowEmoji(!showEmoji)} 
              className="btn-icon"
              title="表情"
              style={{ padding: '10px' }}
          >
            <Smile size={24} />
          </button>

          <button 
              onClick={() => fileInputRef.current?.click()} 
              className="btn-icon"
              title="图片"
              style={{ padding: '10px' }}
          >
            <ImageIcon size={24} />
          </button>
          <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
          />

          <div className="chat-textarea-container">
            <textarea
              ref={textAreaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="发送消息..."
              className="chat-textarea custom-scrollbar"
              rows={1}
            />
          </div>

          <button 
              onClick={handleSend}
              disabled={!text.trim() && !pendingImage}
              className="btn-icon"
              style={{ 
                  backgroundColor: (!text.trim() && !pendingImage) ? 'transparent' : 'var(--accent)', 
                  color: (!text.trim() && !pendingImage) ? 'var(--text-muted)' : '#202124', 
                  borderRadius: '50%', 
                  padding: '10px',
                  transition: 'all 0.2s',
                  cursor: (!text.trim() && !pendingImage) ? 'default' : 'pointer'
              }}
              title="发送"
          >
            <Send size={20} fill={(!text.trim() && !pendingImage) ? "none" : "currentColor"} />
          </button>
        </div>
      </div>
    </div>
  );
};
