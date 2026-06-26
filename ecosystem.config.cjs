module.exports = {
  apps: [
    {
      name: "aios-api",
      script: "./node_modules/.bin/tsx",
      args: "services/api/src/index.ts",
      cwd: "/home/administrator/projects/aios",
      watch: false,
      env: {
        NODE_ENV: "development",
      },
    },
    {
      name: "aios-ui",
      script: "npm",
      args: "run dev",
      cwd: "/home/administrator/projects/aios/apps/command-center",
      watch: false,
      env: {
        NODE_ENV: "development",
        PORT: "3334",
      },
    },
  ],
};
