import nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Setting } from '../models/Setting.js';
import { EmailLog, EmailType } from '../models/EmailLog.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import logger from '../utils/logger.js';
import { emailQueue } from '../queues/emailQueue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EmailSettings {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    fromName: string;
    fromEmail: string;
    recipients: string[];
    notifyVmDown: boolean;
    notifyVmRecovered: boolean;
    notifyNewUser: boolean;
    notifyUserApproved: boolean;
    notifyUserRejected: boolean;
    cooldownMinutes: number;
    dailyCap: number;
}

interface EmailJobData {
    type: EmailType;
    to: string[];
    subject: string;
    template: string;
    data: Record<string, unknown>;
}

const DEFAULT_SETTINGS: EmailSettings = {
    enabled: false,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPassword: '',
    fromName: 'SSH Manager',
    fromEmail: '',
    recipients: ['crownsolution.noc@gmail.com'],
    notifyVmDown: true,
    notifyVmRecovered: true,
    notifyNewUser: true,
    notifyUserApproved: true,
    notifyUserRejected: true,
    cooldownMinutes: 15,
    dailyCap: 100,
};

const vmAlertCooldowns = new Map<string, Date>();
const dailyEmailCount = { date: new Date().toDateString(), count: 0 };

export const emailService = {
    async getSettings(): Promise<EmailSettings> {
        const settings = await Setting.find({ key: { $regex: /^email\./ } }).lean();
        const map: Record<string, unknown> = Object.fromEntries(settings.map(s => [s.key, s.value]));
        
        const smtpPassword = map['email.smtpPassword'] 
            ? decrypt(map['email.smtpPassword'] as string)
            : (process.env.SMTP_PASSWORD || '');
        
        return {
            enabled: (map['email.enabled'] as boolean) ?? DEFAULT_SETTINGS.enabled,
            smtpHost: (map['email.smtpHost'] as string) ?? process.env.SMTP_HOST ?? DEFAULT_SETTINGS.smtpHost,
            smtpPort: (map['email.smtpPort'] as number) ?? parseInt(process.env.SMTP_PORT || '587') ?? DEFAULT_SETTINGS.smtpPort,
            smtpSecure: (map['email.smtpSecure'] as boolean) ?? DEFAULT_SETTINGS.smtpSecure,
            smtpUser: (map['email.smtpUser'] as string) ?? process.env.SMTP_USER ?? DEFAULT_SETTINGS.smtpUser,
            smtpPassword,
            fromName: (map['email.fromName'] as string) ?? process.env.SMTP_FROM_NAME ?? DEFAULT_SETTINGS.fromName,
            fromEmail: (map['email.fromEmail'] as string) ?? process.env.SMTP_FROM_EMAIL ?? DEFAULT_SETTINGS.fromEmail,
            recipients: (map['email.recipients'] as string[]) ?? DEFAULT_SETTINGS.recipients,
            notifyVmDown: (map['email.notifyVmDown'] as boolean) ?? DEFAULT_SETTINGS.notifyVmDown,
            notifyVmRecovered: (map['email.notifyVmRecovered'] as boolean) ?? DEFAULT_SETTINGS.notifyVmRecovered,
            notifyNewUser: (map['email.notifyNewUser'] as boolean) ?? DEFAULT_SETTINGS.notifyNewUser,
            notifyUserApproved: (map['email.notifyUserApproved'] as boolean) ?? DEFAULT_SETTINGS.notifyUserApproved,
            notifyUserRejected: (map['email.notifyUserRejected'] as boolean) ?? DEFAULT_SETTINGS.notifyUserRejected,
            cooldownMinutes: (map['email.cooldownMinutes'] as number) ?? DEFAULT_SETTINGS.cooldownMinutes,
            dailyCap: (map['email.dailyCap'] as number) ?? DEFAULT_SETTINGS.dailyCap,
        };
    },

    async updateSettings(updates: Record<string, unknown>): Promise<void> {
        for (const [key, value] of Object.entries(updates)) {
            let finalValue = value;
            
            if (key === 'email.smtpPassword' && typeof value === 'string' && value) {
                finalValue = encrypt(value);
            }
            
            await Setting.findOneAndUpdate(
                { key },
                { key, value: finalValue },
                { upsert: true }
            );
        }
    },

    createTransporter(settings: EmailSettings): Transporter {
        return nodemailer.createTransport({
            host: settings.smtpHost,
            port: settings.smtpPort,
            secure: settings.smtpSecure,
            auth: settings.smtpUser ? {
                user: settings.smtpUser,
                pass: settings.smtpPassword,
            } : undefined,
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            rateDelta: 1000,
            rateLimit: 10,
        });
    },

    async testConnection(settings: EmailSettings): Promise<{ success: boolean; error?: string }> {
        try {
            const transporter = this.createTransporter(settings);
            await transporter.verify();
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, error: message };
        }
    },

    renderTemplate(templateName: string, data: Record<string, unknown>): string {
        const templatePath = path.join(__dirname, '../email-templates', `${templateName}.html`);
        let html = fs.readFileSync(templatePath, 'utf-8');
        
        for (const [key, value] of Object.entries(data)) {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(placeholder, String(value ?? ''));
        }
        
        html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (_, key, content) => {
            return data[key] ? content : '';
        });
        
        html = html.replace(/{{[^}]+}}/g, '');
        
        return html;
    },

    shouldSendVmAlert(vmId: string, cooldownMinutes: number): boolean {
        const lastAlert = vmAlertCooldowns.get(vmId);
        if (!lastAlert) return true;
        
        const cooldownMs = cooldownMinutes * 60 * 1000;
        return Date.now() - lastAlert.getTime() > cooldownMs;
    },

    markVmAlertSent(vmId: string): void {
        vmAlertCooldowns.set(vmId, new Date());
    },

    clearVmAlertCooldown(vmId: string): void {
        vmAlertCooldowns.delete(vmId);
    },

    checkDailyCap(dailyCap: number): boolean {
        const today = new Date().toDateString();
        if (dailyEmailCount.date !== today) {
            dailyEmailCount.date = today;
            dailyEmailCount.count = 0;
        }
        return dailyEmailCount.count < dailyCap;
    },

    incrementDailyCount(): void {
        const today = new Date().toDateString();
        if (dailyEmailCount.date !== today) {
            dailyEmailCount.date = today;
            dailyEmailCount.count = 0;
        }
        dailyEmailCount.count++;
    },

    async enqueue(type: EmailType, to: string[], subject: string, template: string, data: Record<string, unknown>): Promise<void> {
        const settings = await this.getSettings();
        
        if (!settings.enabled) {
            logger.info(`Email disabled, skipping ${type} email to ${to.join(', ')}`);
            return;
        }
        
        if (!this.checkDailyCap(settings.dailyCap)) {
            logger.warn(`Daily email cap (${settings.dailyCap}) reached, skipping ${type} email`);
            return;
        }
        
        const logEntry = await EmailLog.create({
            type,
            to,
            subject,
            status: 'pending',
            metadata: data,
        });
        
        await emailQueue.add('send-email', {
            type,
            to,
            subject,
            template,
            data,
            logId: logEntry._id.toString(),
        } as EmailJobData & { logId: string });
        
        logger.info(`Queued ${type} email to ${to.join(', ')}`);
    },

    async sendEmail(jobData: EmailJobData & { logId?: string }): Promise<void> {
        const settings = await this.getSettings();
        
        if (!settings.enabled) {
            throw new Error('Email service is disabled');
        }
        
        const transporter = this.createTransporter(settings);
        const html = this.renderTemplate(jobData.template, jobData.data);
        
        try {
            await transporter.sendMail({
                from: `"${settings.fromName}" <${settings.fromEmail}>`,
                to: jobData.to.join(', '),
                subject: jobData.subject,
                html,
            });
            
            if (jobData.logId) {
                await EmailLog.findByIdAndUpdate(jobData.logId, { status: 'sent' });
            }
            
            this.incrementDailyCount();
            logger.info(`Sent ${jobData.type} email to ${jobData.to.join(', ')}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            
            if (jobData.logId) {
                await EmailLog.findByIdAndUpdate(jobData.logId, { 
                    status: 'failed',
                    error: message,
                });
            }
            
            logger.error(`Failed to send ${jobData.type} email: ${message}`);
            throw error;
        }
    },

    async sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
        const settings = await this.getSettings();
        
        if (!settings.smtpHost || !settings.smtpUser) {
            return { success: false, error: 'SMTP not configured' };
        }
        
        try {
            const transporter = this.createTransporter(settings);
            const html = this.renderTemplate('test', { sentAt: new Date().toLocaleString() });
            
            await transporter.sendMail({
                from: `"${settings.fromName}" <${settings.fromEmail}>`,
                to,
                subject: 'Test Email - SSH Manager',
                html,
            });
            
            await EmailLog.create({
                type: 'TEST',
                to: [to],
                subject: 'Test Email - SSH Manager',
                status: 'sent',
            });
            
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, error: message };
        }
    },

    async getEmailLogs(page = 1, limit = 50): Promise<{ logs: unknown[]; total: number }> {
        const skip = (page - 1) * limit;
        const [logs, total] = await Promise.all([
            EmailLog.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            EmailLog.countDocuments(),
        ]);
        return { logs, total };
    },

    async getEmailStats(): Promise<{ today: number; total: number; failed: number }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [total, failed, todayCount] = await Promise.all([
            EmailLog.countDocuments(),
            EmailLog.countDocuments({ status: 'failed' }),
            EmailLog.countDocuments({ createdAt: { $gte: today } }),
        ]);
        
        return { today: todayCount, total, failed };
    },
};
