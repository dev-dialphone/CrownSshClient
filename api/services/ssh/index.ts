import { Client } from 'ssh2';
import { VM } from '../vmService.js';
import logger from '../../utils/logger.js';
import { generatePassword } from './passwordUtils.js';
import { getRootPasswordAttempt } from './connectionUtils.js';
import { changePasswordOnVM } from './passwordChanger.js';

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

  async testConnection(vm: VM): Promise<ConnectionTestResult> {
    return new Promise((resolve) => {
      const conn = new Client();
      const startTime = Date.now();
      
      conn.on('ready', async () => {
        const latency = Date.now() - startTime;
        
        const rootResult = await getRootPasswordAttempt(vm);
        conn.end();
        
        if (rootResult) {
          logger.info(`Connection test successful for VM ${vm.name || vm.ip} (user and root via ${rootResult.source})`);
          resolve({
            success: true,
            message: `Connection successful (user and root via ${rootResult.source})`,
            latency,
          });
        } else {
          logger.info(`Connection test successful for VM ${vm.name || vm.ip} (user only, root password not found)`);
          resolve({
            success: true,
            message: 'Connection successful (user only - could not determine root password)',
            latency,
          });
        }
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
      
      conn.on('ready', () => {
        changePasswordOnVM(conn, vm, newPassword)
          .then(result => {
            conn.end();
            resolve(result);
          })
          .catch(err => {
            conn.end();
            resolve({
              success: false,
              message: `Password change failed: ${err.message}`,
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

  testPassword(vm: VM, testPassword: string): Promise<{ user: boolean; root: boolean }> {
    return new Promise((resolve) => {
      const userConn = new Client();
      
      userConn.on('ready', () => {
        userConn.end();
        
        const rootConn = new Client();
        rootConn.on('ready', () => {
          rootConn.end();
          resolve({ user: true, root: true });
        }).on('error', () => {
          resolve({ user: true, root: false });
        }).connect({
          host: vm.ip,
          port: vm.port,
          username: 'root',
          password: testPassword,
          readyTimeout: 10000,
        });
      }).on('error', () => {
        resolve({ user: false, root: false });
      }).connect({
        host: vm.ip,
        port: vm.port,
        username: vm.username,
        password: testPassword,
        readyTimeout: 10000,
      });
    });
  },

  generatePassword,
};
