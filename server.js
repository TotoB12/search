const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();
const GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.static('public'));

app.get('/api/ask', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            res.status(400).json({ error: 'No query provided' });
            return;
        }

        const searchResults = await searchInternet(query);

        const prompt = `You are a helpful search companion and assistant. Your purpose is to generate relevant and concise summaries of the user's query.
The user's query is:

\`\`\`
${query}
\`\`\`

You have the following online results to assist you in your answer.
If you use any of the content from these results, please provide a citation to the original source using its index number. You can use the following format to cite a result: {{{number}}}. For example, to cite the first result, use {{{0}}}.

Web results:

\`\`\`
${JSON.stringify(searchResults, null, 2)}
\`\`\`
`;

        const aiResult = await aiResponse(prompt);

        res.status(200).json({ answer: aiResult });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

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
        let index = 0;

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
                    index: index,
                    resultUrl: resultUrl,
                    content: contentToAdd,
                });
                index++;

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

async function aiResponse(prompt) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.AI_STUDIO_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0
            },
            systemInstruction: ""
        });

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.log(error);
        return { error: error };
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running`);
});
