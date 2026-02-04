#!/bin/bash

# Fix PM2 config with correct paths
cd ~/QuartaPotestas

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'pocketbase',
      script: './pocketbase',
      args: 'serve',
      cwd: './backend',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
    {
      name: 'backend',
      script: './venv/bin/uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8000',
      cwd: './backend',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
    {
      name: 'frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './frontend',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    }
  ],
};
EOF

echo "✅ PM2 config fixed!"

