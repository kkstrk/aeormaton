import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseItems, parseNewsItems, parseTikTokItems, parseTwitterItems } from "./parsers.js";

const mockItem = {
    permalinkUrl: "url",
    published: Date.now() / 1000,
    summary: "summary",
    title: "title",
};

const mockFeedItem = {
    publishedAt: new Date(),
    title: "title",
    url: "url",
};

describe("parseItems", () => {
    it("should return an array of posts", () => {
        const items = [
            { ...mockFeedItem, title: "title1" },
            { ...mockFeedItem, title: "title2" },
        ];
        const result = parseItems(items);
        assert.equal(result.length, items.length);
        result.forEach((post, index) => {
            assert.equal(post?.text, items[index]?.title);
            assert.equal(post?.external, items[index]?.url);
        });
    });

    it("should trim post text", () => {
        const [item] = parseItems([{ ...mockFeedItem, title: "   title1 " }]);
        assert.equal(item?.text, "title1");
    });

    it("should truncate post text", () => {
        const items = [{ ...mockFeedItem, title: `${"text ".repeat(60)} over limit` }];
        const [item] = parseItems(items);
        const text = typeof item?.text === "string" ? item?.text : String(item?.text);
        assert.ok(text.length <= 300);
        assert.equal(text, `${"text ".repeat(59).trim()}...`);
    });
});

describe("parseTikTokItems", () => {
    it("should return an array of posts", () => {
        const items = [
            { ...mockItem, title: "title1" },
            { ...mockItem, title: "title2" },
        ];
        const result = parseTikTokItems(items);
        assert.equal(result.length, items.length);
        result.forEach((post, index) => {
            assert.equal(post.text, items[index]?.title);
            assert.ok(typeof post.external !== "string");
            assert.equal(post.external?.uri, items[index]?.permalinkUrl);
            assert.equal(post.external?.title, items[index]?.title);
        });
    });

    it("should remove hashtags from the end of post text", () => {
        const result = parseTikTokItems([
            { ...mockItem, title: "Text #foo #bar" },
            { ...mockItem, title: "Text @mention @handle" },
            { ...mockItem, title: "Text #foo @mention #bar" },
            // { ...mockItem, title: 'Text #foo Text @mention #bar' }, // todo: fix this
        ]);
        assert.equal(result[0]?.text, "Text");
        assert.equal(result[1]?.text, "Text");
        assert.equal(result[2]?.text, "Text");
        // assert.equal(result[3]?.text, 'Text #foo Text');
    });

    it("should replace mentions in post text", () => {
        const result = parseTikTokItems([
            { ...mockItem, title: "Replaces @LauraBaileyVO w/ @laurabaileyvo.bsky.social." },
            { ...mockItem, title: "Replaces (@Marisha Ray641) w/ Marisha Ray." },
            {
                ...mockItem,
                title: "Replaces Brennan Lee Mulligan w/ @brennanleemulligan.bsky.social.",
            },
        ]);
        assert.equal(
            result[0]?.text,
            "Replaces @laurabaileyvo.bsky.social w/ @laurabaileyvo.bsky.social.",
        );
        assert.equal(result[1]?.text, "Replaces (Marisha Ray) w/ Marisha Ray.");
        assert.equal(
            result[2]?.text,
            "Replaces @brennanleemulligan.bsky.social w/ @brennanleemulligan.bsky.social.",
        );
    });
});

