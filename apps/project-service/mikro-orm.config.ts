import { Migrator } from '@mikro-orm/migrations';
import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import path from 'path';
import { databaseConfig } from './src/config/database.config';

const cliConfig = {
  ...databaseConfig,
  migrations: {
    path: path.join(__dirname, 'src/database/migrations'),
    // Explicit per-service table: MikroORM defaults to "mikro_orm_migrations"
    // for every service, which silently collides when services share a DB.
    tableName: 'project_service_migrations',
    // The shared auth-owned `users` table is not part of this service's
    // migration baseline. Compare checks against the live schema so a stale
    // cross-service snapshot cannot propose dropping it.
    snapshot: false,
  },
  schemaGenerator: {
    // The auth service owns this shared table; project-service schema
    // operations must never manage it.
    skipTables: ['users'],
  },
  extensions: [Migrator],
};

const ormConfig: MikroOrmModuleOptions = {
  ...databaseConfig,
  ...cliConfig,
};

export default ormConfig;
