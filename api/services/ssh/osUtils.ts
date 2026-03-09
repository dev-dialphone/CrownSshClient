export interface OSInfo {
  id: string;
  name: string;
  version: string;
  isCentOS: boolean;
  isRHEL: boolean;
  isDebian: boolean;
  isUbuntu: boolean;
}

export function parseOSInfo(output: string): OSInfo {
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
  
  return info;
}

export function getCommandsForOS(osInfo: OSInfo, username: string, newPassword: string, _escapedCurrent: string): Array<{
  name: string;
  cmd: string;
  needsPty: boolean;
  interactive?: boolean;
  isSudo?: boolean;
  isSu?: boolean;
}> {
  const escapedNew = newPassword.replace(/'/g, "'\\''");
  const escapedUser = username.replace(/'/g, "'\\''");
  const isRHELFamily = osInfo.isCentOS || osInfo.isRHEL;
  
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
}

export function getRootCommandsForOS(osInfo: OSInfo, newPassword: string): Array<{
  name: string;
  cmd: string;
  needsPty: boolean;
  isSudo?: boolean;
  isSu?: boolean;
}> {
  const escapedNew = newPassword.replace(/'/g, "'\\''");
  const isRHELFamily = osInfo.isCentOS || osInfo.isRHEL;
  
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
}
