import crypto from 'crypto';

const SAFE_SPECIAL_CHARS = '@#%^*_+=[]{}:.<>?~';

export function generatePassword(length: number = 16, includeSpecialChars: boolean = true): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  let chars = lowercase + uppercase + numbers;
  if (includeSpecialChars) {
    chars += SAFE_SPECIAL_CHARS;
  }
  
  let password = '';
  const array = new Uint32Array(length);
  
  crypto.randomFillSync(array);
  
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  
  return password;
}

export function escapeForShell(str: string): string {
  return str.replace(/'/g, "'\\''");
}

export function escapeForDoubleQuotes(str: string): string {
  return str.replace(/["$`\\!]/g, '\\$&');
}
