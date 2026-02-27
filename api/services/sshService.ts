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
      
      const escapedPassword = newPassword.replace(/'/g, "'\"'\"'");
      const currentPassword = vm.password || '';
      const escapedCurrentPassword = currentPassword.replace(/'/g, "'\"'\"'");
      const username = vm.username;
      
      // Try multiple methods to change password
      // Method 1: User changing own password (no sudo needed)
      // Method 2: Using sudo with chpasswd
      // Method 3: Using sudo with passwd --stdin
      // Method 4: Using sudo with interactive passwd
      const commands = [
        // Method 1: User changes own password (interactive passwd)
        `printf '%s\\n%s\\n%s\\n' '${escapedCurrentPassword}' '${escapedPassword}' '${escapedPassword}' | passwd 2>&1`,
        // Method 2: sudo with chpasswd
        `echo '${escapedCurrentPassword}' | sudo -S sh -c 'echo "${username}:${escapedPassword}" | chpasswd' 2>&1`,
        // Method 3: sudo with passwd --stdin (CentOS/RHEL)
        `echo '${escapedCurrentPassword}' | sudo -S passwd --stdin ${username} <<< '${escapedPassword}' 2>&1`,
        // Method 4: sudo with interactive passwd (Debian/Ubuntu)
        `echo '${escapedCurrentPassword}' | sudo -S sh -c 'printf "%s\\n%s\\n" "${escapedPassword}" "${escapedPassword}" | passwd ${username}' 2>&1`,
      ];
      
      const tryCommand = (commandIndex: number) => {
        if (commandIndex >= commands.length) {
          resolve({
            success: false,
            message: 'All password change methods failed. The user may not have sufficient privileges, or required tools (chpasswd/passwd) are not available.',
            requiresManual: true,
          });
          return;
        }
        
        const command = commands[commandIndex];
        
        conn.exec(command, (err, stream) => {
          if (err) {
            tryCommand(commandIndex + 1);
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
            
            // Check for success
            const hasSuccess = 
              fullOutputLower.includes('password updated') ||
              fullOutputLower.includes('password changed') ||
              fullOutputLower.includes('updated successfully') ||
              fullOutputLower.includes('all authentication tokens updated') ||
              fullOutputLower.includes('passwd: password updated') ||
              fullOutputLower.includes('passwd: all authentication tokens updated') ||
              (code === 0 && !fullOutputLower.includes('error') && !fullOutputLower.includes('failed') && 
               !fullOutputLower.includes('incorrect') && !fullOutputLower.includes('denied') && 
               !fullOutputLower.includes('sorry') && !fullOutputLower.includes('not found'));
            
            if (hasSuccess) {
              conn.end();
              logger.info(`Password changed successfully for VM ${vm.name || vm.ip} using method ${commandIndex + 1}`);
              resolve({
                success: true,
                message: 'Password changed successfully on VM',
              });
            } else {
              logger.debug(`Password method ${commandIndex + 1} failed: ${fullOutput}`);
              tryCommand(commandIndex + 1);
            }
          });
        });
      };
      
      conn.on('ready', () => {
        logger.info(`Attempting password change for VM ${vm.name || vm.ip}`);
        tryCommand(0);
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
