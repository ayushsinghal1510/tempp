// pm2 process definition for PrepAI.
//
//   ./build.sh && pm2 start ecosystem.config.js
//
// Build and run are separate on purpose: build.sh produces .next/ and exits,
// pm2 owns the running process. Never point pm2 at build.sh.
//
// SCRIPT IS `next` DIRECTLY, NOT `npm run start`. Going through npm puts an
// extra process between pm2 and the server: pm2 signals npm, npm does not
// always forward the signal, and `pm2 restart` leaves the old next process
// holding port 3000 while the new one fails to bind. Running the binary
// directly makes pm2 the actual parent, so stop/restart/reload behave.
module.exports = {
  apps: [
    {
      name: "prepai",
      script: "./node_modules/.bin/next",
      // -H 0.0.0.0, not the default 127.0.0.1: this runs behind the litng
      // cloudspaces proxy, which reaches the container from outside. Bound to
      // loopback the port answers locally and 502s through the proxy.
      args: "start -H 0.0.0.0 -p 3000",
      cwd: __dirname,
      // Next.js loads .env itself at startup, so DATABASE_URL and the rest are
      // NOT duplicated here — one source of truth, and no secrets in a file
      // that is safe to commit.
      env: { NODE_ENV: "production" },

      // One process. `cluster` with instances > 1 would fork several servers
      // over the same port, which Next supports, but nothing here is
      // CPU-bound — it is a proxy in front of Postgres and an LLM.
      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      // A crash loop should surface, not spin silently against Neon.
      max_restarts: 10,
      min_uptime: "20s",
      restart_delay: 2000,

      // Do NOT watch. A rebuild rewrites hundreds of files under .next/, and
      // watching would restart the server repeatedly in the middle of it.
      watch: false,

      merge_logs: true,
      time: true,
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
    },
  ],
};
