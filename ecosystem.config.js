module.exports = {
  apps: [
    {
      name: "yoco-api",
      script: "dist/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "yoco-email-worker",
      script: "dist/worker.js",
      cwd: "./", // Ensure it runs from project root
      instances: 1, 
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        WORKER_ID: "worker-1",
      },
    },
  ],
};
