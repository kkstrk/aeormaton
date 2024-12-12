import type { Bot } from '@skyware/bot';

import { useEnv } from '../utils/useEnv';

useEnv();

let session;

export const login = async (bot: Bot) => {
    if (session) {
        console.log('Resuming session...');
        try {
            session = await bot.resumeSession(session);
            return;
        } catch (error) {
            console.error('Could not resume session.', error);
        }
    }
    console.log('Logging in...');
    session = await bot.login({
        identifier: process.env.BSKY_USERNAME,
        password: process.env.BSKY_PASSWORD,
    });
};
