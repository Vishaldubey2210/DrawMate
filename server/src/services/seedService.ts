import { User } from '../models/User.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';

export const DEMO_ACCOUNTS = {
  admin: {
    username: 'admin',
    email: 'admin@drawmate.app',
    password: 'Admin@1234',
    displayName: 'DrawMate Admin',
    role: 'admin' as const,
  },
  player: {
    username: 'player',
    email: 'player@drawmate.app',
    password: 'Player@1234',
    displayName: 'Speedy Sketcher',
    role: 'user' as const,
  },
};

export async function seedDemoAccounts(): Promise<void> {
  try {
    // 1. Seed or update Admin
    const adminAccount = DEMO_ACCOUNTS.admin;
    const existingAdmin = await User.findOne({
      $or: [
        { normalizedEmail: adminAccount.email.toLowerCase() },
        { normalizedUsername: adminAccount.username.toLowerCase() },
      ],
    });

    const adminHash = await hashPassword(adminAccount.password);

    if (!existingAdmin) {
      await User.create({
        username: adminAccount.username,
        normalizedUsername: adminAccount.username.toLowerCase(),
        displayName: adminAccount.displayName,
        email: adminAccount.email,
        normalizedEmail: adminAccount.email.toLowerCase(),
        passwordHash: adminHash,
        role: adminAccount.role,
        isOnboarded: true,
        isEmailVerified: true,
        avatar: 'avatar-1',
      });
      logger.info(`[SeedService] Created demo admin account: ${adminAccount.email}`, undefined, 'Seed');
    } else if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      await existingAdmin.save();
    }

    // 2. Seed or update Player
    const playerAccount = DEMO_ACCOUNTS.player;
    const existingPlayer = await User.findOne({
      $or: [
        { normalizedEmail: playerAccount.email.toLowerCase() },
        { normalizedUsername: playerAccount.username.toLowerCase() },
      ],
    });

    const playerHash = await hashPassword(playerAccount.password);

    if (!existingPlayer) {
      await User.create({
        username: playerAccount.username,
        normalizedUsername: playerAccount.username.toLowerCase(),
        displayName: playerAccount.displayName,
        email: playerAccount.email,
        normalizedEmail: playerAccount.email.toLowerCase(),
        passwordHash: playerHash,
        role: playerAccount.role,
        isOnboarded: true,
        isEmailVerified: true,
        avatar: 'avatar-2',
      });
      logger.info(`[SeedService] Created demo player account: ${playerAccount.email}`, undefined, 'Seed');
    }
  } catch (error: any) {
    logger.warn(`[SeedService] Could not complete demo account seed: ${error.message}`, undefined, 'Seed');
  }
}
