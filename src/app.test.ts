import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { createApp } from "./app.js";

import type { BotClient } from "./app.js";

const mockItem = {
    permalinkUrl: "https://critrole.com/new-post",
    published: Date.now() / 1000,
    summary: "summary",
    title: "title",
};

const createStubBot = () => {
    const post = mock.fn(async () => {});
    const postThread = mock.fn(async () => {});
    const bot: BotClient = { post, postThread, session: Promise.resolve() };
    return { bot, post, postThread };
};

const postJson = (app: ReturnType<typeof createApp>, endpoint: string, body: unknown) =>
    app.request(endpoint, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
    });

describe("createApp", () => {
    it("GET / returns the healthcheck status", async () => {
        const { bot } = createStubBot();
        const app = createApp(bot);

        const response = await app.request("/");

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { connected: true, status: "ok" });
    });

    it("GET / reports connected: false when the bot has no session", async () => {
        const { bot } = createStubBot();
        bot.session = undefined;
        const app = createApp(bot);

        const response = await app.request("/");

        assert.deepEqual(await response.json(), { connected: false, status: "ok" });
    });

    it("POST /api/v1/blog posts each parsed item", async () => {
        const { bot, post, postThread } = createStubBot();
        const app = createApp(bot);

        const response = await postJson(app, "/api/v1/blog", {
            items: [
                { ...mockItem, title: "first" },
                { ...mockItem, title: "second" },
            ],
        });

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { message: "ok" });
        assert.equal(post.mock.callCount(), 2);
        assert.equal(postThread.mock.callCount(), 0);
    });

    it("POST /api/v1/blog does nothing when the parser returns no posts", async () => {
        const { bot, post } = createStubBot();
        const app = createApp(bot);

        const response = await postJson(app, "/api/v1/blog", { items: [] });

        assert.equal(response.status, 200);
        assert.equal(post.mock.callCount(), 0);
    });

    it("POST /api/v1/twitter posts a thread when the parser returns one", async () => {
        const { bot, post, postThread } = createStubBot();
        const app = createApp(bot);

        const longText = `${"word ".repeat(120)}last`;
        const response = await postJson(app, "/api/v1/twitter", {
            items: [{ ...mockItem, summary: longText, title: "irrelevant" }],
        });

        assert.equal(response.status, 200);
        assert.equal(post.mock.callCount(), 0);
        assert.equal(postThread.mock.callCount(), 1);
    });

    it("POST /api/v1/blog returns a 500 when the bot fails to post", async () => {
        const { bot } = createStubBot();
        bot.post = mock.fn(() => {
            throw new Error("Bluesky is down");
        });
        const app = createApp(bot);

        const response = await postJson(app, "/api/v1/blog", { items: [mockItem] });

        assert.equal(response.status, 500);
    });
});
