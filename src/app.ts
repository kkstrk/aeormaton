import { Hono } from "hono";
import { cors } from "hono/cors";

import { parseTikTokItems, parseTwitterItems } from "./utils/parsers.js";

import type { PostPayload } from "@skyware/bot";
import type { BotClient, SuperfeedrItem } from "./types/index.js";

export type { BotClient } from "./types/index.js";

export const createApp = (bot: BotClient) => {
    const app = new Hono();

    app.use(cors());

    // healthcheck endpoint
    app.get("/", (c) => c.json({ connected: !!bot.session, status: "ok" }));

    const api = new Hono();

    const useEndpoint = (
        endpoint: string,
        parser: (
            items: SuperfeedrItem[],
        ) => (PostPayload | PostPayload[])[] | Promise<(PostPayload | PostPayload[])[]>,
    ) => {
        api.post(endpoint, async (c) => {
            try {
                const body = await c.req.json();
                console.log(`POST at ${endpoint} with body:`);
                console.log(body);
                const posts = await parser(body.items);
                if (posts.length > 0) {
                    for (const post of posts) {
                        if (Array.isArray(post)) {
                            await bot.postThread(post);
                        } else {
                            await bot.post(post);
                        }
                    }
                } else {
                    console.log("There are no new updates to post.");
                }
                return c.json({ message: "ok" });
            } catch (error) {
                console.log("Could not post feed update.", error);
                return c.json({ error: String(error) }, 500);
            }
        });
    };

    useEndpoint("/tiktok", parseTikTokItems);
    useEndpoint("/twitter", parseTwitterItems);

    // version the api
    app.route("/api/v1", api);

    return app;
};
