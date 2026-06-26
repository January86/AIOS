module.exports = {
  apps: [
    {
      name: "aios-api",
      script: "tsx",
      args: "services/api/src/index.ts",
      cwd: "/home/administrator/projects/aios",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "aios-ui",
      script: "npm",
      args: "run dev",
      cwd: "/home/administrator/projects/aios/apps/command-center",
      interpreter: "none",
      env: {
        NODE_ENV: "development",
        PORT: "3334",
      },
      watch: false,
      autorestart: true,
    },
  ],
};
