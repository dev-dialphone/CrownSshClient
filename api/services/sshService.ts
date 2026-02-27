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
      
      const escapedPassword = newPassword.replace(/'/g, "'\\''");
      const command = `echo '${vm.username}:${escapedPassword}' | sudo -S chpasswd 2>&1 || echo '${vm.username}:${escapedPassword}' | chpasswd 2>&1`;
      
      conn.on('ready', () => {
        logger.info(`Attempting password change for VM ${vm.name || vm.ip}`);
        
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            resolve({
              success: false,
              message: `Command execution failed: ${err.message}`,
            });
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
            conn.end();
            
            const fullOutput = (output + stderr).toLowerCase();
            
            if (code === 0 && !fullOutput.includes('error') && !fullOutput.includes('failed')) {
              logger.info(`Password change command executed successfully for VM ${vm.name || vm.ip}`);
              resolve({
                success: true,
                message: 'Password changed successfully on VM',
              });
            } else if (fullOutput.includes('permission denied') || fullOutput.includes('not allowed')) {
              resolve({
                success: false,
                message: 'Permission denied. Password change requires root privileges or sudo access.',
                requiresManual: true,
              });
            } else if (fullOutput.includes('pam') || fullOutput.includes('complexity') || fullOutput.includes('too short')) {
              resolve({
                success: false,
                message: 'Password rejected by PAM policy. The password may not meet complexity requirements.',
                requiresManual: true,
              });
            } else if (fullOutput.includes('authentication token manipulation')) {
              resolve({
                success: false,
                message: 'Authentication token manipulation error. The password database may be locked.',
                requiresManual: true,
              });
            } else {
              resolve({
                success: false,
                message: `Password change failed: ${output || stderr || `Exit code: ${code}`}`,
              });
            }
          });
        });
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
