module.exports = {
  apps: [
    {
      name: 'buildmaster-api',
      script: 'main.py',
      interpreter: 'python',
      interpreter_args: '-m uvicorn main:app --host 0.0.0.0 --port 8889 --workers 1',
      cwd: './api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PYTHONUNBUFFERED: '1'
      },
      env_production: {
        NODE_ENV: 'production',
        PYTHONUNBUFFERED: '1'
      },
      error_file: '/var/www/build/logs/buildmaster-api-error.log',
      out_file: '/var/www/build/logs/buildmaster-api-out.log',
      log_file: '/var/www/build/logs/buildmaster-api-combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
