const { spawn } = require('child_process');
const path = require('path');

const services = [
  {
    name: 'auth-service',
    port: 3001,
    script: 'services/auth-service/dist/index.js',
    env: {
      PORT: '3001',
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/syncline?sslmode=disable',
      JWT_SECRET: 'syncline_super_secret_jwt_key_2026',
      JWT_ALGORITHM: 'HS256',
    }
  },
  {
    name: 'sync-service',
    port: 3002,
    script: 'services/sync-service/dist/index.js',
    env: {
      PORT: '3002',
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/syncline?sslmode=disable',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'syncline_super_secret_jwt_key_2026',
      JWT_ALGORITHM: 'HS256',
    }
  },
  {
    name: 'push-service',
    port: 3003,
    script: 'services/push-service/dist/index.js',
    env: {
      PORT: '3003',
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/syncline?sslmode=disable',
      REDIS_URL: 'redis://localhost:6379',
    }
  },
  {
    name: 'relay-service',
    port: 3004,
    script: 'services/relay-service/dist/index.js',
    env: {
      PORT: '3004',
      HOST: '0.0.0.0',
      REDIS_URL: 'redis://localhost:6379',
      TURN_SECRET: 'coturn_shared_secret',
      TURN_URIS: 'turn:localhost:3478?transport=udp,turn:localhost:3478?transport=tcp',
      JWT_SECRET: 'syncline_super_secret_jwt_key_2026',
      JWT_ALGORITHM: 'HS256',
    }
  }
];

const children = [];

services.forEach(service => {
  const absoluteScriptPath = path.resolve(path.join(__dirname, '..', service.script));
  console.log(`[Manager] Spawning ${service.name} from script: ${absoluteScriptPath}`);

  const child = spawn(process.execPath, [absoluteScriptPath], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ...service.env },
    shell: false
  });

  child.stdout.on('data', (data) => {
    data.toString().trim().split('\n').forEach(line => {
      console.log(`[${service.name}] ${line.trim()}`);
    });
  });

  child.stderr.on('data', (data) => {
    data.toString().trim().split('\n').forEach(line => {
      console.error(`[${service.name} ERR] ${line.trim()}`);
    });
  });

  child.on('exit', (code, signal) => {
    console.log(`[${service.name}] Exited with code ${code} and signal ${signal}`);
  });

  children.push(child);
});

process.on('SIGINT', () => {
  console.log('[Manager] Received SIGINT, cleaning up children...');
  children.forEach(child => child.kill());
  process.exit();
});

process.on('SIGTERM', () => {
  console.log('[Manager] Received SIGTERM, cleaning up children...');
  children.forEach(child => child.kill());
  process.exit();
});

// Keep process alive
setInterval(() => {}, 1000);
