import { useState, useCallback } from 'react';

export function usePasswordGeneration() {
  const [autoResetLength, setAutoResetLength] = useState(16);
  const [includeSpecialChars, setIncludeSpecialChars] = useState(true);

  const generateRandomPassword = useCallback((length: number = 16, special: boolean = true): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const safeSpecialChars = '@#%^*_+=[]{}:.<>?~';
    const allChars = special ? chars + safeSpecialChars : chars;
    
    let password = '';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      password += allChars[array[i] % allChars.length];
    }
    
    return password;
  }, []);

  return {
    autoResetLength,
    setAutoResetLength,
    includeSpecialChars,
    setIncludeSpecialChars,
    generateRandomPassword,
  };
}
