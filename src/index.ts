import "./utils/useEnv.js";

import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import bot from "./bot/bot.js";
import { createPoller } from "./feeds/poller.js";
import feedSources from "./feeds/sources.js";

const app = createApp(bot);

const port = Number(process.env["PORT"]) || 3333;

serve({ fetch: app.fetch, port }, (info) =>
    console.log(`API available on http://localhost:${info.port}`),
);

createPoller(bot, feedSources).start();
