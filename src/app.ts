import express from 'express';
import cors from 'cors';
import type { PostPayload } from '@skyware/bot';

import { bot } from './bot/bot';
import { parseItems, parseNewsItems, parseTikTokItems } from './utils/parsers';
import type { SuperfeedrItem } from './types';

export const app = express();

app.use(cors({ origin: true }));

app.use(express.json());
app.use(express.raw({ type: 'application/vnd.custom-type' }));
app.use(express.text({ type: 'text/html' }));

// healthcheck endpoint
app.get('/', (_req, res) => {
    res.status(200).send({ bot: bot.hasSession, status: 'ok' });
});

// eslint-disable-next-line new-cap
const api = express.Router();

const useEndpoint = (endpoint: string, parser: (items: SuperfeedrItem[]) => PostPayload[]) => {
    api.post(endpoint, async (req, res) => {
        console.log(`POST at ${endpoint} with body:`);
        console.log(req.body);
        try {
            const posts = parser(req.body.items);
            for (const post of posts) {
                console.log(`Posting ${JSON.stringify(post)}.`);
                await bot.post(post);
                console.log('Successfully posted to Bluesky.');
            }
            res.status(200).send({ message: 'ok' });
        } catch (error) {
            console.log('Could not post feed update.', error);
            res.status(500).send({ error });
        }
    });
};

useEndpoint('/blog', parseItems);
useEndpoint('/youtube', parseItems);
useEndpoint('/tiktok', parseTikTokItems);
useEndpoint('/news', parseNewsItems);

// version the api
app.use('/api/v1', api);
