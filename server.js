let createApp;
try {
  ({ createApp } = await import("./src/app.js"));
} catch (error) {
  console.error("SkinWise did not start. This folder is an old copy mixed with a new one.");
  console.error("Do not run it from Music\\skinwise or Desktop\\skinwise-project.");
  console.error("Extract the latest skinwise.zip into a new empty folder, open that folder, and run npm start there.");
  console.error(error.message);
  process.exit(1);
}

const port = Number(process.env.PORT) || 3060;
const host = process.env.HOST || "0.0.0.0";
const serverId = process.env.SERVER_ID || "local";

createApp({ serverId }).listen(port, host, () => {
  console.log(`SkinWise ${serverId} listening on http://${host}:${port}`);
});
