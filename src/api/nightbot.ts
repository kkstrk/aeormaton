interface NightbotResponse {
    commands: {
        _id: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        alias?: string;
        message: string;
        userLevel: string;
        count: number;
        coolDown: number;
    }[];
}

export const getCommand = async (commandName: string) => {
    const response = await fetch('https://api.nightbot.tv/1/commands', {
        headers: { 'Nightbot-Channel': '5b2ae50723859507177a586b' },
    });
    if (!response.ok) {
        throw new Error(`Response status: ${response.status}.`);
    }

    const json = await response.json();
    if (!json || typeof json !== 'object' || !Array.isArray((json as NightbotResponse).commands)) {
        throw new Error('Unexpected response structure.');
    }

    const command = (json as NightbotResponse).commands.find(({ name }) => name === commandName);
    if (!command) {
        throw new Error(`Could not find ${commandName} command.`);
    }
    return command;
};
