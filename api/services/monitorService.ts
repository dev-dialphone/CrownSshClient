import { Client } from 'ssh2';
import { VM } from './vmService.js';
import logger from '../utils/logger.js';

export interface MonitoringMetrics {
  vmId: string;
  vmName: string;
  vmIp: string;
  activeCalls: number;
  maxSessions: number;
  peakCalls: number;
  currentCPS: number;
  maxCPS: number;
  totalSessions: number;
  usagePercent: number;
  status: 'healthy' | 'warning' | 'critical' | 'error';
  error?: string;
  timestamp: Date;
}

export interface EnvironmentSummary {
  totalActive: number;
  totalCapacity: number;
  totalCPS: number;
  maxCPS: number;
  usagePercent: number;
  healthyVMs: number;
  errorVMs: number;
  totalVMs: number;
}

export interface MonitoringResult {
  summary: EnvironmentSummary;
  vms: Record<string, MonitoringMetrics>;
  lastUpdated: Date;
}

const parseIVGOutput = (output: string): Partial<MonitoringMetrics> => {
  const metrics: Partial<MonitoringMetrics> = {
    activeCalls: 0,
    maxSessions: 0,
    peakCalls: 0,
    currentCPS: 0,
    maxCPS: 0,
    totalSessions: 0,
  };

  const lines = output.split('\n');

  for (const line of lines) {
    const sessionSinceStartup = line.match(/(\d+)\s+session\(s\)\s+since\s+startup/i);
    if (sessionSinceStartup) {
      metrics.totalSessions = parseInt(sessionSinceStartup[1], 10);
    }

    const sessionPeakMatch = line.match(/(\d+)\s+session\(s\)\s*-\s*peak\s+(\d+)/i);
    if (sessionPeakMatch) {
      metrics.activeCalls = parseInt(sessionPeakMatch[1], 10);
      metrics.peakCalls = parseInt(sessionPeakMatch[2], 10);
    }

    const cpsMatch = line.match(/(\d+)\s+session\(s\)\s+per\s+Sec\s+out\s+of\s+max\s+(\d+)/i);
    if (cpsMatch) {
      metrics.currentCPS = parseInt(cpsMatch[1], 10);
      metrics.maxCPS = parseInt(cpsMatch[2], 10);
    }

    const maxSessionsMatch = line.match(/(\d+)\s+session\(s\)\s+max/i);
    if (maxSessionsMatch) {
      metrics.maxSessions = parseInt(maxSessionsMatch[1], 10);
    }
  }

  if ((metrics.maxSessions ?? 0) > 0 && metrics.activeCalls !== undefined) {
    metrics.usagePercent = Math.round((metrics.activeCalls / metrics.maxSessions!) * 100 * 10) / 10;
  }

  return metrics;
};

interface OPSDialogStats {
  'dialog:active_dialogs'?: number;
  'dialog:early_dialogs'?: number;
  'dialog:processed_dialogs'?: number;
  'dialog:expired_dialogs'?: number;
  'dialog:failed_dialogs'?: number;
  'dialog:create_sent'?: number;
  'dialog:update_sent'?: number;
  'dialog:delete_sent'?: number;
  'dialog:create_recv'?: number;
  'dialog:update_recv'?: number;
  'dialog:delete_recv'?: number;
}

const parseOPSOutput = (output: string): Partial<MonitoringMetrics> => {
  const metrics: Partial<MonitoringMetrics> = {
    activeCalls: 0,
    maxSessions: 0,
    peakCalls: 0,
    currentCPS: 0,
    maxCPS: 0,
    totalSessions: 0,
  };

  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return metrics;
    }

    const data: OPSDialogStats = JSON.parse(jsonMatch[0]);

    metrics.activeCalls = data['dialog:active_dialogs'] || 0;
    metrics.totalSessions = data['dialog:processed_dialogs'] || 0;
  } catch {
    logger.warn('Failed to parse OPS output as JSON');
  }

  return metrics;
};

