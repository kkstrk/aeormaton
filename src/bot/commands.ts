import { getCommand } from "../api/nightbot.js";
import { getNextBroadcast } from "../api/twitch.js";
import { getRemainingTime } from "../utils/dates.js";

import type { Post } from "@skyware/bot";

type Command = () => string | Promise<string>;

const RUNTIME_COMMAND = "!runtime";
const SCHEDULE_COMMAND = "!schedule";

const rollCommands = [4, 6, 8, 10, 12, 20, 100].reduce<Record<string, Command>>((commands, max) => {
    commands[`!d${max}`] = () => {
        const roll = Math.floor(Math.random() * max) + 1;
        return roll.toString();
    };
    return commands;
}, {});

const commands: Record<string, Command> = {
    ...rollCommands,
    [RUNTIME_COMMAND]: async () => {
        const command = await getCommand(RUNTIME_COMMAND);
        const date = new Intl.DateTimeFormat("en-US", {
            day: "numeric",
            month: "short",
            timeZone: "America/Los_Angeles",
            year: "numeric",
        }).format(new Date(command.updatedAt));
        return `${command.message} [Updated ${date}]`;
    },
    [SCHEDULE_COMMAND]: async () => {
        const broadcast = await getNextBroadcast();
        if (!broadcast) {
            return "No upcoming broadcast on the schedule.";
        }
        return `${broadcast.title} starts in ${getRemainingTime(broadcast.startDate)}.`;
    },
};

export const handleCommands = async (post: Post) => {
    const allCommandNames = post.text.match(/!\S+/gu) || [];
    const commandNames = [...new Set(allCommandNames)].filter((commandName) =>
        Boolean(commands[commandName]),
    );
    for (const commandName of commandNames) {
        console.log(`Running ${commandName} command.`);
        try {
            const run = commands[commandName];
            if (!run) {
                continue;
            }
            const text = await run();
            if (text) {
                await post.reply({ text });
                console.log(`Successfully ran ${commandName} command.`);
            }
        } catch (error) {
            console.error(`Could not run ${commandName} command.`, error);
        }
    }
};
