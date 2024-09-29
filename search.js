const axios = require('axios');
const cheerio = require('cheerio');

async function searchInternet(query) {
    try {
        console.log(`Debug: Searching DuckDuckGo for '${query}'`);

        const headers = {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        };

        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await axios.get(url, { headers });

        if (response.status !== 200) {
            console.log(`Error: HTTP error ${response.status}`);
            return { error: `HTTP error ${response.status}` };
        }

        const $ = cheerio.load(response.data);
        let results = [];
        $('a.result__a').each((i, elem) => {
            const href = $(elem).attr('href');
            if (href) {
                results.push(href);
            }
        });

        results = results.slice(0, 7);
        console.log(`Found ${results.length} results:`, results);

        let outputResults = [];
        let totalContentLength = 0;
        const maxCharacters = 125000;

        for (let resultUrl of results) {
            if (totalContentLength >= maxCharacters) {
                break;
            }

            console.log(`Fetching result page: ${resultUrl}`);
            try {
                const pageResponse = await axios.get(resultUrl, {
                    headers,
                    maxRedirects: 5,
                    validateStatus: function (status) {
                        return status >= 200 && status < 400;
                    },
                });

                const $page = cheerio.load(pageResponse.data);

                $page('script, style').remove();

                const pageText = $page('body').text()
                    .replace(/\s+/g, ' ')
                    .trim();

                let contentToAdd;
                if (totalContentLength + pageText.length > maxCharacters) {
                    contentToAdd = pageText.slice(0, maxCharacters - totalContentLength);
                } else {
                    contentToAdd = pageText;
                }

                totalContentLength += contentToAdd.length;
                outputResults.push({
                    resultUrl: resultUrl,
                    content: contentToAdd,
                });

                if (totalContentLength >= maxCharacters) {
                    break;
                }
            } catch (error) {
                console.log(`Error: Failed to fetch page ${resultUrl}, ${error.message}`);
                continue;
            }
        }

        return outputResults;
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return { error: error.message };
    }
}

searchInternet('OpenAI').then((results) => {
    console.log(JSON.stringify(results, null, 2));
}).catch((error) => {
    console.error(error);
});