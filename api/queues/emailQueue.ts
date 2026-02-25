import { Queue } from 'bullmq';
import { connection } from '../config/redis.js';

export const emailQueue = new Queue('email-queue', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: {
            age: 7 * 24 * 3600,
            count: 1000,
        },
        removeOnFail: {
            age: 30 * 24 * 3600,
            count: 5000,
        },
    },
});
