import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

/**
 * Push the Prisma schema to the test database (no migrations, just sync).
 * Requires the test PostgreSQL container to be running.
 */
export function pushSchema() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Create a .env.test file or export it.',
    );
  }

  execSync(`npx prisma db push --url "${url}"`, {
    stdio: 'inherit',
  });
}
