module.exports = {
  apps: [
    {
      name: 'pocketbase',
      script: './backend/pocketbase',
      args: 'serve',
      cwd: './backend',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
    {
      name: 'backend',
      script: 'venv/bin/python',
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port 8000',
      cwd: './backend',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
    {
      name: 'frontend',
      script: 'node_modules/.bin/next',
      args: 'dev',
      cwd: './frontend',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
    {
      name: 'tunnel',
      script: 'cloudflared',
      args: 'tunnel --config ops/tunnel/config.yml run',
      cwd: '.',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: { HOME: process.env.HOME || '/Users/lowie' },
    }
  ],
};
