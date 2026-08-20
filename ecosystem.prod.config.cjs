module.exports = {
  apps: [{
    name: "dunvex_backend",
    script: "server.js",
    cwd: ".",
    env: {
      NODE_ENV: "production"
    }
  }]
};
