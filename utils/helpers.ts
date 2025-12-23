
// Simple UUID generator
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const generateShortId = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Random Username Generator
const ADJECTIVES = ['Happy', 'Cool', 'Swift', 'Calm', 'Brave', 'Quiet', 'Neon', 'Misty', 'Cosmic', 'Wild', 'Silent', 'Jolly'];
const NOUNS = ['Panda', 'Tiger', 'Falcon', 'Ghost', 'Robot', 'Wizard', 'Ninja', 'Fox', 'Wolf', 'Dragon', 'Eagle', 'Bear'];

export const generateRandomUsername = (): string => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
};

// Random Pastel Color Generator
export const generateRandomPastelColor = (): string => {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 80%)`;
};

/**
 * Generates an avatar using DiceBear API based on a seed (username).
 * Uses pixel-art style as requested.
 */
export const generateAvatarFromSeed = (seed: string): { base64: string; color: string } => {
  const color = generateRandomPastelColor();
  // Using the pixel-art style from DiceBear v9
  const avatarUrl = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(seed)}`;
  
  return {
    base64: avatarUrl,
    color: color
  };
};

// Image Compression
export const compressImage = (file: File, maxWidth: number = 600, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Canvas context not available"));
            return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const STORAGE_KEY_USER = 'emqx_chat_user';
export const STORAGE_KEY_BROKER = 'emqx_chat_custom_broker';

export const getStoredUser = () => {
  const stored = localStorage.getItem(STORAGE_KEY_USER);
  return stored ? JSON.parse(stored) : null;
};

export const saveUser = (user: any) => {
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
};

export const getStoredBroker = () => {
  const stored = localStorage.getItem(STORAGE_KEY_BROKER);
  return stored ? JSON.parse(stored) : null;
};

export const saveBroker = (broker: any) => {
  localStorage.setItem(STORAGE_KEY_BROKER, JSON.stringify(broker));
};

export const deleteBroker = () => {
  localStorage.removeItem(STORAGE_KEY_BROKER);
};
