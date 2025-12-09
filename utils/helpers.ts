
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
  // High lightness and low-medium saturation for pastel look, avoiding dark/grey
  return `hsl(${hue}, 70%, 80%)`;
};

// Simple SVG Paths for random avatars (24x24 viewBox)
const ICON_PATHS = [
  'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z M12 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2a5 5 0 0 0-5 5v1h10v-1a5 5 0 0 0-5-5z', // User
  'M9 22l-2-2-2 2-2-2-2 2V2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1a2 2 0 0 1 2 2v15l-2 2-2-2-2 2zm3-11a2 2 0 1 0-2-2 2 2 0 0 0 2 2zm0 2a4 4 0 0 0-4 4v1h8v-1a4 4 0 0 0-4-4z', // Ghost
  'M12 2a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v3h2v2h-2v3a2 2 0 0 1-2 2h-2v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2H4v-3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2V4a2 2 0 0 1 2-2h4zm0 6a1.5 1.5 0 1 0-1.5 1.5A1.5 1.5 0 0 0 12 8zm-4 0a1.5 1.5 0 1 0-1.5 1.5A1.5 1.5 0 0 0 8 8z', // Robot
  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm2-4h-2V7h2v6z', // Alert/Generic
  'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', // Layers
  'M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3zm-1 2.5V8h2.5L14.5 5.5zM12 18a3 3 0 1 1 0-6 3 3 0 0 1 0 6z' // File
];

export const generateRandomAvatar = (): { base64: string; color: string } => {
  const color = generateRandomPastelColor();
  const path = ICON_PATHS[Math.floor(Math.random() * ICON_PATHS.length)];
  
  // Construct a minimal SVG
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100" height="100">
      <rect width="100%" height="100%" fill="${color}"/>
      <path d="${path}" fill="#333333" opacity="0.8" transform="translate(4,4) scale(0.66)"/>
    </svg>
  `;
  
  return {
    base64: `data:image/svg+xml;base64,${btoa(svg)}`,
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

export const getStoredUser = () => {
  const stored = localStorage.getItem(STORAGE_KEY_USER);
  return stored ? JSON.parse(stored) : null;
};

export const saveUser = (user: any) => {
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
};
