import { Hono } from "hono";
import { cors } from "hono/cors";

import type { BotClient } from "./types/index.js";

export type { BotClient } from "./types/index.js";

export const createApp = (bot: BotClient) => {
    const app = new Hono();

    app.use(cors());

    // healthcheck endpoint
    app.get("/", (c) => c.json({ connected: Boolean(bot.session), status: "ok" }));

    return app;
};
