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

export interface OSInfo {
  id: string;
  name: string;
  version: string;
  isCentOS: boolean;
  isRHEL: boolean;
  isDebian: boolean;
  isUbuntu: boolean;
}

const escapeForShell = (str: string): string => {
  return str.replace(/'/g, "'\\''");
};

const escapeForDoubleQuotes = (str: string): string => {
  return str.replace(/["$`\\!]/g, '\\$&');
};

const SAFE_SPECIAL_CHARS = '@#%^*_+=[]{}:.<>?~';

const tryRootLogin = (vm: VM, password: string): Promise<boolean> => {
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
      username: 'root',
      password: password,
      readyTimeout: 10000,
    });
  });
};

const getRootPasswordAttempt = async (vm: VM): Promise<{ password: string; source: string } | null> => {
  if (vm.username) {
    const usernameWorks = await tryRootLogin(vm, vm.username);
    if (usernameWorks) {
      logger.info(`Root login for VM ${vm.name || vm.ip} works with username as password`);
      return { password: vm.username, source: 'username' };
    }
  }
  
  if (vm.password) {
    const passwordWorks = await tryRootLogin(vm, vm.password);
    if (passwordWorks) {
      logger.info(`Root login for VM ${vm.name || vm.ip} works with vm.password`);
      return { password: vm.password, source: 'password' };
    }
  }
  
  logger.warn(`Root login for VM ${vm.name || vm.ip} failed with both username and password`);
  return null;
};

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
    return new Promise(async (resolve) => {
      const conn = new Client();
      
      const username = vm.username;
      const currentPassword = vm.password || '';
      
      conn.on('ready', async () => {
        logger.info(`Connected to VM ${vm.name || vm.ip} for password change`);
        
        let osInfo: OSInfo | null = null;
        
        const detectedOS = await new Promise<OSInfo | null>((osResolve) => {
          conn.exec('cat /etc/os-release 2>/dev/null || cat /etc/redhat-release 2>/dev/null || uname -a', (err, stream) => {
            if (err) {
              osResolve(null);
              return;
            }
            
            let output = '';
            stream.on('data', (data: Buffer) => {
              output += data.toString();
            }).on('close', () => {
              const info: OSInfo = {
                id: 'unknown',
                name: 'Unknown',
                version: '',
                isCentOS: false,
                isRHEL: false,
                isDebian: false,
                isUbuntu: false,
              };
              
              const idMatch = output.match(/^ID=["']?([^"'\n]+)["']?/m);
              const nameMatch = output.match(/^NAME=["']?([^"'\n]+)["']?/m);
              const versionMatch = output.match(/^VERSION_ID=["']?([^"'\n]+)["']?/m);
              
              if (idMatch) info.id = idMatch[1].toLowerCase();
              if (nameMatch) info.name = nameMatch[1];
              if (versionMatch) info.version = versionMatch[1];
              
              info.isCentOS = info.id === 'centos' || output.toLowerCase().includes('centos');
              info.isRHEL = info.id === 'rhel' || output.toLowerCase().includes('red hat');
              info.isDebian = info.id === 'debian';
              info.isUbuntu = info.id === 'ubuntu';
              
              logger.info(`Detected OS for VM ${vm.name || vm.ip}: ${info.name} (${info.id}) version ${info.version}`);
              osResolve(info);
            });
          });
        });
        
        osInfo = detectedOS;
        
        if (!osInfo) {
          conn.end();
          resolve({
            success: false,
            message: 'Failed to detect OS',
          });
          return;
        }
        
        const rootPasswordInfo = await getRootPasswordAttempt(vm);
        const sudoPassword = rootPasswordInfo ? rootPasswordInfo.password : currentPassword;
        
        const escapedCurrent = escapeForShell(currentPassword);
        const escapedNew = escapeForShell(newPassword);
        const escapedUser = escapeForShell(username);
        
        const isRHELFamily = osInfo.isCentOS || osInfo.isRHEL;
        
        const getCommands = () => {
          if (isRHELFamily) {
            return [
              {
                name: 'passwd --stdin (CentOS/RHEL)',
                cmd: `echo '${escapedNew}' | sudo -S passwd --stdin ${escapedUser} 2>&1`,
                needsPty: true,
                isSudo: true,
              },
              {
                name: 'chpasswd with sudo (CentOS/RHEL)',
                cmd: `echo '${escapedUser}:${escapedNew}' | sudo -S chpasswd 2>&1`,
                needsPty: true,
                isSudo: true,
              },
              {
                name: 'interactive passwd with PTY (CentOS/RHEL)',
                cmd: `passwd`,
                needsPty: true,
                interactive: true,
              },
            ];
          }
          
          return [
            {
              name: 'interactive passwd with PTY',
              cmd: `passwd`,
              needsPty: true,
              interactive: true,
            },
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
          ];
        };
        
        const getRootCommands = () => {
          if (isRHELFamily) {
            return [
              {
                name: 'root passwd --stdin (CentOS/RHEL)',
                cmd: `echo '${escapedNew}' | sudo -S passwd --stdin root 2>&1`,
                needsPty: true,
                isSudo: true,
              },
              {
                name: 'root chpasswd with sudo (CentOS/RHEL)',
                cmd: `echo 'root:${escapedNew}' | sudo -S chpasswd 2>&1`,
                needsPty: true,
                isSudo: true,
              },
            ];
          }
          
          return [
            {
              name: 'root password via chpasswd with sudo',
              cmd: `echo 'root:${escapedNew}' | sudo -S chpasswd 2>&1`,
              needsPty: true,
              isSudo: true,
            },
            {
              name: 'root password via su',
              cmd: `su - root -c "echo 'root:${escapedNew}' | chpasswd" 2>&1`,
              needsPty: true,
              isSu: true,
            },
          ];
        };
        
        const commands = getCommands();
        const rootCommands = getRootCommands();
        
        const changeRootPassword = async (): Promise<boolean> => {
          return new Promise((rootResolve) => {
            let rootCmdIndex = 0;
            
            const tryRootCommand = () => {
              if (rootCmdIndex >= rootCommands.length) {
                logger.warn(`Could not change root password for VM ${vm.name || vm.ip}, but user password was changed`);
                rootResolve(false);
                return;
              }
              
              const rootMethod = rootCommands[rootCmdIndex];
              logger.info(`Trying root password method ${rootCmdIndex + 1} (${rootMethod.name}) for VM ${vm.name || vm.ip}`);
              
              const execOpts: { pty?: boolean } = {};
              if (rootMethod.needsPty) {
                execOpts.pty = true;
              }
              
              conn.exec(rootMethod.cmd, execOpts, (err, stream) => {
                if (err) {
                  rootCmdIndex++;
                  tryRootCommand();
                  return;
                }
                
                let output = '';
                let stderr = '';
                let sudoPasswordSent = false;
                
                stream.on('data', (data: Buffer) => {
                  const dataStr = data.toString();
                  output += dataStr;
                  logger.info(`[${rootMethod.name}] Received: ${dataStr.trim()}`);
                  
                  if (rootMethod.isSudo && !sudoPasswordSent) {
                    if (dataStr.includes('[sudo]') || dataStr.toLowerCase().includes('password for')) {
                      logger.info(`[${rootMethod.name}] Sending sudo password (from ${rootPasswordInfo?.source || 'fallback'})...`);
                      stream.write(sudoPassword + '\n');
                      sudoPasswordSent = true;
                    }
                  }
                  
                  if (rootMethod.isSu && !sudoPasswordSent) {
                    if (dataStr.toLowerCase().includes('password')) {
                      logger.info(`[${rootMethod.name}] Sending su password (from ${rootPasswordInfo?.source || 'fallback'})...`);
                      stream.write(sudoPassword + '\n');
                      sudoPasswordSent = true;
                    }
                  }
                }).stderr.on('data', (data: Buffer) => {
                  stderr += data.toString();
                });
                
                stream.on('close', (code: number) => {
                  const fullOutput = output + stderr;
                  const fullOutputLower = fullOutput.toLowerCase();
                  
                  logger.info(`[${rootMethod.name}] Exit code: ${code}, output: ${fullOutput.substring(0, 200)}`);
                  
                  const hasError = 
                    fullOutputLower.includes('error') ||
                    fullOutputLower.includes('failed') ||
                    fullOutputLower.includes('denied') ||
                    fullOutputLower.includes('sorry');
                  
                  if (code === 0 && !hasError) {
                    logger.info(`Root password changed successfully for VM ${vm.name || vm.ip} using ${rootMethod.name}`);
                    rootResolve(true);
                  } else {
                    rootCmdIndex++;
                    tryRootCommand();
                  }
                });
              });
            };
            
            tryRootCommand();
          });
        };
        
        let currentCommandIndex = 0;
        
        const tryCommand = async () => {
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
              logger.warn(`Method ${method.name} exec error: ${err.message}`);
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
              logger.info(`[${method.name}] Received: ${dataStr.trim()}`);
              
              if (method.isSudo && !sudoPasswordSent) {
                if (dataStr.includes('[sudo]') || dataStr.toLowerCase().includes('password for')) {
                  logger.info(`[${method.name}] Sending sudo password (from ${rootPasswordInfo?.source || 'fallback'})...`);
                  stream.write(sudoPassword + '\n');
                  sudoPasswordSent = true;
                  return;
                }
              }
              
              if (method.isSu && !sudoPasswordSent) {
                if (dataStr.toLowerCase().includes('password')) {
                  logger.info(`[${method.name}] Sending su password (from ${rootPasswordInfo?.source || 'fallback'})...`);
                  stream.write(sudoPassword + '\n');
                  sudoPasswordSent = true;
                  return;
                }
              }
              
              if (method.interactive && !passwordSent) {
                const lowerData = dataStr.toLowerCase();
                if (lowerData.includes('current') || lowerData.includes('old') || lowerData.includes('(current)')) {
                  logger.info(`[${method.name}] Sending current password...`);
                  stream.write(currentPassword + '\n');
                } else if (lowerData.includes('new') && (lowerData.includes('password') || lowerData.includes('enter'))) {
                  logger.info(`[${method.name}] Sending new password...`);
                  stream.write(newPassword + '\n');
                } else if (lowerData.includes('retype') || lowerData.includes('re-enter') || lowerData.includes('again') || lowerData.includes('confirm')) {
                  logger.info(`[${method.name}] Confirming new password...`);
                  stream.write(newPassword + '\n');
                  passwordSent = true;
                }
              }
            }).stderr.on('data', (data: Buffer) => {
              stderr += data.toString();
            });
            
            stream.on('close', async (code: number, signal: string) => {
              const fullOutput = output + stderr;
              const fullOutputLower = fullOutput.toLowerCase();
              
              logger.info(`[${method.name}] Exit code: ${code}, signal: ${signal}`);
              logger.info(`[${method.name}] Output: ${fullOutput.substring(0, 500)}`);
              
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
                (code === 0 && !hasError && passwordSent && method.interactive);
              
              if (hasSuccess && !hasError) {
                logger.info(`User password changed successfully for VM ${vm.name || vm.ip} using method ${method.name}`);
                
                const rootChanged = await changeRootPassword();
                
                conn.end();
                resolve({
                  success: true,
                  message: rootChanged 
                    ? `Password changed successfully for user and root on VM`
                    : `User password changed successfully on VM (root password may need manual update)`,
                });
              } else {
                logger.warn(`Method ${method.name} failed (code=${code}, hasError=${hasError}), trying next...`);
                currentCommandIndex++;
                tryCommand();
              }
            });
          });
        };
        
        logger.info(`Attempting password change for VM ${vm.name || vm.ip} (user: ${username}, OS: ${isRHELFamily ? 'RHEL/CentOS' : 'Debian/Other'})`);
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
};
