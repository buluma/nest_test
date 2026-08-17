import { parseGithubConfig } from './github.config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('parseGithubConfig', () => {
  const createTempKey = () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-test-'));
    const keyPath = path.join(tempDir, 'test-key.pem');
    fs.writeFileSync(
      keyPath,
      `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAtest
-----END RSA PRIVATE KEY-----`,
    );
    return keyPath;
  };

  const withEnv = (env: Record<string, string>, fn: () => void) => {
    const originalEnv = { ...process.env };
    // Clear all GitHub-related env vars first
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    delete process.env.WEBHOOK_SECRET;
    // Set test env vars
    Object.assign(process.env, env);
    try {
      fn();
    } finally {
      process.env = originalEnv;
    }
  };

  it('should parse valid config', () => {
    const keyPath = createTempKey();
    withEnv(
      {
        GITHUB_APP_ID: '12345',
        GITHUB_APP_PRIVATE_KEY_PATH: keyPath,
        WEBHOOK_SECRET: 'test-secret',
      },
      () => {
        const config = parseGithubConfig();
        expect(config).toBeDefined();
        expect(config.appId).toBe(12345);
        expect(config.privateKey).toContain('BEGIN RSA PRIVATE KEY');
        expect(config.webhookSecret).toBe('test-secret');
      },
    );
  });

  it('should throw on missing GITHUB_APP_ID', () => {
    const keyPath = createTempKey();
    withEnv(
      {
        GITHUB_APP_PRIVATE_KEY_PATH: keyPath,
        WEBHOOK_SECRET: 'test-secret',
      },
      () => {
        expect(() => parseGithubConfig()).toThrow('GITHUB_APP_ID is required');
      },
    );
  });

  it('should throw on missing private key path', () => {
    withEnv(
      {
        GITHUB_APP_ID: '12345',
        WEBHOOK_SECRET: 'test-secret',
      },
      () => {
        expect(() => parseGithubConfig()).toThrow(
          'GITHUB_APP_PRIVATE_KEY_PATH is required',
        );
      },
    );
  });

  it('should throw on missing webhook secret', () => {
    const keyPath = createTempKey();
    withEnv(
      {
        GITHUB_APP_ID: '12345',
        GITHUB_APP_PRIVATE_KEY_PATH: keyPath,
      },
      () => {
        expect(() => parseGithubConfig()).toThrow('WEBHOOK_SECRET is required');
      },
    );
  });

  it('should throw on non-existent private key file', () => {
    withEnv(
      {
        GITHUB_APP_ID: '12345',
        GITHUB_APP_PRIVATE_KEY_PATH: '/nonexistent/key.pem',
        WEBHOOK_SECRET: 'test-secret',
      },
      () => {
        expect(() => parseGithubConfig()).toThrow('Private key not found');
      },
    );
  });

  it('should throw on invalid private key format', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-test-'));
    const keyPath = path.join(tempDir, 'test-key.pem');
    fs.writeFileSync(keyPath, 'not a valid key');
    withEnv(
      {
        GITHUB_APP_ID: '12345',
        GITHUB_APP_PRIVATE_KEY_PATH: keyPath,
        WEBHOOK_SECRET: 'test-secret',
      },
      () => {
        expect(() => parseGithubConfig()).toThrow('Invalid private key format');
      },
    );
  });
});
