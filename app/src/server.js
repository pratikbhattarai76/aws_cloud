const app = require("./app");
const env = require("./config/env");

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`${env.appName} running on port ${env.port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${env.port} is already in use. Stop the process using that port or set a different PORT value before starting ${env.appName}.`
    );
    process.exit(1);
  }

  console.error("Server failed to start:", error);
  process.exit(1);
});
