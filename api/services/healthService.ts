import net from 'net';
import cron from 'node-cron';
import { VMModel } from '../models/VM.js';
import { sendPushToAll } from './pushService.js';
import { emailService } from './emailService.js';
import logger from '../utils/logger.js';

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
                const label = vm.name || vm.ip;
                const reachable = await checkVMPort(vm.ip, vm.port || 22);

                if (!reachable && !alertedVMs.has(vmId)) {
                    alertedVMs.add(vmId);
                    logger.warn(`[HealthMonitor] VM "${label}" (${vm.ip}:${vm.port}) is unreachable!`);

                    await sendPushToAll(
                        '⚠️ VM Unreachable',
                        `"${label}" (${vm.ip}) is not responding on port ${vm.port || 22}.`,
                        { vmId, ip: vm.ip }
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
                                    vmIp: vm.ip,
                                    vmPort: vm.port || 22,
                                    detectedAt: new Date().toLocaleString(),
                                }
                            ).catch(err => logger.error('[HealthMonitor] Failed to enqueue VM down email:', err));
                        }
                    }
                } else if (reachable && alertedVMs.has(vmId)) {
                    alertedVMs.delete(vmId);
                    logger.info(`[HealthMonitor] VM "${label}" recovered.`);

                    await sendPushToAll(
                        '✅ VM Recovered',
                        `"${label}" (${vm.ip}) is responding again.`,
                        { vmId, ip: vm.ip }
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
                                vmIp: vm.ip,
                                vmPort: vm.port || 22,
                                recoveredAt: new Date().toLocaleString(),
                            }
                        ).catch(err => logger.error('[HealthMonitor] Failed to enqueue VM recovered email:', err));
                    }
                }
            }));
        } catch (err) {
            logger.error('[HealthMonitor] Error during health check:', err);
        }
    });

    logger.info('[HealthMonitor] VM health monitor started (every 5 minutes).');
};
