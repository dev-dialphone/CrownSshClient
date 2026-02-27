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

export interface OpenSIPSConfig {
  mysqlHost?: string;
  mysqlUser?: string;
  mysqlPassword?: string;
  mysqlDatabase?: string;
  adminUsername?: string;
}

const OPEN_SIPS_DEFAULT_CONFIG: OpenSIPSConfig = {
  mysqlHost: 'localhost',
  mysqlUser: 'root',
  mysqlPassword: 'mcm852258',
  mysqlDatabase: 'opensips',
  adminUsername: 'admin',
};

const escapeForShell = (str: string): string => {
  return str.replace(/'/g, "'\\''");
};

const escapeForDoubleQuotes = (str: string): string => {
  return str.replace(/["$`\\!]/g, '\\$&');
};

const SAFE_SPECIAL_CHARS = '@#%^*_+=[]{}:.<>?~';

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
      
      const escapedCurrent = escapeForShell(currentPassword);
      const escapedNew = escapeForShell(newPassword);
      const escapedNewDQ = escapeForDoubleQuotes(newPassword);
      const escapedUser = escapeForShell(username);
      
      const commands = [
        {
          name: 'chpasswd with sudo',
          cmd: `echo '${escapedUser}:${escapedNew}' | sudo -S chpasswd 2>&1`,
          needsPty: true,
          isSudo: true,
        },
        {
          name: 'chpasswd with su',
          cmd: `su - root -c "echo '${escapedUser}:${escapedNew}' | chpasswd" 2>&1`,
          needsPty: true,
          isSu: true,
        },
        {
          name: 'passwd --stdin (RedHat/CentOS)',
          cmd: `echo '${escapedNew}' | sudo -S passwd --stdin ${escapedUser} 2>&1`,
          needsPty: true,
          isSudo: true,
        },
        {
          name: 'interactive passwd with PTY',
          cmd: `passwd`,
          needsPty: true,
          interactive: true,
        },
        {
          name: 'usermod with sudo',
          cmd: `echo '${escapedNew}' | sudo -S passwd ${escapedUser} --stdin 2>&1 || echo '${escapedUser}:${escapedNew}' | sudo -S chpasswd 2>&1`,
          needsPty: true,
          isSudo: true,
        },
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
        
        const method = commands[currentCommandIndex];
        logger.info(`Trying password method ${currentCommandIndex + 1} (${method.name}) for VM ${vm.name || vm.ip}`);
        
        const execOpts: { pty?: boolean } = {};
        if (method.needsPty) {
          execOpts.pty = true;
        }
        
        conn.exec(method.cmd, execOpts, (err, stream) => {
          if (err) {
            logger.debug(`Method ${method.name} exec error: ${err.message}`);
            currentCommandIndex++;
            tryCommand();
            return;
          }
          
          let output = '';
          let stderr = '';
          let passwordSent = false;
          let sudoPasswordSent = false;
          
          stream.on('data', (data: Buffer) => {
            const dataStr = data.toString();
            output += dataStr;
            
            if (method.isSudo && !sudoPasswordSent) {
              if (dataStr.includes('[sudo]') || dataStr.toLowerCase().includes('password for')) {
                stream.write(currentPassword + '\n');
                sudoPasswordSent = true;
                return;
              }
            }
            
            if (method.isSu && !sudoPasswordSent) {
              if (dataStr.toLowerCase().includes('password:')) {
                stream.write(currentPassword + '\n');
                sudoPasswordSent = true;
                return;
              }
            }
            
            if (method.interactive && !passwordSent) {
              const lowerData = dataStr.toLowerCase();
              if (lowerData.includes('current') || lowerData.includes('old') || lowerData.includes('(current)')) {
                stream.write(currentPassword + '\n');
              } else if (lowerData.includes('new') || lowerData.includes('enter new')) {
                stream.write(newPassword + '\n');
              } else if (lowerData.includes('retype') || lowerData.includes('re-enter') || lowerData.includes('again')) {
                stream.write(newPassword + '\n');
                passwordSent = true;
              }
            }
          }).stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
          
          stream.on('close', (code: number, signal: string) => {
            const fullOutput = output + stderr;
            const fullOutputLower = fullOutput.toLowerCase();
            
            logger.debug(`Method ${method.name} result (code=${code}, signal=${signal}): ${fullOutput.substring(0, 500)}`);
            
            const hasError = 
              fullOutputLower.includes('error') ||
              fullOutputLower.includes('failed') ||
              fullOutputLower.includes('failure') ||
              fullOutputLower.includes('incorrect') ||
              fullOutputLower.includes('invalid') ||
              fullOutputLower.includes('denied') ||
              fullOutputLower.includes('sorry') ||
              fullOutputLower.includes('not found') ||
              fullOutputLower.includes('not allowed') ||
              fullOutputLower.includes('authentication failure') ||
              fullOutputLower.includes('permission denied') ||
              fullOutputLower.includes('must be different') ||
              fullOutputLower.includes('too short') ||
              fullOutputLower.includes('too simple') ||
              fullOutputLower.includes('bad password') ||
              fullOutputLower.includes('bad: new password') ||
              fullOutputLower.includes('password unchanged') ||
              signal === 'SIGTERM' ||
              signal === 'SIGKILL';
            
            const hasSuccess = 
              fullOutputLower.includes('password updated') ||
              fullOutputLower.includes('password changed') ||
              fullOutputLower.includes('updated successfully') ||
              fullOutputLower.includes('all authentication tokens updated') ||
              fullOutputLower.includes('passwd: password updated') ||
              fullOutputLower.includes('passwd: all authentication tokens updated') ||
              fullOutputLower.includes('success') ||
              (code === 0 && !hasError && fullOutput.length > 0 && method.interactive && passwordSent);
            
            if (hasSuccess && !hasError) {
              conn.end();
              logger.info(`Password changed successfully for VM ${vm.name || vm.ip} using method ${method.name}`);
              resolve({
                success: true,
                message: `Password changed successfully on VM using ${method.name}`,
              });
            } else {
              logger.debug(`Method ${method.name} failed, trying next...`);
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
    
    let chars = lowercase + uppercase + numbers;
    if (includeSpecialChars) {
      chars += SAFE_SPECIAL_CHARS;
    }
    
    let password = '';
    const array = new Uint32Array(length);
    
    const crypto = require('crypto');
    crypto.randomFillSync(array);
    
    for (let i = 0; i < length; i++) {
      password += chars[array[i] % chars.length];
    }
    
    return password;
  },

  updateOpenSIPSAdminPassword(
    vm: VM, 
    newPassword: string, 
    config: OpenSIPSConfig = {}
  ): Promise<PasswordChangeResult> {
    return new Promise((resolve) => {
      const conn = new Client();
      
      const finalConfig = { ...OPEN_SIPS_DEFAULT_CONFIG, ...config };
      const escapedNew = escapeForShell(newPassword);
      const escapedAdminUser = escapeForShell(finalConfig.adminUsername || 'admin');
      const escapedMySqlPass = escapeForShell(finalConfig.mysqlPassword || '');
      
      const ha1Input = `${finalConfig.adminUsername}:opensips.org:${newPassword}`;
      
      const mysqlCommand = `mysql -h ${finalConfig.mysqlHost} -u ${finalConfig.mysqlUser} -p'${escapedMySqlPass}' ${finalConfig.mysqlDatabase} -e "UPDATE ocp_admin_privileges SET password='${escapedNew}', ha1=MD5('${escapeForShell(ha1Input)}'), blocked=NULL, failed_attempts=0 WHERE username='${escapedAdminUser}';" 2>&1`;
      
      conn.on('ready', () => {
        logger.info(`Updating OpenSIPS admin password for VM ${vm.name || vm.ip}`);
        
        conn.exec(mysqlCommand, (err, stream) => {
          if (err) {
            logger.error(`OpenSIPS password update exec error: ${err.message}`);
            conn.end();
            resolve({
              success: false,
              message: `Failed to execute MySQL command: ${err.message}`,
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
            const fullOutput = output + stderr;
            
            if (code === 0 && !fullOutput.toLowerCase().includes('error')) {
              logger.info(`OpenSIPS admin password updated successfully for VM ${vm.name || vm.ip}`);
              conn.end();
              resolve({
                success: true,
                message: 'OpenSIPS admin password updated successfully in MySQL database',
              });
            } else {
              logger.error(`OpenSIPS password update failed: ${fullOutput}`);
              conn.end();
              resolve({
                success: false,
                message: `Failed to update OpenSIPS password: ${fullOutput}`,
                requiresManual: true,
              });
            }
          });
        });
      }).on('error', (err) => {
        logger.error(`OpenSIPS password update connection error: ${err.message}`);
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
};
