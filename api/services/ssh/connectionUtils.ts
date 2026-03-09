import { Client } from 'ssh2';
import { VM } from '../vmService.js';
import logger from '../../utils/logger.js';

export async function tryRootLogin(vm: VM, password: string): Promise<boolean> {
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
}

export async function getRootPasswordAttempt(vm: VM): Promise<{ password: string; source: string } | null> {
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
}
