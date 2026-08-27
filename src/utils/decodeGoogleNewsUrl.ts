// https://github.com/SSujitX/google-news-url-decoder-nodejs

import * as cheerio from "cheerio";

const getBase64Str = (sourceUrl: string): string => {
    try {
        const url = new URL(sourceUrl);
        const pathParts = url.pathname.split("/");
        const lastPart = pathParts.at(-1);
        const secondLastPart = pathParts.at(-2);
        if (
            url.hostname === "news.google.com" &&
            pathParts.length > 1 &&
            lastPart &&
            secondLastPart &&
            ["articles", "read"].includes(secondLastPart)
        ) {
            return lastPart;
        }
        console.log("Unexpected URL format.");
    } catch (error) {
        console.log("Could not get base 64 from URL.", error);
    }
    return "";
};

const fetchDataAttributes = async (
    url: string,
): Promise<{ signature: string; timestamp: string }> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Response status: ${response.status}.`);
    }
    const cheerioApi = cheerio.load(await response.text());
    const dataElement = cheerioApi("c-wiz > div[jscontroller]");
    if (dataElement.length === 0) {
        throw new Error(`Failed to fetch data attributes from ${url}.`);
    }
    return {
        signature: dataElement.attr("data-n-a-sg") || "",
        timestamp: dataElement.attr("data-n-a-ts") || "",
    };
};

const getDecodingParams = async (
    base64Str: string,
): Promise<{ signature: string; timestamp: string }> => {
    try {
        return await fetchDataAttributes(`https://news.google.com/articles/${base64Str}`);
    } catch {
        try {
            return await fetchDataAttributes(`https://news.google.com/rss/articles/${base64Str}`);
        } catch (error) {
            console.log("Could not get decoding params from URL.", error);
            return { signature: "", timestamp: "" };
        }
    }
};

const decodeUrl = async (
    signature: string,
    timestamp: string,
    base64Str: string,
): Promise<string> => {
    try {
        const url = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
        const payload = [
            "Fbv4je",
            `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0], "${base64Str}",${timestamp},"${signature}"]`,
        ];
        const headers = {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        };

        const response = await fetch(url, {
            body: `f.req=${encodeURIComponent(JSON.stringify([[payload]]))}`,
            headers,
            method: "POST",
        });
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}.`);
        }
        const text = await response.text();
        const [, rawPayload] = text.split("\n\n");
        if (!rawPayload) {
            throw new Error("Unexpected response format.");
        }
        const parsedData = JSON.parse(rawPayload).slice(0, -2);
        const [, decodedUrl] = JSON.parse(parsedData[0][2]);
        return decodedUrl;
    } catch (error) {
        console.log("Could not decode URL.", error);
    }
    return "";
};

const decodeGoogleNewsUrl = async (sourceUrl: string): Promise<string> => {
    try {
        const base64Str = getBase64Str(sourceUrl);
        if (!base64Str) {
            return sourceUrl;
        }

        const { signature, timestamp } = await getDecodingParams(base64Str);
        if (!signature || !timestamp) {
            return sourceUrl;
        }

        const decodedUrl = await decodeUrl(signature, timestamp, base64Str);
        return decodedUrl || sourceUrl;
    } catch (error) {
        console.log("Could not decode Google News URL.", error);
    }
    return sourceUrl;
};

export default decodeGoogleNewsUrl;
