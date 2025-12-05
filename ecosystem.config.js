module.exports = {
  apps: [
    {
       name: "staging",
      script: "dist/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
    PORT: 4040
      },
    },
    {
      name: "yoco-email-worker",
      script: "dist/worker.js",
      instances: 1, 
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        WORKER_ID: "worker-1",
    PORT: 4000
    
      },
    },
  ],
};