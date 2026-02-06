#!/bin/bash

# Simple script to create PM2 config
cd ~/QuartaPotestas

cat > ecosystem.config.js << 'EOF'
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
      script: 'uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 8000',
      cwd: './backend',
      interpreter: './venv/bin/python',
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

echo "✅ PM2 config created!"

