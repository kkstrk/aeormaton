import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

import { retry } from "./retry.js";

describe("retry", () => {
    it("returns the result on the first successful attempt", async () => {
        const fn = mock.fn(() => Promise.resolve("ok"));

        const result = await retry(fn, { delayMs: 1 });

        assert.equal(result, "ok");
        assert.equal(fn.mock.callCount(), 1);
    });

    it("retries after a failure and returns the eventual result", async () => {
        let callCount = 0;
        const fn = mock.fn(() => {
            callCount += 1;
            if (callCount < 3) {
                throw new Error(`Failed attempt ${callCount}`);
            }
            return Promise.resolve("ok");
        });

        const result = await retry(fn, { attempts: 3, delayMs: 1 });

        assert.equal(result, "ok");
        assert.equal(fn.mock.callCount(), 3);
    });

    it("throws the last error once all attempts are exhausted", async () => {
        const fn = mock.fn(() => {
            throw new Error("Always fails");
        });

        await assert.rejects(retry(fn, { attempts: 2, delayMs: 1 }), /Always fails/u);
        assert.equal(fn.mock.callCount(), 2);
    });
});
