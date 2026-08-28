import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { setTimeout } from "node:timers/promises";

import { createStreamReminder, getNextCheck } from "./streamReminder.js";

import type { PostPayload } from "@skyware/bot";
import type { BroadcastSegment, GetNextBroadcast } from "./streamReminder.js";
import type { BotClient } from "../types/index.js";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const segmentStartingIn = (minutes: number, durationMinutes = 180): BroadcastSegment => ({
    endDate: new Date(Date.now() + (minutes + durationMinutes) * MINUTE_MS),
    id: "1",
    startDate: new Date(Date.now() + minutes * MINUTE_MS),
    title: "Campaign 4",
});

const createStubBot = () => {
    const post = mock.fn(async (_post: PostPayload) => {});
    const bot: BotClient = { post, postThread: async () => {}, session: Promise.resolve() };
    return { bot, post };
};

// eslint-disable-next-line unicorn/no-useless-undefined -- Promise.resolve() alone types as Promise<void>, not Promise<BroadcastSegment | undefined>
const noBroadcast: GetNextBroadcast = () => Promise.resolve(undefined);

describe("getNextCheck", () => {
    const config = { maxCheckDelayMs: 12 * HOUR_MS, reminderMinutesBefore: 30 };

    it("falls back to maxCheckDelayMs when there is no upcoming broadcast", () => {
        const result = getNextCheck(undefined, config);

        assert.deepEqual(result, { delayMs: 12 * HOUR_MS, shouldRemind: false });
    });

    it("caps the delay at maxCheckDelayMs when the broadcast is far away", () => {
        const segment = segmentStartingIn(40 * 60);

        const result = getNextCheck(segment, config);

        assert.equal(result.shouldRemind, false);
        assert.equal(result.delayMs, 12 * HOUR_MS);
    });

    it("sleeps the exact remaining time once within the safety cap", () => {
        const segment = segmentStartingIn(5 * 60);

        const result = getNextCheck(segment, config);

        assert.equal(result.shouldRemind, false);
        const expected = 5 * HOUR_MS - 30 * MINUTE_MS;
        assert.ok(Math.abs(result.delayMs - expected) < 1000);
    });

    it("says to remind once inside the reminder window", () => {
        const segment = segmentStartingIn(20);

        const result = getNextCheck(segment, config);

        assert.equal(result.shouldRemind, true);
    });

    it("reschedules for after the segment ends once it's reminded (or already started)", () => {
        const segment = segmentStartingIn(-10, 180);

        const result = getNextCheck(segment, config);

        assert.equal(result.shouldRemind, false);
        const expected = 170 * MINUTE_MS;
        assert.ok(Math.abs(result.delayMs - expected) < 1000);
    });

    it("falls back to maxCheckDelayMs once the segment has fully ended", () => {
        const segment = segmentStartingIn(-200, 180);

        const result = getNextCheck(segment, config);

        assert.equal(result.shouldRemind, false);
        assert.equal(result.delayMs, 12 * HOUR_MS);
    });
});

describe("createStreamReminder", () => {
    it("posts a reminder when the stream starts within the threshold", async () => {
        const { bot, post } = createStubBot();
        const getNextBroadcast = mock.fn(() => Promise.resolve(segmentStartingIn(20)));

        await createStreamReminder(bot, { getNextBroadcast }).checkOnce();

        assert.equal(post.mock.callCount(), 1);
        assert.equal(post.mock.calls[0]?.arguments[0].text, "Campaign 4 starts in 30 minutes!");
        assert.deepEqual(post.mock.calls[0]?.arguments[0].external, {
            description: "Watch live on Twitch",
            title: "Campaign 4",
            uri: "https://www.twitch.tv/criticalrole",
        });
    });

    it("always uses the configured reminderMinutesBefore in the text, not a live countdown", async () => {
        const { bot, post } = createStubBot();
        // the check fires a few minutes into the reminder window, not at
        // the exact instant it opened
        const getNextBroadcast = mock.fn(() => Promise.resolve(segmentStartingIn(21)));

        await createStreamReminder(bot, {
            getNextBroadcast,
            reminderMinutesBefore: 30,
        }).checkOnce();

        assert.equal(post.mock.calls[0]?.arguments[0].text, "Campaign 4 starts in 30 minutes!");
    });

    it("does not post when the stream is further away than the threshold", async () => {
        const { bot, post } = createStubBot();
        const getNextBroadcast = mock.fn(() => Promise.resolve(segmentStartingIn(60)));

        await createStreamReminder(bot, { getNextBroadcast }).checkOnce();

        assert.equal(post.mock.callCount(), 0);
    });

    it("does not post when the stream has already started", async () => {
        const { bot, post } = createStubBot();
        const getNextBroadcast = mock.fn(() => Promise.resolve(segmentStartingIn(-5)));

        await createStreamReminder(bot, { getNextBroadcast }).checkOnce();

        assert.equal(post.mock.callCount(), 0);
    });

    it("does not remind twice for the same segment", async () => {
        const { bot, post } = createStubBot();
        const getNextBroadcast = mock.fn(() => Promise.resolve(segmentStartingIn(20)));
        const reminder = createStreamReminder(bot, { getNextBroadcast });

        await reminder.checkOnce();
        await reminder.checkOnce();

        assert.equal(post.mock.callCount(), 1);
    });

    it("does not retry a reminder on the next check if posting it throws (e.g. a lost response after a successful write)", async () => {
        const { bot, post } = createStubBot();
        const getNextBroadcast = mock.fn(() => Promise.resolve(segmentStartingIn(20)));
        post.mock.mockImplementationOnce(() => {
            throw new Error("upstream timeout, but the write may have gone through");
        });
        const reminder = createStreamReminder(bot, { getNextBroadcast });

        // attempts to post, throws
        await reminder.checkOnce();
        // should not retry the same segment
        await reminder.checkOnce();

        assert.equal(post.mock.callCount(), 1);
    });

    it("reminds again once a new segment shows up", async () => {
        let segment = segmentStartingIn(20);
        const { bot, post } = createStubBot();
        const getNextBroadcast = mock.fn(() => Promise.resolve(segment));
        const reminder = createStreamReminder(bot, { getNextBroadcast });

        await reminder.checkOnce();
        segment = { ...segmentStartingIn(20), id: "2", title: "Campaign 4, part 2" };
        await reminder.checkOnce();

        assert.equal(post.mock.callCount(), 2);
    });

    it("does nothing when there is no upcoming broadcast", async () => {
        const { bot, post } = createStubBot();

        await createStreamReminder(bot, { getNextBroadcast: noBroadcast }).checkOnce();

        assert.equal(post.mock.callCount(), 0);
    });

    it("does not throw when fetching the broadcast fails", async () => {
        const { bot, post } = createStubBot();
        const getNextBroadcast = mock.fn(() => Promise.reject(new Error("network error")));

        await createStreamReminder(bot, { getNextBroadcast }).checkOnce();

        assert.equal(post.mock.callCount(), 0);
    });

    it("start() checks immediately and reschedules itself", async () => {
        const { bot, post } = createStubBot();
        const getNextBroadcast = mock.fn(() => Promise.resolve(segmentStartingIn(60)));

        const stop = createStreamReminder(bot, {
            getNextBroadcast,
            maxCheckDelayMs: 10,
        }).start();
        await setTimeout(50);
        stop();

        assert.ok(getNextBroadcast.mock.callCount() >= 2);
        assert.equal(post.mock.callCount(), 0);
    });
});