describe("parseNewsItems", () => {
    it("should return an array of posts", async () => {
        const items = [
            { ...mockFeedItem, title: "title1", url: "url1" },
            { ...mockFeedItem, title: "title2", url: "url2" },
        ];
        const result = await parseNewsItems(items);
        assert.equal(result.length, items.length);
        result.forEach((post, index) => {
            assert.equal(post.text, items[index]?.title);
            assert.equal(post.external, items[index]?.url);
        });
    });

    it("should drop items that decode to a URL already seen", async () => {
        const result = await parseNewsItems([
            { ...mockFeedItem, title: "title1", url: "url" },
            { ...mockFeedItem, title: "title2", url: "url" },
        ]);
        assert.equal(result.length, 1);
        assert.equal(result[0]?.text, "title1");
    });

    it("should exclude posts published more than 48 hours ago", async () => {
        const result = await parseNewsItems([
            {
                ...mockFeedItem,
                publishedAt: new Date(new Date().setHours(new Date().getHours() - 49)),
            },
            {
                ...mockFeedItem,
                publishedAt: new Date(new Date().setDate(new Date().getDate() - 3)),
            },
        ]);
        assert.equal(result.length, 0);
    });

    it("should exclude posts with blacklisted text", async () => {
        const result = await parseNewsItems([
            { ...mockFeedItem, title: "A post - MSN" },
            { ...mockFeedItem, title: "A post - Yahoo Entertainment" },
            { ...mockFeedItem, title: "This is likely not a post about critical role" },
            { ...mockFeedItem, title: "Something played a Critical Role in something random" },
        ]);
        assert.equal(result.length, 0);
    });

    it("should replace first occurrence of Critical Role with #CriticalRole", async () => {
        const result = await parseNewsItems([
            { ...mockFeedItem, title: "A post w/ Critical Role", url: "url1" },
            {
                ...mockFeedItem,
                title: "A post w/ Critical Role. Also, Critical Role",
                url: "url2",
            },
            { ...mockFeedItem, title: "A post w/ Critical Role's founders", url: "url3" },
        ]);
        assert.equal(result[0]?.text, "A post w/ #CriticalRole");
        assert.equal(result[1]?.text, "A post w/ #CriticalRole. Also, Critical Role");
        assert.equal(result[2]?.text, "A post w/ #CriticalRole founders");
    });

    it("should add bsky handles for CR members", async () => {
        const result = await parseNewsItems([
            { ...mockFeedItem, title: "A post w/ Marisha Ray", url: "url1" },
            { ...mockFeedItem, title: "A post w/ Laura Bailey", url: "url2" },
            {
                ...mockFeedItem,
                title: "A post w/ Matthew Mercer and Matthew Mercer and Matt Mercer",
                url: "url3",
            },
            { ...mockFeedItem, title: "A post w/ Laura Bailey and Matt Mercer", url: "url4" },
        ]);
        assert.equal(result[0]?.text, "A post w/ Marisha Ray");
        assert.equal(result[1]?.text, "A post w/ Laura Bailey (@laurabaileyvo.bsky.social)");
        assert.equal(
            result[2]?.text,
            "A post w/ Matthew Mercer (@matthewmercer.bsky.social) and Matthew Mercer and Matt Mercer",
        );
        assert.equal(
            result[3]?.text,
            "A post w/ Laura Bailey (@laurabaileyvo.bsky.social) and Matt Mercer (@matthewmercer.bsky.social)",
        );
    });

    it("should add bsky handles for news sources", async () => {
        const result = await parseNewsItems([
            { ...mockFeedItem, title: "A post - Variety", url: "url1" },
            { ...mockFeedItem, title: "A post - XYZ", url: "url2" },
            { ...mockFeedItem, title: "A post w/ Polygon - Polygon", url: "url3" },
        ]);
        assert.equal(result[0]?.text, "A post - Variety (@variety.com)");
        assert.equal(result[1]?.text, "A post - XYZ");
        assert.equal(result[2]?.text, "A post w/ Polygon - Polygon (@polygon.com)");
    });
});

