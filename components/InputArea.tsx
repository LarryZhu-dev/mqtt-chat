
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
    <div className="bg-chrome-800 p-4 border-t border-chrome-600 flex flex-col gap-2 relative">
      {/* Reply Context */}
      {replyingTo && (
        <div className="flex items-center justify-between bg-chrome-700 px-3 py-2 rounded-md mb-1 text-sm border-l-4 border-accent">
          <div className="truncate text-chrome-300">
            回复 <span className="font-bold text-chrome-100">{replyingTo.username}</span>: {replyingTo.content.substring(0, 50)}...
          </div>
          <button onClick={onCancelReply} className="text-chrome-300 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Pending Image Preview */}
      {pendingImage && (
          <div className="relative inline-block w-fit mb-2 group">
              <img src={pendingImage} alt="Preview" className="h-32 rounded-lg border border-chrome-600" />
              <button 
                onClick={() => setPendingImage(null)}
                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700 transition"
              >
                  <X size={14} />
              </button>
          </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmoji && (
        <EmojiPicker 
            onSelect={(emoji) => { setText(prev => prev + emoji); textAreaRef.current?.focus(); }}
            onClose={() => setShowEmoji(false)}
        />
      )}

      <div className="flex items-end gap-2">
        <button 
            onClick={() => setShowEmoji(!showEmoji)} 
            className="p-2 text-chrome-300 hover:text-accent transition rounded-full hover:bg-chrome-700 mb-1"
            title="表情"
        >
          <Smile size={24} />
        </button>

        <button 
            onClick={() => fileInputRef.current?.click()} 
            className="p-2 text-chrome-300 hover:text-accent transition rounded-full hover:bg-chrome-700 mb-1"
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

        <textarea
          ref={textAreaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="输入消息..."
          className="flex-1 bg-chrome-900 text-chrome-100 border border-chrome-600 rounded-xl px-4 py-3 focus:outline-none focus:border-accent resize-none h-[50px] max-h-[150px] overflow-y-auto leading-normal"
          rows={1}
        />

        <button 
            onClick={handleSend}
            disabled={!text.trim() && !pendingImage}
            className="p-3 bg-accent hover:bg-accent-hover text-chrome-900 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed mb-1"
            title="发送"
        >
          <Send size={20} />
        </button>
      </div>
      <div className="text-xs text-chrome-300 text-center mt-1">
         支持粘贴截图 • F8 清屏
      </div>
    </div>
  );
};
