import net from 'net';
import cron from 'node-cron';
import { VMModel } from '../models/VM.js';
import { sendPushToAll } from './pushService.js';
import { emailService } from './emailService.js';
import logger from '../utils/logger.js';

const FAILURE_THRESHOLD = 3;

const failureCounts = new Map<string, number>();
const alertedVMs = new Set<string>();

const checkVMPort = (ip: string, port: number, timeout = 5000): Promise<boolean> => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);
        socket.on('connect', () => { socket.destroy(); resolve(true); });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
        socket.on('error', () => { socket.destroy(); resolve(false); });
        socket.connect(port, ip);
    });
};

export const startHealthMonitor = () => {
    cron.schedule('*/5 * * * *', async () => {
        logger.info('[HealthMonitor] Checking VM connectivity...');

        try {
            const vms = await VMModel.find({}).lean();
            const settings = await emailService.getSettings();

            await Promise.allSettled(vms.map(async (vm) => {
                const vmId = vm._id.toString();
                const label = vm.name || 'VM';
                const reachable = await checkVMPort(vm.ip, vm.port || 22);

                if (!reachable) {
                    const currentFailures = (failureCounts.get(vmId) || 0) + 1;
                    failureCounts.set(vmId, currentFailures);
                    
                    logger.info(`[HealthMonitor] VM "${label}" unreachable (attempt ${currentFailures}/${FAILURE_THRESHOLD})`);

                    if (currentFailures >= FAILURE_THRESHOLD && !alertedVMs.has(vmId)) {
                        alertedVMs.add(vmId);
                        logger.warn(`[HealthMonitor] VM "${label}" confirmed DOWN after ${FAILURE_THRESHOLD} failures!`);

                        await sendPushToAll(
                            '⚠️ VM Unreachable',
                            `"${label}" is not responding.`,
                            { vmId }
                        );

                        if (settings.enabled && settings.notifyVmDown && settings.recipients.length > 0) {
                            if (emailService.shouldSendVmAlert(vmId, settings.cooldownMinutes)) {
                                emailService.markVmAlertSent(vmId);
                                await emailService.enqueue(
                                    'VM_DOWN',
                                    settings.recipients,
                                    `⚠️ VM Unreachable: ${label}`,
                                    'vm-down',
                                    {
                                        vmName: label,
                                        detectedAt: new Date().toLocaleString(),
                                        consecutiveFailures: currentFailures,
                                    }
                                ).catch(err => logger.error('[HealthMonitor] Failed to enqueue VM down email:', err));
                            }
                        }
                    }
                } else if (reachable) {
                    const wasAlerted = alertedVMs.has(vmId);
                    
                    if (failureCounts.get(vmId) || wasAlerted) {
                        logger.info(`[HealthMonitor] VM "${label}" is reachable. Resetting failure count.`);
                    }
                    
                    failureCounts.delete(vmId);

                    if (wasAlerted) {
                        alertedVMs.delete(vmId);
                        logger.info(`[HealthMonitor] VM "${label}" recovered.`);

                        await sendPushToAll(
                            '✅ VM Recovered',
                            `"${label}" is responding again.`,
                            { vmId }
                        );

                        if (settings.enabled && settings.notifyVmRecovered && settings.recipients.length > 0) {
                            emailService.clearVmAlertCooldown(vmId);
                            await emailService.enqueue(
                                'VM_RECOVERED',
                                settings.recipients,
                                `✅ VM Recovered: ${label}`,
                                'vm-recovered',
                                {
                                    vmName: label,
                                    recoveredAt: new Date().toLocaleString(),
                                }
                            ).catch(err => logger.error('[HealthMonitor] Failed to enqueue VM recovered email:', err));
                        }
                    }
                }
            }));
        } catch (err) {
            logger.error('[HealthMonitor] Error during health check:', err);
        }
    });

    logger.info('[HealthMonitor] VM health monitor started (every 5 minutes).');
};
