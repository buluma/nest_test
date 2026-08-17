import { registerAs } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

const parseGithubConfig = () => {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  const webhookSecret = process.env.WEBHOOK_SECRET;

  if (!appId) {
    throw new Error('GITHUB_APP_ID is required');
  }
  if (!privateKeyPath) {
    throw new Error('GITHUB_APP_PRIVATE_KEY_PATH is required');
  }
  if (!webhookSecret) {
    throw new Error('WEBHOOK_SECRET is required');
  }

  const resolvedPath = path.resolve(privateKeyPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Private key not found at ${resolvedPath}`);
  }

  const privateKey = fs.readFileSync(resolvedPath, 'utf-8');
  if (
    !privateKey.includes('BEGIN RSA PRIVATE KEY') &&
    !privateKey.includes('BEGIN PRIVATE KEY')
  ) {
    throw new Error('Invalid private key format');
  }

  return {
    appId: parseInt(appId, 10),
    privateKey,
    privateKeyPath: resolvedPath,
    webhookSecret,
  };
};

export const githubConfig = registerAs('github', parseGithubConfig);

export type GithubConfig = ReturnType<typeof parseGithubConfig>;

// Export for direct testing
export { parseGithubConfig };
