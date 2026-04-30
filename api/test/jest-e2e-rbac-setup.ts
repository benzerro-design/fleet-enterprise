import * as path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env') });

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-jwt-secret';
/** RBAC cu JWT real: nu folosi bypass-ul din header (vezi `JwtAuthGuard`). */
delete process.env.ALLOW_HEADER_TENANT;
