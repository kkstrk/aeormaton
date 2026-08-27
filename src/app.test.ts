import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createApp } from "./app.js";

import type { BotClient } from "./app.js";

const createStubBot = (): BotClient => ({
    post: async () => {},
    postThread: async () => {},
    session: Promise.resolve(),
});

describe("createApp", () => {
    it("GET / returns the healthcheck status", async () => {
        const bot = createStubBot();
        const app = createApp(bot);

        const response = await app.request("/");

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { connected: true, status: "ok" });
    });

    it("GET / reports connected: false when the bot has no session", async () => {
        const bot = createStubBot();
        bot.session = undefined;
        const app = createApp(bot);

        const response = await app.request("/");

        assert.deepEqual(await response.json(), { connected: false, status: "ok" });
    });
});
