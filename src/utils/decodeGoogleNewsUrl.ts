// https://github.com/SSujitX/google-news-url-decoder-nodejs

import axios from 'axios';
import * as cheerio from 'cheerio';

const getBase64Str = (sourceUrl: string): string => {
    try {
        const url = new URL(sourceUrl);
        const pathParts = url.pathname.split('/');
        if (url.hostname === 'news.google.com' && pathParts.length > 1 && ['articles', 'read'].includes(pathParts[pathParts.length - 2])) {
            return pathParts[pathParts.length - 1];
        }
        console.log('Unexpected URL format.');
    } catch (error) {
        console.log('Could not get base 64 from URL.', error);
    }
    return '';
}

const getDecodingParams = async (base64Str: string): Promise<{ signature?: string; timestamp?: string; }> => {
    try {
        const response = await axios.get(`https://news.google.com/articles/${base64Str}`);
        const cheerioApi = cheerio.load(response.data);
        const dataElement = cheerioApi('c-wiz > div[jscontroller]');
        if (!dataElement.length) {
            throw new Error('Failed to fetch data attributes from Google News with the articles URL.');
        }
        return {
            signature: dataElement.attr('data-n-a-sg') || '',
            timestamp: dataElement.attr('data-n-a-ts') || '',
        };
    } catch {
        try {
            const response = await axios.get(`https://news.google.com/rss/articles/${base64Str}`);
            const cheerioApi = cheerio.load(response.data);
            const dataElement = cheerioApi('c-wiz > div[jscontroller]');
            if (!dataElement.length) {
                throw new Error('Failed to fetch data attributes from Google News with the RSS URL.');
            }
            return {
                signature: dataElement.attr('data-n-a-sg') || '',
                timestamp: dataElement.attr('data-n-a-ts') || '',
            };
        } catch (error) {
            console.log('Could not get decoding params from URL.', error);
        }
    }
    return {};
}

const decodeUrl = async (signature: string, timestamp: string, base64Str: string): Promise<string> => {
    try {
        const url = 'https://news.google.com/_/DotsSplashUi/data/batchexecute';
        const payload = [
            "Fbv4je",
            `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0], "${base64Str}",${timestamp},"${signature}"]`
        ];
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        };

        const response = await axios.post(url, `f.req=${encodeURIComponent(JSON.stringify([[payload]]))}`, { headers });
        const parsedData = JSON.parse(response.data.split('\n\n')[1]).slice(0, -2);
        const [, decodedUrl] = JSON.parse(parsedData[0][2]);
        return decodedUrl;
    } catch (error) {
        console.log('Could not decode URL.', error);
    }
    return '';
}

const decodeGoogleNewsUrl = async (sourceUrl: string): Promise<string> => {
    try {
        const base64Str = getBase64Str(sourceUrl);
        if (!base64Str) {
            return sourceUrl;
        }

        const { signature, timestamp } = await getDecodingParams(base64Str!);
        if (!signature && !timestamp) {
            return sourceUrl;
        }

        // await new Promise(resolve => {
        //     setTimeout(resolve, 1000);
        // });

        const decodedUrl = await decodeUrl(signature!, timestamp!, base64Str!);
        return decodedUrl || sourceUrl;;
    } catch (error) {
        console.log('Could not decode Google News URL.', error);
    }
    return sourceUrl;
}

export default decodeGoogleNewsUrl;
