import '../config/loadEnv.js';
import mongoose from 'mongoose';
import { Environment } from '../models/Environment.js';
import { DEFAULT_ENVIRONMENTS } from '../config/defaultEnvironments.js';
import logger from '../utils/logger.js';

const runMigration = async () => {
  try {
    logger.info('=== ENVIRONMENT COMMANDS MIGRATION SCRIPT ===');
    logger.info('Connecting to MongoDB...');
    
    await mongoose.connect(process.env.mongo!);
    logger.info('MongoDB connected');
    
    const envs = await Environment.find();
    logger.info(`Found ${envs.length} environments in database`);
    
    for (const env of envs) {
      logger.info(`Environment: "${env.name}" -> Command: "${(env.command || '').substring(0, 40)}..." -> Monitor: "${(env.monitoringCommand || '').substring(0, 30)}..."`);
    }
    
    let updatedCount = 0;
    
    for (const defaultEnv of DEFAULT_ENVIRONMENTS) {
      const existingEnv = await Environment.findOne({ 
        name: { $regex: new RegExp(`^${defaultEnv.name}$`, 'i') } 
      });
      
      if (existingEnv) {
        const currentCommand = existingEnv.command || '';
        const currentMonitoringCommand = existingEnv.monitoringCommand || '';
        const commandNeedsUpdate = currentCommand !== defaultEnv.command;
        const monitoringNeedsUpdate = currentMonitoringCommand !== (defaultEnv.monitoringCommand || '');
        
        if (commandNeedsUpdate || monitoringNeedsUpdate) {
          logger.info(`\n--- UPDATING "${existingEnv.name}" ---`);
          if (commandNeedsUpdate) {
            logger.info(`Command OLD: ${currentCommand.substring(0, 80)}...`);
            logger.info(`Command NEW: ${defaultEnv.command.substring(0, 80)}...`);
          }
          if (monitoringNeedsUpdate) {
            logger.info(`Monitoring OLD: ${currentMonitoringCommand || '(empty)'}`);
            logger.info(`Monitoring NEW: ${defaultEnv.monitoringCommand || '(empty)'}`);
          }
          
          await Environment.findByIdAndUpdate(existingEnv._id, { 
            command: defaultEnv.command,
            monitoringCommand: defaultEnv.monitoringCommand || '',
          });
          logger.info(`UPDATED successfully`);
          updatedCount++;
        } else {
          logger.info(`OK - "${existingEnv.name}" already has correct commands`);
        }
      } else {
        logger.info(`Creating missing environment: ${defaultEnv.name}`);
        const newEnv = new Environment({
          name: defaultEnv.name,
          command: defaultEnv.command,
          monitoringCommand: defaultEnv.monitoringCommand || '',
        });
        await newEnv.save();
        updatedCount++;
      }
    }
    
    logger.info(`\n=== MIGRATION COMPLETE: ${updatedCount} environment(s) updated ===`);
    
    const updatedEnvs = await Environment.find();
    logger.info('\n--- FINAL STATE ---');
    for (const env of updatedEnvs) {
      logger.info(`"${env.name}":`);
      logger.info(`  Command: "${(env.command || '').substring(0, 60)}..."`);
      logger.info(`  Monitoring: "${env.monitoringCommand || '(not set)'}"`);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
