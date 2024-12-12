import { Bot } from '@skyware/bot';

import { login } from './login';
import { handleCommands } from './commands';

export const bot = new Bot();

// login to bsky
(async () => {
    await login(bot);
    console.log('Has session: ', bot.hasSession);
})();

// listen to events
bot.on('reply', handleCommands);
bot.on('mention', handleCommands);
