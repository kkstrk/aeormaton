import { requiredEnv, useEnv } from "../utils/useEnv.js";

import type { Bot } from "@skyware/bot";

useEnv();

let session: Awaited<ReturnType<Bot["login"]>> | undefined;

export const login = async (bot: Bot) => {
    if (session) {
        console.log("Resuming session...");
        try {
            session = await bot.resumeSession(session);
            return;
        } catch (error) {
            console.error("Could not resume session.", error);
        }
    }
    console.log("Logging in...");
    session = await bot.login({
        identifier: requiredEnv("BSKY_USERNAME"),
        password: requiredEnv("BSKY_PASSWORD"),
    });
};
