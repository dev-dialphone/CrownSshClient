import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { connection } from '../config/redis.js';
import { IUser } from '../models/User.js';

const manualPerVM = new RateLimiterRedis({
  storeClient: connection,
  keyPrefix: 'pwd_manual_vm',
  points: 5,
  duration: 60 * 60,
  blockDuration: 60 * 60,
});

const manualPerAdmin = new RateLimiterRedis({
  storeClient: connection,
  keyPrefix: 'pwd_manual_admin',
  points: 20,
  duration: 60 * 60,
  blockDuration: 60 * 60,
});

const autoPerVM = new RateLimiterRedis({
  storeClient: connection,
  keyPrefix: 'pwd_auto_vm',
  points: 3,
  duration: 60 * 60,
  blockDuration: 60 * 60,
});

const autoPerAdmin = new RateLimiterRedis({
  storeClient: connection,
  keyPrefix: 'pwd_auto_admin',
  points: 10,
  duration: 60 * 60,
  blockDuration: 60 * 60,
});

const testConnectionLimiter = new RateLimiterRedis({
  storeClient: connection,
  keyPrefix: 'pwd_test',
  points: 10,
  duration: 60,
  blockDuration: 60,
});

export interface RateLimitInfo {
  vmRemaining: number;
  adminRemaining: number;
  resetTime: number;
  isAdmin: boolean;
}

const isAdminUser = (user: IUser): boolean => {
  return user.role === 'admin';
};

export const getPasswordRateLimitInfo = async (vmId: string, adminId: string, type: 'manual' | 'auto', isAdmin: boolean = false): Promise<RateLimitInfo> => {
  if (isAdmin) {
    return {
      vmRemaining: Infinity,
      adminRemaining: Infinity,
      resetTime: 0,
      isAdmin: true,
    };
  }

  const vmLimiter = type === 'manual' ? manualPerVM : autoPerVM;
  const adminLimiter = type === 'manual' ? manualPerAdmin : autoPerAdmin;
  
  const [vmRes, adminRes] = await Promise.all([
    vmLimiter.get(vmId),
    adminLimiter.get(adminId),
  ]);
  
  return {
    vmRemaining: vmRes?.remainingPoints ?? (type === 'manual' ? 5 : 3),
    adminRemaining: adminRes?.remainingPoints ?? (type === 'manual' ? 20 : 10),
    resetTime: Math.max(vmRes?.msBeforeNext ?? 0, adminRes?.msBeforeNext ?? 0),
    isAdmin: false,
  };
};

export const manualPasswordRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = req.user as IUser;

  if (isAdminUser(user)) {
    next();
    return;
  }

  const vmId = req.params.id;
  const adminId = (user as any)._id?.toString() || (user as any).id;
  
  try {
    const [vmLimit, adminLimit] = await Promise.all([
      manualPerVM.consume(vmId),
      manualPerAdmin.consume(adminId),
    ]);
    
    res.setHeader('X-RateLimit-VM-Remaining', vmLimit.remainingPoints);
    res.setHeader('X-RateLimit-Admin-Remaining', adminLimit.remainingPoints);
    
    next();
  } catch (rejRes: any) {
    const remainingTime = Math.ceil((rejRes?.msBeforeNext || 3600000) / 1000);
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: `Too many password changes. Please try again in ${Math.ceil(remainingTime / 60)} minutes.`,
      retryAfter: remainingTime,
    });
  }
};

export const autoPasswordRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = req.user as IUser;

  if (isAdminUser(user)) {
    next();
    return;
  }

  const vmId = req.params.id;
  const adminId = (user as any)._id?.toString() || (user as any).id;
  
  try {
    const [vmLimit, adminLimit] = await Promise.all([
      autoPerVM.consume(vmId),
      autoPerAdmin.consume(adminId),
    ]);
    
    res.setHeader('X-RateLimit-VM-Remaining', vmLimit.remainingPoints);
    res.setHeader('X-RateLimit-Admin-Remaining', adminLimit.remainingPoints);
    
    next();
  } catch (rejRes: any) {
    const remainingTime = Math.ceil((rejRes?.msBeforeNext || 3600000) / 1000);
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: `Too many automatic password resets. Please try again in ${Math.ceil(remainingTime / 60)} minutes.`,
      retryAfter: remainingTime,
    });
  }
};

export const testConnectionRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = req.user as IUser;

  if (isAdminUser(user)) {
    next();
    return;
  }

  const vmId = req.params.id;
  
  try {
    const result = await testConnectionLimiter.consume(vmId);
    res.setHeader('X-RateLimit-Remaining', result.remainingPoints);
    next();
  } catch (rejRes: any) {
    const remainingTime = Math.ceil((rejRes?.msBeforeNext || 60000) / 1000);
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: `Too many connection tests. Please try again in ${remainingTime} seconds.`,
      retryAfter: remainingTime,
    });
  }
};

const lockKeyPrefix = 'vm_pwd_lock:';

export const acquirePasswordLock = async (vmId: string): Promise<boolean> => {
  const lockKey = `${lockKeyPrefix}${vmId}`;
  const result = await connection.set(lockKey, '1', 'EX', 60, 'NX');
  return result === 'OK';
};

export const releasePasswordLock = async (vmId: string): Promise<void> => {
  const lockKey = `${lockKeyPrefix}${vmId}`;
  await connection.del(lockKey);
};

export const checkPasswordLock = async (vmId: string): Promise<boolean> => {
  const lockKey = `${lockKeyPrefix}${vmId}`;
  const result = await connection.get(lockKey);
  return result !== null;
};

export const passwordLockMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const vmId = req.params.id;
  
  const isLocked = await checkPasswordLock(vmId);
  if (isLocked) {
    res.status(423).json({
      error: 'OPERATION_IN_PROGRESS',
      message: 'Another password operation is currently in progress for this VM. Please wait.',
    });
    return;
  }
  
  next();
};
