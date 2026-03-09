import { Client } from 'ssh2';
import { VM } from '../vmService.js';
import logger from '../../utils/logger.js';
import { OSInfo, parseOSInfo, getCommandsForOS, getRootCommandsForOS } from './osUtils.js';
import { getRootPasswordAttempt } from './connectionUtils.js';
import { escapeForShell } from './passwordUtils.js';

async function detectOS(conn: Client, vm: VM): Promise<OSInfo | null> {
  return new Promise((osResolve) => {
    conn.exec('cat /etc/os-release 2>/dev/null || cat /etc/redhat-release 2>/dev/null || uname -a', (err, stream) => {
      if (err) {
        osResolve(null);
        return;
      }
      
      let output = '';
      stream.on('data', (data: Buffer) => {
        output += data.toString();
      }).on('close', () => {
        const info = parseOSInfo(output);
        logger.info(`Detected OS for VM ${vm.name || vm.ip}: ${info.name} (${info.id}) version ${info.version}`);
        osResolve(info);
      });
    });
  });
}

async function changeRootPassword(
  conn: Client,
  vm: VM,
  osInfo: OSInfo,
  newPassword: string,
  sudoPassword: string,
  rootPasswordInfo: { password: string; source: string } | null
): Promise<boolean> {
  const rootCommands = getRootCommandsForOS(osInfo, newPassword);
  let rootCmdIndex = 0;
  
  const tryRootCommand = (): Promise<boolean> => {
    return new Promise((rootResolve) => {
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
          tryRootCommand().then(rootResolve);
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
            tryRootCommand().then(rootResolve);
          }
        });
      });
    });
  };
  
  return tryRootCommand();
}

export async function changePasswordOnVM(
  conn: Client,
  vm: VM,
  newPassword: string
): Promise<{ success: boolean; message: string; requiresManual?: boolean }> {
  const username = vm.username;
  const currentPassword = vm.password || '';
  
  logger.info(`Connected to VM ${vm.name || vm.ip} for password change`);
  
  const osInfo = await detectOS(conn, vm);
  
  if (!osInfo) {
    return {
      success: false,
      message: 'Failed to detect OS',
    };
  }
  
  const rootPasswordInfo = await getRootPasswordAttempt(vm);
  const sudoPassword = rootPasswordInfo ? rootPasswordInfo.password : currentPassword;
  
  const escapedCurrent = escapeForShell(currentPassword);
  const commands = getCommandsForOS(osInfo, username, newPassword, escapedCurrent);
  
  let currentCommandIndex = 0;
  
  const tryCommand = async (): Promise<{ success: boolean; message: string; requiresManual?: boolean }> => {
    if (currentCommandIndex >= commands.length) {
      return {
        success: false,
        message: 'All password change methods failed. The user may not have sufficient privileges, or password tools are not available. Try changing the password manually via VM console.',
        requiresManual: true,
      };
    }
    
    const method = commands[currentCommandIndex];
    logger.info(`Trying password method ${currentCommandIndex + 1} (${method.name}) for VM ${vm.name || vm.ip}`);
    
    const execOpts: { pty?: boolean } = {};
    if (method.needsPty) {
      execOpts.pty = true;
    }
    
    return new Promise((resolve) => {
      conn.exec(method.cmd, execOpts, (err, stream) => {
        if (err) {
          logger.warn(`Method ${method.name} exec error: ${err.message}`);
          currentCommandIndex++;
          tryCommand().then(resolve);
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
            
            const rootChanged = await changeRootPassword(conn, vm, osInfo, newPassword, sudoPassword, rootPasswordInfo);
            
            return resolve({
              success: true,
              message: rootChanged 
                ? `Password changed successfully for user and root on VM`
                : `User password changed successfully on VM (root password may need manual update)`,
            });
          } else {
            logger.warn(`Method ${method.name} failed (code=${code}, hasError=${hasError}), trying next...`);
            currentCommandIndex++;
            return tryCommand().then(resolve);
          }
        });
      });
    });
  };
  
  const isRHELFamily = osInfo.isCentOS || osInfo.isRHEL;
  logger.info(`Attempting password change for VM ${vm.name || vm.ip} (user: ${username}, OS: ${isRHELFamily ? 'RHEL/CentOS' : 'Debian/Other'})`);
  
  return tryCommand();
}
