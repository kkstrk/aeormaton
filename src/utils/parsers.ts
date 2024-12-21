import type { SuperfeedrItem } from '../types';
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

const tiktokHandles = {
    '@LauraBaileyVO': 'Laura Bailey',
    '@Liam O’Brien': '@voiceofobrien.bsky.social',
    '@Marisha Ray641': 'Marisha Ray',
    '@MatthewMercerVO': '@matthewmercer.bsky.social',
    '@Robbie Daymond': 'Robbie Daymond',
    '@SamRiegel': '@samriegel.bsky.social',
    '@Smashley Johnson': 'Ashley Johnson',
    '@WillingBlam': 'Travis Willingham',
};

export const parseTikTokItems = (items: SuperfeedrItem[]) =>
    items.map((item) => {
        // remove mentions and hashtags at the end of the string
        let text = item.title.replace(/[\s@#\w'`’]+$/, '');

        // replace TikTok handles with Bluesky handles
        text = text.replace(
            new RegExp(
                Object.keys(tiktokHandles)
                    .map((handle) => handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('|'),
                'g',
            ),
            (handle) => tiktokHandles[handle],
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

export const parseNewsItems = (items: SuperfeedrItem[]) => {
    // filter items published less than 3 days ago
    const filteredItems = items.filter(
        ({ published }) => getDifference(new Date(published * 1000)) >= -3,
    );
    return filteredItems.map((item) => {
        const text = parseText(item.title);
        return {
            text,
            external: {
                uri: item.permalinkUrl,
                title: text,
                description: 'Google News - Critical Role',
            },
        };
    });
};
