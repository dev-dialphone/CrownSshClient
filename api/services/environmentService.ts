import { Environment, IEnvironment } from '../models/Environment.js';
import { VMModel } from '../models/VM.js';
import logger from '../utils/logger.js';
import { DEFAULT_ENVIRONMENTS, getDefaultCommand } from '../config/defaultEnvironments.js';

const fixEnvironmentCommands = async (envs: IEnvironment[]): Promise<void> => {
  for (const env of envs) {
    const correctCommand = getDefaultCommand(env.name);
    if (correctCommand && env.command !== correctCommand) {
      logger.info(`Fixing command for environment ${env.name} (was: ${env.command?.substring(0, 50)}...)`);
      await Environment.findByIdAndUpdate(env._id, { command: correctCommand });
      env.command = correctCommand;
      logger.info(`Updated environment ${env.name} with correct command`);
    }
  }
};

export const environmentService = {
  async getAll(): Promise<(IEnvironment & { vmCount: number })[]> {
    try {
      const envs = await Environment.find();
      
      await fixEnvironmentCommands(envs);

      // --- AUTO-REPAIR LOGIC ---
      // If 'OPS' is missing but we have VMs that don't belong to any environment,
      // we recreate 'OPS' and re-link the orphaned VMs.
      const defaultNames = DEFAULT_ENVIRONMENTS.map(d => d.name);
      const missingDefaults = DEFAULT_ENVIRONMENTS.filter(d => !envs.some(e => e.name === d.name));

      if (missingDefaults.length > 0) {
        // Check if there are any VMs with environmentIds that don't exist
        const allEnvIds = envs.map(e => e._id.toString());
        const orphanedVMs = await VMModel.find({ environmentId: { $nin: allEnvIds } });

        if (orphanedVMs.length > 0) {
          logger.info(`Found ${orphanedVMs.length} orphaned VMs. Re-seeding missing default environments...`);
          for (const required of missingDefaults) {
            try {
              const newEnv = new Environment({
                name: required.name,
                command: required.command,
              });
              await newEnv.save();
              envs.push(newEnv);
              logger.info(`Restored missing environment: ${required.name}`);

              // Re-link orphaned VMs to the first newly created environment (most likely OPS)
              // In this specific case, the user wants OPS back.
              if (required.name === 'OPS') {
                const updateResult = await VMModel.updateMany(
                  { environmentId: { $nin: allEnvIds } },
                  { environmentId: newEnv._id.toString() }
                );
                logger.info(`Re-linked ${updateResult.modifiedCount} VMs to the restored OPS environment.`);
              }
            } catch (err) {
              logger.error(`Failed to restore environment ${required.name}:`, err);
            }
          }
        }
      }
      // --- END AUTO-REPAIR LOGIC ---

      // Seed default environments ONLY if the database is completely empty (fresh install)
      if (envs.length === 0) {
        logger.info('No environments found. Seeding defaults...');
        for (const required of DEFAULT_ENVIRONMENTS) {
          try {
            const newEnv = new Environment({
              name: required.name,
              command: required.command,
            });
            await newEnv.save();
            envs.push(newEnv);
          } catch (err) {
            logger.error(`Failed to seed environment ${required.name}:`, err);
          }
        }
      }

      return await Promise.all(envs.map(async (e) => {
        const obj = e.toObject() as any;
        obj.id = obj._id.toString();
        const count = await VMModel.countDocuments({ environmentId: obj.id });
        obj.vmCount = count;
        return obj as IEnvironment & { vmCount: number };
      }));
    } catch (error) {
      logger.error('Error fetching environments:', error);
      return [];
    }
  },

  async getById(id: string): Promise<IEnvironment | null> {
    const env = await Environment.findById(id);
    if (env) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj = env.toObject() as any;
      obj.id = obj._id.toString();
      return obj as IEnvironment;
    }
    return null;
  },

  async add(name: string): Promise<IEnvironment> {
    const defaultCommand = getDefaultCommand(name);
    const newEnv = new Environment({
      name,
      command: defaultCommand,
    });
    await newEnv.save();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = newEnv.toObject() as any;
    obj.id = obj._id.toString();
    return obj as IEnvironment;
  },

  async update(id: string, data: Partial<IEnvironment>): Promise<IEnvironment | null> {
    const updated = await Environment.findByIdAndUpdate(id, data, { new: true });
    if (updated) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj = updated.toObject() as any;
      obj.id = obj._id.toString();
      return obj as IEnvironment;
    }
    return null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await Environment.findByIdAndDelete(id);
    return !!result;
  }
};
