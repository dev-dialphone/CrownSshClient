import { VMModel } from '../models/VM.js';
import { Environment } from '../models/Environment.js';
import { PasswordHistoryModel } from '../models/PasswordHistory.js';
import logger from '../utils/logger.js';

export interface VM {
  id: string;
  name: string;
  ip: string;
  username: string;
  password?: string;
  port: number;
  environmentId?: string;
  isPinned?: boolean;
}

export interface VMGroup {
  environmentId: string;
  environmentName: string;
  vms: VM[];
  vmCount: number;
}

export interface PasswordHistoryEntry {
  id: string;
  vmId: string;
  vmName: string;
  vmIp: string;
  vmUsername: string;
  newPassword: string;
  operationType: 'manual' | 'auto';
  changedBy: string;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

export const vmService = {
  async getAll(environmentId?: string, search?: string, page: number = 1, limit: number = 20): Promise<{ data: VM[], total: number }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: any = {};

      if (environmentId) {
        query.environmentId = environmentId;
      }

      if (search) {
        // Use MongoDB Text Search for high performance
        // This uses the text index we created on name, ip, and username
        query.$text = { $search: search };
      }

      const skip = (page - 1) * limit;

      // For search, we can skip the expensive countDocuments for better speed 
      // if we only care about showing the first page of results in the dropdown
      if (search && page === 1) {
        const vms = await VMModel.find(query)
          .select({ score: { $meta: "textScore" } })
          .sort({ isPinned: -1, score: { $meta: "textScore" } }) // Sort by pinned first, then relevance
          .limit(limit);

        const mappedVMs = vms.map(v => {
          const obj = v.toObject();
          return {
            id: obj._id.toString(),
            name: obj.name,
            ip: obj.ip,
            username: obj.username,
            password: obj.password,
            port: obj.port,
            environmentId: obj.environmentId,
            isPinned: obj.isPinned
          };
        });
        return { data: mappedVMs, total: mappedVMs.length };
      }

      const [vms, total] = await Promise.all([
        VMModel.find(query)
          .sort({ isPinned: -1, _id: -1 }) // Sort by pinned first, then newest
          .skip(skip)
          .limit(limit),
        VMModel.countDocuments(query)
      ]);

      const mappedVMs = vms.map(v => {
        const obj = v.toObject();
        return {
          id: obj._id.toString(),
          name: obj.name,
          ip: obj.ip,
          username: obj.username,
          password: obj.password,
          port: obj.port,
          environmentId: obj.environmentId,
          isPinned: obj.isPinned
        };
      });

      return { data: mappedVMs, total };
    } catch (error) {
      logger.error('Error fetching VMs:', error);
      return { data: [], total: 0 };
    }
  },

  async getAllGrouped(): Promise<VMGroup[]> {
    try {
      const [envs, allVMs] = await Promise.all([
        Environment.find().sort({ name: 1 }),
        VMModel.find().sort({ isPinned: -1, _id: -1 }),
      ]);

      const vmMap = new Map<string, VM[]>();

      for (const vm of allVMs) {
        const obj = vm.toObject();
        const vmData: VM = {
          id: obj._id.toString(),
          name: obj.name,
          ip: obj.ip,
          username: obj.username,
          password: obj.password,
          port: obj.port,
          environmentId: obj.environmentId,
          isPinned: obj.isPinned,
        };

        const envId = obj.environmentId || 'unknown';
        if (!vmMap.has(envId)) {
          vmMap.set(envId, []);
        }
        vmMap.get(envId)!.push(vmData);
      }

      const groups: VMGroup[] = [];

      for (const env of envs) {
        const envId = (env.toObject() as any)._id.toString();
        const envVMs = vmMap.get(envId) || [];
        groups.push({
          environmentId: envId,
          environmentName: env.name,
          vms: envVMs,
          vmCount: envVMs.length,
        });
        vmMap.delete(envId);
      }

      if (vmMap.has('unknown')) {
        groups.push({
          environmentId: 'unknown',
          environmentName: 'Unassigned',
          vms: vmMap.get('unknown') || [],
          vmCount: vmMap.get('unknown')?.length || 0,
        });
      }

      return groups;
    } catch (error) {
      logger.error('Error fetching grouped VMs:', error);
      return [];
    }
  },

  async getById(id: string): Promise<VM | undefined> {
    try {
      const v = await VMModel.findById(id);
      if (!v) return undefined;
      const obj = v.toObject();
      return {
        id: obj._id.toString(),
        name: obj.name,
        ip: obj.ip,
        username: obj.username,
        password: obj.password,
        port: obj.port,
        environmentId: obj.environmentId
      };
    } catch (error) {
      logger.error('Error fetching VM:', error);
      return undefined;
    }
  },

  async add(vmData: Omit<VM, 'id'>): Promise<VM> {
    const newVM = new VMModel({
      ...vmData,
      port: vmData.port || 22,
    });
    await newVM.save();

    const obj = newVM.toObject();
    return {
      id: obj._id.toString(),
      name: obj.name,
      ip: obj.ip,
      username: obj.username,
      password: obj.password,
      port: obj.port,
      environmentId: obj.environmentId,
      isPinned: obj.isPinned
    };
  },

  async update(id: string, vmData: Partial<VM>): Promise<VM | null> {
    const vm = await VMModel.findById(id);
    if (!vm) return null;

    Object.assign(vm, vmData);
    await vm.save();

    const obj = vm.toObject();
    return {
      id: obj._id.toString(),
      name: obj.name,
      ip: obj.ip,
      username: obj.username,
      password: obj.password,
      port: obj.port,
      environmentId: obj.environmentId,
      isPinned: obj.isPinned
    };
  },

  async delete(id: string): Promise<boolean> {
    const result = await VMModel.findByIdAndDelete(id);
    return !!result;
  },

  async updatePassword(vmId: string, newPassword: string): Promise<VM | null> {
    const vm = await VMModel.findById(vmId);
    if (!vm) return null;
    
    vm.password = newPassword;
    await vm.save();
    
    const obj = vm.toObject();
    return {
      id: obj._id.toString(),
      name: obj.name,
      ip: obj.ip,
      username: obj.username,
      password: obj.password,
      port: obj.port,
      environmentId: obj.environmentId,
      isPinned: obj.isPinned
    };
  },

  async addPasswordHistory(entry: {
    vmId: string;
    vmName: string;
    vmIp: string;
    vmUsername: string;
    newPassword: string;
    oldPassword?: string;
    operationType: 'manual' | 'auto';
    changedBy: string;
    changedById: string;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await PasswordHistoryModel.create(entry);
    } catch (error) {
      logger.error('Error saving password history:', error);
    }
  },

  async getPasswordHistory(options: {
    vmId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ data: PasswordHistoryEntry[]; total: number }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: any = {};
      
      if (options.vmId) {
        query.vmId = options.vmId;
      }
      
      if (options.startDate || options.endDate) {
        query.createdAt = {};
        if (options.startDate) query.createdAt.$gte = options.startDate;
        if (options.endDate) query.createdAt.$lte = options.endDate;
      }
      
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      
      const [results, total] = await Promise.all([
        PasswordHistoryModel.find(query)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit),
        PasswordHistoryModel.countDocuments(query),
      ]);
      
      const data = results.map(r => {
        const obj = r.toObject();
        return {
          id: obj._id.toString(),
          vmId: obj.vmId,
          vmName: obj.vmName,
          vmIp: obj.vmIp,
          vmUsername: obj.vmUsername,
          newPassword: obj.newPassword,
          operationType: obj.operationType,
          changedBy: obj.changedBy,
          success: obj.success,
          errorMessage: obj.errorMessage,
          createdAt: obj.createdAt,
        };
      });
      
      return { data, total };
    } catch (error) {
      logger.error('Error fetching password history:', error);
      return { data: [], total: 0 };
    }
  },
};
