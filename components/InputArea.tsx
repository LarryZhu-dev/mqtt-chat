
import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, Smile, X } from 'lucide-react';
import { compressImage } from '../utils/helpers';
import { EmojiPicker } from './EmojiPicker';

interface InputAreaProps {
  onSendMessage: (text: string, image?: string) => void;
  replyingTo: { id: string; content: string; username: string } | null;
  onCancelReply: () => void;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSendMessage, replyingTo, onCancelReply }) => {
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="bg-chrome-800 px-4 py-4 border-t border-chrome-600 shadow-[0_-4px_20px_rgba(0,0,0,0.2)] z-30">
      <div className="max-w-5xl mx-auto flex flex-col gap-2 relative">
        
        {/* Reply Context */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-chrome-700 px-4 py-2 rounded-xl mb-1 text-sm border-l-4 border-accent shadow-sm animate-slide-up">
            <div className="truncate text-chrome-300">
              回复 <span className="font-bold text-accent-text">{replyingTo.username}</span>: {replyingTo.content.substring(0, 50)}...
            </div>
            <button onClick={onCancelReply} className="text-chrome-300 hover:text-white p-1 hover:bg-chrome-600 rounded-full transition">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Pending Image Preview */}
        {pendingImage && (
            <div className="relative inline-block w-fit mb-2 group animate-bounce-in">
                <img src={pendingImage} alt="Preview" className="h-40 rounded-xl border border-chrome-600 shadow-lg object-contain bg-black/20" />
                <button 
                  onClick={() => setPendingImage(null)}
                  className="absolute -top-2 -right-2 bg-chrome-700 hover:bg-red-600 text-white rounded-full p-1.5 shadow-md border border-chrome-600 transition"
                >
                    <X size={14} />
                </button>
            </div>
        )}

        {/* Emoji Picker Popover */}
        {showEmoji && (
          <div className="animate-fade-in">
            <EmojiPicker 
                onSelect={(emoji) => { setText(prev => prev + emoji); textAreaRef.current?.focus(); }}
                onClose={() => setShowEmoji(false)}
            />
          </div>
        )}

        <div className="flex items-end gap-3">
          <button 
              onClick={() => setShowEmoji(!showEmoji)} 
              className="p-3 text-chrome-300 hover:text-accent transition rounded-full hover:bg-chrome-700 mb-0.5"
              title="表情"
          >
            <Smile size={24} />
          </button>

          <button 
              onClick={() => fileInputRef.current?.click()} 
              className="p-3 text-chrome-300 hover:text-accent transition rounded-full hover:bg-chrome-700 mb-0.5"
              title="图片"
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

          <div className="flex-1 bg-chrome-700 rounded-[24px] px-4 py-2 border border-transparent focus-within:border-accent focus-within:bg-chrome-700/80 transition-all flex items-center">
            <textarea
              ref={textAreaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="发送消息..."
              className="w-full bg-transparent text-chrome-100 placeholder-chrome-500 focus:outline-none resize-none h-[24px] max-h-[120px] overflow-y-auto leading-6 custom-scrollbar"
              rows={1}
              style={{ minHeight: '24px' }}
            />
          </div>

          <button 
              onClick={handleSend}
              disabled={!text.trim() && !pendingImage}
              className="p-3 bg-accent hover:bg-accent-hover text-chrome-900 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed mb-0.5 shadow-md transform active:scale-95"
              title="发送"
          >
            <Send size={20} fill={(!text.trim() && !pendingImage) ? "none" : "currentColor"} />
          </button>
        </div>
      </div>
    </div>
  );
};
