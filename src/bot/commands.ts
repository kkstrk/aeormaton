import type { Post } from '@skyware/bot';

import { getCommand } from '../api/nightbot';
import { getNextBroadcast } from '../api/twitch';
import { getRemainingTime } from '../utils/dates';

const RUNTIME_COMMAND = '!runtime';
const SCHEDULE_COMMAND = '!schedule';

const rollCommands = [4, 6, 8, 10, 12, 20, 100].reduce((commands, max) => {
    commands[`!d${max}`] = () => {
        const roll = Math.floor(Math.random() * max) + 1;
        return roll.toString();
    };
    return commands;
}, {});

const commands = {
    ...rollCommands,
    [RUNTIME_COMMAND]: async () => {
        const command = await getCommand(RUNTIME_COMMAND);
        const date = new Intl.DateTimeFormat('en-US', {
            day: 'numeric',
            month: 'short',
            timeZone: 'America/Los_Angeles',
            year: 'numeric',
        }).format(new Date(command.updatedAt));
        return `${command.message} [Updated ${date}]`;
    },
    [SCHEDULE_COMMAND]: async () => {
        const broadcast = await getNextBroadcast();
        return `${broadcast.title} starts in ${getRemainingTime(broadcast.startDate)}.`;
    },
};

export const handleCommands = async (post: Post) => {
    const allCommandNames = post.text.match(/!\S+/gu) || [];
    const commandNames = [...new Set(allCommandNames)].filter(
        (commandName) => !!commands[commandName],
    );
    for (const commandName of commandNames) {
        console.log(`Running ${commandName} command.`);
        try {
            const text = await commands[commandName]();
            if (text) {
                await post.reply({ text });
                console.log(`Successfully ran ${commandName} command.`);
            }
        } catch (error) {
            console.error(`Could not run ${commandName} command.`, error);
        }
    }
};
