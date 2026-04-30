import * as path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env') });

/** Rutele /fleet/* folosesc X-Tenant-Id fără JWT în teste e2e. */
process.env.ALLOW_HEADER_TENANT = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-jwt-secret';