const parseMonitoringOutput = (output: string): Partial<MonitoringMetrics> => {
  if (output.includes('opensips-cli') || output.includes('dialog:active_dialogs')) {
    return parseOPSOutput(output);
  }
  return parseIVGOutput(output);
};

const getStatus = (usagePercent: number): 'healthy' | 'warning' | 'critical' => {
  if (usagePercent >= 90) return 'critical';
  if (usagePercent >= 70) return 'warning';
  return 'healthy';
};

const executeMonitoringCommand = (vm: VM, command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('Command timeout'));
    }, 15000);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          reject(err);
          return;
        }

        stream.on('close', () => {
          clearTimeout(timeout);
          conn.end();
          resolve(output);
        }).on('data', (data: Buffer) => {
          output += data.toString();
        }).stderr.on('data', (data: Buffer) => {
          output += data.toString();
        });
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    }).connect({
      host: vm.ip,
      port: vm.port,
      username: vm.username,
      password: vm.password,
      readyTimeout: 10000,
    });
  });
};

export const monitorService = {
  async getMetricsForVM(vm: VM, monitoringCommand: string): Promise<MonitoringMetrics> {
    const timestamp = new Date();

    if (!monitoringCommand) {
      return {
        vmId: vm.id,
        vmName: vm.name,
        vmIp: vm.ip,
        activeCalls: 0,
        maxSessions: 0,
        peakCalls: 0,
        currentCPS: 0,
        maxCPS: 0,
        totalSessions: 0,
        usagePercent: 0,
        status: 'error',
        error: 'No monitoring command configured for this environment',
        timestamp,
      };
    }

    try {
      const output = await executeMonitoringCommand(vm, monitoringCommand);
      logger.debug(`Monitoring output for VM ${vm.name}: ${output}`);

      const parsed = parseMonitoringOutput(output);

      const usagePercent = parsed.usagePercent || 0;
      const status = getStatus(usagePercent);

      return {
        vmId: vm.id,
        vmName: vm.name,
        vmIp: vm.ip,
        activeCalls: parsed.activeCalls || 0,
        maxSessions: parsed.maxSessions || 0,
        peakCalls: parsed.peakCalls || 0,
        currentCPS: parsed.currentCPS || 0,
        maxCPS: parsed.maxCPS || 0,
        totalSessions: parsed.totalSessions || 0,
        usagePercent,
        status,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Monitoring failed for VM ${vm.name}: ${errorMessage}`);

      return {
        vmId: vm.id,
        vmName: vm.name,
        vmIp: vm.ip,
        activeCalls: 0,
        maxSessions: 0,
        peakCalls: 0,
        currentCPS: 0,
        maxCPS: 0,
        totalSessions: 0,
        usagePercent: 0,
        status: 'error',
        error: errorMessage,
        timestamp,
      };
    }
  },

  async getMetricsForEnvironment(
    vms: VM[],
    monitoringCommand: string
  ): Promise<MonitoringResult> {
    const timestamp = new Date();
    const vmMetrics: Record<string, MonitoringMetrics> = {};

    const results = await Promise.all(
      vms.map(vm => this.getMetricsForVM(vm, monitoringCommand))
    );

    for (const metrics of results) {
      vmMetrics[metrics.vmId] = metrics;
    }

    const summary: EnvironmentSummary = {
      totalActive: 0,
      totalCapacity: 0,
      totalCPS: 0,
      maxCPS: 0,
      usagePercent: 0,
      healthyVMs: 0,
      errorVMs: 0,
      totalVMs: vms.length,
    };

    for (const metrics of results) {
      if (metrics.status === 'error') {
        summary.errorVMs++;
      } else {
        summary.healthyVMs++;
        summary.totalActive += metrics.activeCalls;
        summary.totalCapacity += metrics.maxSessions;
        summary.totalCPS += metrics.currentCPS;
        summary.maxCPS += metrics.maxCPS;
      }
    }

    if (summary.totalCapacity > 0) {
      summary.usagePercent = Math.round((summary.totalActive / summary.totalCapacity) * 100 * 10) / 10;
    }

    return {
      summary,
      vms: vmMetrics,
      lastUpdated: timestamp,
    };
  },
};
