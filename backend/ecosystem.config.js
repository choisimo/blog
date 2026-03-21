/**
 * PM2 Configuration for Blog Backend
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production
 *   pm2 stop blog-backend
 *   pm2 logs blog-backend
 */

module.exports = {
  apps: [
    {
      name: 'blog-backend',
      script: './src/index.js',
      cwd: '/home/ubuntu/workspace/blog/backend',
      
      // Process management
      instances: 1,  // Single instance (can increase for clustering)
      exec_mode: 'fork',  // Use 'cluster' for multiple instances
      autorestart: true,
      watch: false,  // Disable in production
      max_memory_restart: '500M',
      
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        // Development-specific vars can go here
      },
      env_production: {
        NODE_ENV: 'production',
        // Production env vars are loaded from .env file
        // PM2 will automatically load .env file in the cwd
      },
      
      // Advanced options
      min_uptime: '10s',  // Minimum uptime to consider app started
      listen_timeout: 3000,  // Time to wait for app to listen
      kill_timeout: 5000,  // Time to wait before forcefully killing
      
      // Graceful shutdown
      shutdown_with_message: true,
      wait_ready: false,
      
      // Node.js flags
      node_args: '--max-old-space-size=256',
      
      // Restart delay
      restart_delay: 4000,
      
      // Auto-restart cron pattern (optional)
      // cron_restart: '0 2 * * *',  // Daily restart at 2 AM
    }
  ],

  // Deploy configuration (optional)
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/your-username/blog.git',
      path: '/home/ubuntu/workspace/blog',
      'post-deploy': 'cd backend && npm ci && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': '',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
