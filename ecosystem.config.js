module.exports = {
  apps : [{
    name: "bot",
    script: "./bot.js",
    node_args: "--no-deprecation",
    args: "172.65.194.229 25565",
    restart_delay: 30000,
    autorestart: true,
    instances: 1,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
}
