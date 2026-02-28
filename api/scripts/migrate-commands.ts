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
      logger.info(`Environment: "${env.name}" -> Command: "${(env.command || '').substring(0, 60)}..."`);
    }
    
    let updatedCount = 0;
    
    for (const defaultEnv of DEFAULT_ENVIRONMENTS) {
      const existingEnv = await Environment.findOne({ 
        name: { $regex: new RegExp(`^${defaultEnv.name}$`, 'i') } 
      });
      
      if (existingEnv) {
        const currentCommand = existingEnv.command || '';
        const commandsMatch = currentCommand === defaultEnv.command;
        
        if (!commandsMatch) {
          logger.info(`\n--- UPDATING "${existingEnv.name}" ---`);
          logger.info(`OLD: ${currentCommand.substring(0, 100)}...`);
          logger.info(`NEW: ${defaultEnv.command.substring(0, 100)}...`);
          
          await Environment.findByIdAndUpdate(existingEnv._id, { command: defaultEnv.command });
          logger.info(`UPDATED successfully`);
          updatedCount++;
        } else {
          logger.info(`OK - "${existingEnv.name}" already has correct command`);
        }
      } else {
        logger.info(`Creating missing environment: ${defaultEnv.name}`);
        const newEnv = new Environment({
          name: defaultEnv.name,
          command: defaultEnv.command,
        });
        await newEnv.save();
        updatedCount++;
      }
    }
    
    logger.info(`\n=== MIGRATION COMPLETE: ${updatedCount} environment(s) updated ===`);
    
    const updatedEnvs = await Environment.find();
    logger.info('\n--- FINAL STATE ---');
    for (const env of updatedEnvs) {
      logger.info(`"${env.name}": "${(env.command || '').substring(0, 60)}..."`);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
