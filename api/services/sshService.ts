import { Client } from 'ssh2';
import { VM } from './vmService.js';
import logger from '../utils/logger.js';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
}

export interface PasswordChangeResult {
  success: boolean;
  message: string;
  requiresManual?: boolean;
}

export const sshService = {
  executeCommand(vm: VM, command: string, onOutput: (data: string) => void, onError: (data: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      const safePassword = (vm.password || '').replace(/'/g, "'\\''");
      const finalCommand = command.replace(/{{PASSWORD}}/g, safePassword);
  
      conn.on('ready', () => {
        onOutput(`[${vm.name || vm.ip}] Connected.\n`);
        conn.exec(finalCommand, (err, stream) => {
          if (err) {
            onError(`[${vm.name || vm.ip}] Error: ${err.message}\n`);
            conn.end();
            reject(err);
            return;
          }

          stream.on('close', (code: number) => {
            onOutput(`[${vm.name || vm.ip}] Connection closed (Code: ${code}).\n`);
            conn.end();
            resolve();
          }).on('data', (data: Buffer) => {
            onOutput(`[${vm.name || vm.ip}] STDOUT: ${data.toString()}`);
          }).stderr.on('data', (data: Buffer) => {
            onError(`[${vm.name || vm.ip}] STDERR: ${data.toString()}`);
          });
        });
      }).on('error', (err) => {
        onError(`[${vm.name || vm.ip}] Connection Error: ${err.message}\n`);
        reject(err);
      }).connect({
        host: vm.ip,
        port: vm.port,
        username: vm.username,
        password: vm.password,
        readyTimeout: 20000,
      });
    });
  },

  testConnection(vm: VM): Promise<ConnectionTestResult> {
    return new Promise((resolve) => {
      const conn = new Client();
      const startTime = Date.now();
      
      conn.on('ready', () => {
        const latency = Date.now() - startTime;
        conn.end();
        logger.info(`Connection test successful for VM ${vm.name || vm.ip}`);
        resolve({
          success: true,
          message: 'Connection successful',
          latency,
        });
      }).on('error', (err: Error & { code?: string }) => {
        let message = err.message;
        
        if (err.code === 'ECONNREFUSED') {
          message = 'Connection refused. Check if SSH service is running on the VM.';
        } else if (err.code === 'ETIMEDOUT' || err.code === 'EHOSTUNREACH') {
          message = 'Connection timed out. Check if the IP is correct and reachable.';
        } else if (err.message.includes('Authentication')) {
          message = 'Authentication failed. Check username and password.';
        } else if (err.message.includes('Host key')) {
          message = 'Host key verification failed.';
        }
        
        logger.warn(`Connection test failed for VM ${vm.name || vm.ip}: ${message}`);
        resolve({
          success: false,
          message,
        });
      }).connect({
        host: vm.ip,
        port: vm.port,
        username: vm.username,
        password: vm.password,
        readyTimeout: 15000,
      });
    });
  },

  changePassword(vm: VM, newPassword: string): Promise<PasswordChangeResult> {
    return new Promise((resolve) => {
      const conn = new Client();
      
      const username = vm.username;
      const currentPassword = vm.password || '';
      
      // Try multiple methods to change password
      // For systems where root password = user password
      const commands = [
        // Method 1: User changes own password via passwd (most reliable)
        // Uses heredoc to avoid shell escaping issues
        `passwd << 'PASSWORDEOF'
${currentPassword}
${newPassword}
${newPassword}
PASSWORDEOF`,

        // Method 2: Use su to become root (when root password = user password)
        // Then change password using passwd
        `su -c 'echo "${username}:${newPassword}" | chpasswd' root << 'SUROOTEOF'
${currentPassword}
SUROOTEOF`,

        // Method 3: Use sudo with -S flag and heredoc
        `sudo -S sh << 'SUDOEOF'
${currentPassword}
echo "${username}:${newPassword}" | chpasswd 2>/dev/null || printf '%s\n%s\n' '${newPassword}' '${newPassword}' | passwd ${username}
SUDOEOF`,

        // Method 4: Direct root approach via su - with passwd
        `su - root << 'SUEOF'
${currentPassword}
printf '%s\n%s\n' '${newPassword}' '${newPassword}' | passwd ${username}
SUEOF`,

        // Method 5: passwd with echo and pipe (fallback)
        `echo -e "${currentPassword}\n${newPassword}\n${newPassword}" | passwd 2>&1`,
      ];
      
      let currentCommandIndex = 0;
      
      const tryCommand = () => {
        if (currentCommandIndex >= commands.length) {
          conn.end();
          resolve({
            success: false,
            message: 'All password change methods failed. The user may not have sufficient privileges, or password tools are not available. Try changing the password manually via VM console.',
            requiresManual: true,
          });
          return;
        }
        
        const command = commands[currentCommandIndex];
        logger.debug(`Trying password method ${currentCommandIndex + 1} for VM ${vm.name || vm.ip}`);
        
        conn.exec(command, (err, stream) => {
          if (err) {
            currentCommandIndex++;
            tryCommand();
            return;
          }
          
          let output = '';
          let stderr = '';
          
          stream.on('data', (data: Buffer) => {
            output += data.toString();
          }).stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
          
          stream.on('close', (code: number) => {
            const fullOutput = output + stderr;
            const fullOutputLower = fullOutput.toLowerCase();
            
            // Log for debugging
            logger.debug(`Method ${currentCommandIndex + 1} output: ${fullOutput.substring(0, 500)}`);
            
            // Check for success indicators
            const hasSuccess = 
              fullOutputLower.includes('password updated') ||
              fullOutputLower.includes('password changed') ||
              fullOutputLower.includes('updated successfully') ||
              fullOutputLower.includes('all authentication tokens updated') ||
              fullOutputLower.includes('passwd: password updated') ||
              fullOutputLower.includes('passwd: all authentication tokens updated') ||
              fullOutputLower.includes('changing password for') && !fullOutputLower.includes('failed') ||
              (code === 0 && 
               !fullOutputLower.includes('error') && 
               !fullOutputLower.includes('failed') && 
               !fullOutputLower.includes('incorrect') && 
               !fullOutputLower.includes('denied') && 
               !fullOutputLower.includes('sorry') && 
               !fullOutputLower.includes('not found') &&
               !fullOutputLower.includes('authentication failure') &&
               !fullOutputLower.includes('no password'));
            
            if (hasSuccess) {
              conn.end();
              logger.info(`Password changed successfully for VM ${vm.name || vm.ip} using method ${currentCommandIndex + 1}`);
              resolve({
                success: true,
                message: 'Password changed successfully on VM',
              });
            } else {
              currentCommandIndex++;
              tryCommand();
            }
          });
        });
      };
      
      conn.on('ready', () => {
        logger.info(`Attempting password change for VM ${vm.name || vm.ip} (user: ${username})`);
        tryCommand();
      }).on('error', (err) => {
        resolve({
          success: false,
          message: `Connection failed: ${err.message}`,
        });
      }).connect({
        host: vm.ip,
        port: vm.port,
        username: vm.username,
        password: vm.password,
        readyTimeout: 15000,
      });
    });
  },

  testPassword(vm: VM, testPassword: string): Promise<boolean> {
    return new Promise((resolve) => {
      const conn = new Client();
      
      conn.on('ready', () => {
        conn.end();
        resolve(true);
      }).on('error', () => {
        resolve(false);
      }).connect({
        host: vm.ip,
        port: vm.port,
        username: vm.username,
        password: testPassword,
        readyTimeout: 10000,
      });
    });
  },

  generatePassword(length: number = 16, includeSpecialChars: boolean = true): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let chars = lowercase + uppercase + numbers;
    if (includeSpecialChars) chars += special;
    
    let password = '';
    const array = new Uint32Array(length);
    
    const crypto = require('crypto');
    crypto.randomFillSync(array);
    
    for (let i = 0; i < length; i++) {
      password += chars[array[i] % chars.length];
    }
    
    return password;
  },
};