describe("parseTwitterItems", () => {
    const tweetWithImage =
        'Hey @BalatroGame Vox Machina has joined the party!<br><br>Critical Role has come to Balatro in the free Friends of Jimbo update—add Scanlan, Vex, and Percy to your next run!<br><img width="2048" height="1152" style="" src="https://pbs.twimg.com/media/Gklf0m5WwAAMFDR?format=jpg&amp;name=orig" referrerpolicy="no-referrer">';
    const tweetWithImages =
        'MEET THE HEROES OF #EXUDivergence 🔀🌱<br><br>A healer working to keep those around her alive in the wake of the war of the Gods, Rei\'nia Saph is played by Celia Rose Gooding! ⚕️✨<br><br>[ Art by @agarthanguide ] <br><br>#CriticalRoleSpoilers<br><img width="1542" height="2000" style="" src="https://pbs.twimg.com/media/GkSKkTuW0AEm_8J?format=jpg&amp;name=orig" referrerpolicy="no-referrer"><img width="1542" height="2000" style="" src="https://pbs.twimg.com/media/GkSLtf-X0AAGtdq?format=jpg&amp;name=orig" referrerpolicy="no-referrer">';
    const tweetWithVideo =
        'Everyone, Stay Calm! 🐴<br><br>Our misfit mercenaries find the Elk Eidolon and more in Season 2, Episode 18 of #TheReSlayersTake - now available on YouTube and wherever your favorite podcasts are found! You don’t want to miss the first part of this EPIC finale 🔥<br><br>JOIN UP WITH THE RE-SLAYERS ⬇️<br>▶️ https://bit.ly/41hr2Ye<br>🔮 https://bit.ly/4gzbGo4<br>🍏 https://apple.co/4fl85sH<br>🔊 https://spoti.fi/3DlScVJ<br><video width="1920" height="1080" src="https://video.twimg.com/amplify_video/1894100609386635264/vid/avc1/1920x1080/l4bUCIOUmua_ZMjQ.mp4?tag=16" controls="controls" poster="https://pbs.twimg.com/media/GkkyhqNXgAArXS6?format=jpg&amp;name=orig"></video>';

    it("should return an array of posts", () => {
        const items = [
            { ...mockItem, summary: tweetWithImage },
            { ...mockItem, summary: tweetWithImages },
            { ...mockItem, summary: tweetWithVideo },
        ];
        const result = parseTwitterItems(items);

        assert.equal(result.length, items.length);
        assert.ok(!Array.isArray(result[0]));
        assert.equal(
            result[0]?.text,
            "[Twitter] Hey @BalatroGame Vox Machina has joined the party!\n\n" +
                "Critical Role has come to Balatro in the free Friends of Jimbo update—add Scanlan, Vex, and Percy to your next run!",
        );
        assert.equal(result[0]?.images?.length, 1);
        assert.equal(
            result[0]?.images[0]?.data,
            "https://pbs.twimg.com/media/Gklf0m5WwAAMFDR?format=jpg&name=orig",
        );

        assert.ok(!Array.isArray(result[1]));
        assert.equal(
            result[1]?.text,
            "[Twitter] MEET THE HEROES OF #EXUDivergence 🔀🌱\n\n" +
                "A healer working to keep those around her alive in the wake of the war of the Gods, Rei'nia Saph is played by Celia Rose Gooding! ⚕️✨\n\n" +
                "[ Art by @agarthanguide ]\n\n" +
                "#CriticalRoleSpoilers",
        );
        assert.equal(result[1]?.images?.length, 2);
        assert.equal(
            result[1]?.images[0]?.data,
            "https://pbs.twimg.com/media/GkSKkTuW0AEm_8J?format=jpg&name=orig",
        );
        assert.equal(
            result[1]?.images[1]?.data,
            "https://pbs.twimg.com/media/GkSLtf-X0AAGtdq?format=jpg&name=orig",
        );

        assert.ok(Array.isArray(result[2]));
        assert.equal(
            result[2][0]?.text,
            "[Twitter] Everyone, Stay Calm! 🐴\n\n" +
                "Our misfit mercenaries find the Elk Eidolon and more in Season 2, Episode 18 of #TheReSlayersTake - now available on YouTube and wherever your favorite podcasts are found! You don’t want to miss the first part of this EPIC finale 🔥\n\n" +
                "JOIN UP WITH THE RE-SLAYERS",
        );
        assert.equal(
            result[2][0]?.video?.data,
            "https://video.twimg.com/amplify_video/1894100609386635264/vid/avc1/1920x1080/l4bUCIOUmua_ZMjQ.mp4?tag=16",
        );
        assert.equal(
            result[2][1]?.text,
            "⬇️\n" +
                "▶️ https://bit.ly/41hr2Ye\n" +
                "🔮 https://bit.ly/4gzbGo4\n" +
                "🍏 https://apple.co/4fl85sH\n" +
                "🔊 https://spoti.fi/3DlScVJ",
        );
    });

    it("should exclude retweets and replies", () => {
        const result = parseTwitterItems([
            { ...mockItem, title: "RT @handle Retweet" },
            { ...mockItem, title: "Re @handle Reply" },
        ]);
        assert.equal(result.length, 0);
    });

    it("should add bsky handles for CR members", () => {
        const result = parseTwitterItems([
            { ...mockItem, summary: "Replaces @LauraBaileyVO w/ @laurabaileyvo.bsky.social." },
            { ...mockItem, summary: "Replaces @Marisha_Ray w/ Marisha Ray." },
            {
                ...mockItem,
                summary: "Replaces Brennan Lee Mulligan w/ @brennanleemulligan.bsky.social.",
            },
        ]);

        assert.ok(!Array.isArray(result[0]));
        assert.equal(
            result[0]?.text,
            "[Twitter] Replaces @laurabaileyvo.bsky.social w/ @laurabaileyvo.bsky.social.",
        );

        assert.ok(!Array.isArray(result[1]));
        assert.equal(result[1]?.text, "[Twitter] Replaces Marisha Ray w/ Marisha Ray.");

        assert.ok(!Array.isArray(result[2]));
        assert.equal(
            result[2]?.text,
            "[Twitter] Replaces @brennanleemulligan.bsky.social w/ @brennanleemulligan.bsky.social.",
        );
    });
});
