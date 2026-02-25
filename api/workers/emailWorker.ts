import { Worker } from 'bullmq';
import { connection } from '../config/redis.js';
import { emailService } from '../services/emailService.js';
import { EmailLog } from '../models/EmailLog.js';
import logger from '../utils/logger.js';

export const emailWorker = new Worker(
    'email-queue',
    async (job) => {
        const { type, to, subject, template, data, logId } = job.data;
        
        logger.info(`Processing email job ${job.id}: ${type} to ${to.join(', ')}`);
        
        try {
            await emailService.sendEmail({ type, to, subject, template, data, logId });
            logger.info(`Email job ${job.id} completed successfully`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Email job ${job.id} failed: ${message}`);
            
            if (logId) {
                await EmailLog.findByIdAndUpdate(logId, {
                    status: 'failed',
                    error: message,
                });
            }
            
            throw error;
        }
    },
    {
        connection,
        concurrency: 1,
        limiter: {
            max: 10,
            duration: 1000,
        },
    }
);

emailWorker.on('completed', (job) => {
    logger.info(`Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
    logger.error(`Email job ${job?.id} failed: ${err.message}`);
});

emailWorker.on('error', (err) => {
    logger.error('Email worker error:', err);
});
