import type { SuperfeedrItem } from '../types';
import {
    crMembers,
    newsBlacklist,
    newsSources,
} from '../constants';
import { getDifference } from './dates';

// todo: keep text within bsky char limit
const parseText = (text: string) => {
    const parsedText = text.trim();
    return parsedText;
};

export const parseItems = (items: SuperfeedrItem[]) =>
    items.map((item) => ({
        text: parseText(item.title),
        external: item.permalinkUrl,
    }));


const tiktokMembersRegex = new RegExp(
    crMembers
        .map(({ name, tiktok = name }) => tiktok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'),
    'g',
);

export const parseTikTokItems = (items: SuperfeedrItem[]) =>
    items.map((item) => {
        // remove mentions and hashtags at the end of the string
        let text = item.title.replace(/[@#][\s@#\w'`’]*$/, '');

        // replace TikTok handles with Bluesky handles
        text = text.replace(
            tiktokMembersRegex,
            (match) => {
                const member = crMembers.find(({ name, tiktok = name }) => tiktok === match);
                return member.bsky || member.name;
            },
        );

        text = parseText(text);

        const [, thumbnailUrl] = /<img\s+[^>]*src="([^"]+)"/i.exec(item.summary) || [];

        return {
            text,
            external: {
                uri: item.permalinkUrl,
                title: text,
                description: 'TikTok video by Critical Role',
                ...thumbnailUrl ? { thumb: { data: thumbnailUrl } } : {},
            },
        };
    });


const newsMembersRegex = new RegExp(
    crMembers
        .map(({ name }) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'),
    'g',
);

const newsSourcesRegex = new RegExp(
    `(${Object.keys(newsSources)
    .map((handle) => handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})$`
);

export const parseNewsItems = (items: SuperfeedrItem[]) => {
    // filter items published less than 2 days ago and not in blacklist
    const filteredItems = items.filter(({ published, title }) => (
        getDifference(new Date(published * 1000)) >= -48 && !newsBlacklist.some((blacklist) => title.includes(blacklist))
    ));
    return filteredItems.map((item) => {
        let text = item.title.replace('Critical Role', '#CriticalRole');

        // add Bluesky handles for CR members
        const replacedMembers = new Set<string>();
        text = text.replace(
            newsMembersRegex,
            (match) => {
                const member = crMembers.find(({ name }) => name === match);
                if (!replacedMembers.has(match) && member.bsky) {
                    replacedMembers.add(match);
                    return `${match} (${member.bsky})`;
                }
                return match;
            },
        );

        // add Bluesky handles for news sources
        text = text.replace(
            newsSourcesRegex,
            (match) => `${match} (${newsSources[match]})`,
        );

        text = parseText(text);

        return {
            text,
            external: {
                uri: item.permalinkUrl,
                title: item.title,
                description: 'Google News - Critical Role',
            },
        };
    });
};
