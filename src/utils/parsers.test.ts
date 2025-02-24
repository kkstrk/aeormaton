import assert from 'assert/strict';
import { describe, it } from 'node:test';

import { parseItems, parseNewsItems, parseTikTokItems } from './parsers';

const mockItem = {
    permalinkUrl: 'url',
    published: +new Date() / 1000,
    summary: 'summary',
    title: 'title',
};

describe('parseItems', () => {
    it('should return an array of posts', () => {
        const items = [
            { ...mockItem, title: 'title1' },
            { ...mockItem, title: 'title2' },
        ];
        const result = parseItems(items);
        assert.equal(result.length, items.length);
        result.forEach((post, index) => {
            assert.equal(post.text, items[index].title);
            assert.equal(post.external, items[index].permalinkUrl);
        });
    });

    it('should trim post text', () => {
        const [item] = parseItems([{ ...mockItem, title: '   title1 ' }]);
        assert.equal(item.text, 'title1');
    });

    it('should truncate post text', () => {
        const items = [
            { ...mockItem, title: `${'text '.repeat(60)} over limit` },
        ];
        const [item] = parseItems(items);
        assert.ok(item.text.length <= 300);
        assert.equal(item.text, `${'text '.repeat(59).trim()}...`);
    });
});

describe('parseTikTokItems', () => {
    it('should return an array of posts', () => {
        const items = [
            { ...mockItem, title: 'title1' },
            { ...mockItem, title: 'title2' },
        ];
        const result = parseTikTokItems(items);
        assert.equal(result.length, items.length);
        result.forEach((post, index) => {
            assert.equal(post.text, items[index].title);
            assert.ok(typeof post.external !== 'string');
            assert.equal(post.external.uri, items[index].permalinkUrl);
            assert.equal(post.external.title, items[index].title);
        });
    });

    it('should remove hashtags from the end of post text', () => {
        const result = parseTikTokItems([
            { ...mockItem, title: 'Text #foo #bar' },
            { ...mockItem, title: 'Text @mention @handle' },
            { ...mockItem, title: 'Text #foo @mention #bar' },
            // { ...mockItem, title: 'Text #foo Text @mention #bar' }, // todo: fix this
        ]);
        assert.equal(result[0].text, 'Text');
        assert.equal(result[1].text, 'Text');
        assert.equal(result[2].text, 'Text');
        // assert.equal(result[3].text, 'Text #foo Text');
    });

    it('should replace mentions in post text', () => {
        const result = parseTikTokItems([
            { ...mockItem, title: 'Replaces @LauraBaileyVO w/ @laurabaileyvo.bsky.social.' },
            { ...mockItem, title: 'Replaces @Marisha Ray641 w/ Marisha Ray.' },
            {
                ...mockItem,
                title: 'Replaces Brennan Lee Mulligan w/ @brennanleemulligan.bsky.social.',
            },
        ]);
        assert.equal(
            result[0].text,
            'Replaces @laurabaileyvo.bsky.social w/ @laurabaileyvo.bsky.social.',
        );
        assert.equal(result[1].text, 'Replaces Marisha Ray w/ Marisha Ray.');
        assert.equal(
            result[2].text,
            'Replaces @brennanleemulligan.bsky.social w/ @brennanleemulligan.bsky.social.',
        );
    });
});

describe('parseNewsItems', () => {
    it('should return an array of posts', async () => {
        const items = [
            { ...mockItem, title: 'title1' },
            { ...mockItem, title: 'title2' },
        ];
        const result = await parseNewsItems(items);
        assert.equal(result.length, items.length);
        result.forEach((post, index) => {
            assert.equal(post.text, items[index].title);
            assert.equal(post.external, items[index].permalinkUrl);
        });
    });

    it('should exclude posts published more than 48 hours ago', async () => {
        const result = await parseNewsItems([
            { ...mockItem, published: new Date().setHours(new Date().getHours() - 49) / 1000 },
            { ...mockItem, published: new Date().setDate(new Date().getDate() - 3) / 1000 },
        ]);
        assert.equal(result.length, 0);
    });

    it('should exclude posts with blacklisted text', async () => {
        const result = await parseNewsItems([
            { ...mockItem, title: 'A post - MSN' },
            { ...mockItem, title: 'A post - Yahoo Entertainment' },
            { ...mockItem, title: 'This is likely not a post about critical role' },
            { ...mockItem, title: 'Something played a Critical Role in something random' }
        ]);
        assert.equal(result.length, 0);
    });

    it('should replace first occurrence of Critical Role with #CriticalRole', async () => {
        const result = await parseNewsItems([
            { ...mockItem, title: 'A post w/ Critical Role' },
            { ...mockItem, title: 'A post w/ Critical Role. Also, Critical Role' },
        ]);
        assert.equal(result[0].text, 'A post w/ #CriticalRole');
        assert.equal(result[1].text, 'A post w/ #CriticalRole. Also, Critical Role');
    });

    it('should add bsky handles for CR members', async () => {
        const result = await parseNewsItems([
            { ...mockItem, title: 'A post w/ Marisha Ray' },
            { ...mockItem, title: 'A post w/ Laura Bailey' },
            { ...mockItem, title: 'A post w/ Matthew Mercer and Matthew Mercer' },
            { ...mockItem, title: 'A post w/ Laura Bailey and Matthew Mercer' },
        ]);
        assert.equal(result[0].text, 'A post w/ Marisha Ray');
        assert.equal(result[1].text, 'A post w/ Laura Bailey (@laurabaileyvo.bsky.social)');
        assert.equal(
            result[2].text,
            'A post w/ Matthew Mercer (@matthewmercer.bsky.social) and Matthew Mercer',
        );
        assert.equal(
            result[3].text,
            'A post w/ Laura Bailey (@laurabaileyvo.bsky.social) and Matthew Mercer (@matthewmercer.bsky.social)',
        );
    });

    it('should add bsky handles for news sources', async () => {
        const result = await parseNewsItems([
            { ...mockItem, title: 'A post - Variety' },
            { ...mockItem, title: 'A post - XYZ' },
            { ...mockItem, title: 'A post w/ Polygon - Polygon' },
        ]);
        assert.equal(result[0].text, 'A post - Variety (@variety.com)');
        assert.equal(result[1].text, 'A post - XYZ');
        assert.equal(result[2].text, 'A post w/ Polygon - Polygon (@polygon.com)');
    });


});
