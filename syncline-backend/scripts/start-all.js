const { spawn } = require('child_process');
const fs = require('fs');
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

services.forEach(service => {
  const logFilePath = path.join(__dirname, `../${service.name}.log`);
  const errLogFilePath = path.join(__dirname, `../${service.name}-err.log`);
  
  const logFile = fs.openSync(logFilePath, 'w');
  const errLogFile = fs.openSync(errLogFilePath, 'w');

  const absoluteScriptPath = path.resolve(path.join(__dirname, '..', service.script));

  const child = spawn('node', [absoluteScriptPath], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ...service.env },
    detached: true,
    shell: false,
    stdio: ['ignore', logFile, errLogFile]
  });

  child.unref();
  console.log(`Started ${service.name} (PID: ${child.pid}) on port ${service.port}`);
});
