const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();
const GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
const { HarmBlockThreshold, HarmCategory } = require("@google/generative-ai");
const pLimit = require('p-limit');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const jobQueue = new Map();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/search', (req, res) => {
    const query = req.body.query;
    if (!query) {
        res.status(400).json({ error: 'No query provided' });
        return;
    }

    const jobId = Date.now().toString();
    jobQueue.set(jobId, { status: 'pending', query });

    processJob(jobId);

    res.json({ jobId });
});

app.get('/api/result/:jobId', (req, res) => {
    const jobId = req.params.jobId;
    const job = jobQueue.get(jobId);

    if (!job) {
        res.status(404).json({ error: 'Job not found' });
    } else {
        res.json(job);
    }
});

const genAI = new GoogleGenerativeAI(process.env.AI_STUDIO_KEY);
const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
        temperature: 0.0
    },
    safetySettings: safetySettings,
    // systemInstruction: ""
});

async function processJob(jobId) {
    const job = jobQueue.get(jobId);

    try {
        const searchResults = await searchInternet(job.query);
        const prompt = `You are a helpful search companion and assistant. Your purpose is to generate relevant and concise summaries to answer/respond the user's query.
The user's query is:

\`\`\`
${job.query}
\`\`\`

Your response should be easy to read and understand, and be presented in a helpful and informative manner. Keep in mind that it should be relatively short. Make sure to provide accurate and relevant information.

You should format it to be aerated and stuctured, and not be an ugly paragraph. You may use Markdown to format your response.
If your response contains a group of words that can be used as a direct answer to the user's query, have those words be contained inside two couple of cury brackets, like this: {{this is part of a sentence that will be highlighted}}.

Nerver appologize for not being able to find an answer. Always answer something.

You have online results to assist you in your response. If you use any of the content from these results, provide a citation to the original source using its index number. You can use the following format to cite a result: {{{number}}}
For example, to cite the first result, use {{{0}}}
To cite the second and fourth results, use {{{1,3}}}

Web results:

\`\`\`
${JSON.stringify(searchResults, null, 2)}
\`\`\`
`;

        const aiResult = await aiResponse(prompt);

        const usedUrls = searchResults.map(result => ({
            index: result.index,
            url: result.resultUrl,
        }));

        jobQueue.set(jobId, { status: 'completed', answer: aiResult, urls: usedUrls });
    } catch (error) {
        console.error(error);
        jobQueue.set(jobId, { status: 'error', error: 'Internal Server Error' });
    }
}

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

        results = results
            .filter(url => !url.startsWith("https://duckduckgo.com"))
            .slice(0, 4);
        console.log(`Found ${results.length} results:`, results);

        const maxCharacters = 2000000;

        const limit = pLimit(4);

        const fetchPagePromises = results.map((resultUrl) => limit(async () => {
            console.log(`Fetching result page: ${resultUrl}`);
            try {
                const pageResponse = await axios.get(resultUrl, {
                    headers,
                    maxRedirects: 2,
                    timeout: 1200,
                    validateStatus: function (status) {
                        return status >= 200 && status < 400;
                    },
                });

                const $page = cheerio.load(pageResponse.data);

                $page('script, style').remove();

                const pageText = $page('body').text()
                    .replace(/\s+/g, ' ')
                    .trim();

                return {
                    resultUrl: resultUrl,
                    content: pageText,
                };
            } catch (error) {
                console.log(`Error: Failed to fetch page ${resultUrl}, ${error.message}`);
                return null;
            }
        }));

        const fetchedResults = await Promise.all(fetchPagePromises);

        let outputResults = [];
        let totalContentLength = 0;
        let currentIndex = 1;

        for (let result of fetchedResults) {
            if (result && totalContentLength < maxCharacters) {
                let contentToAdd;
                if (totalContentLength + result.content.length > maxCharacters) {
                    contentToAdd = result.content.slice(0, maxCharacters - totalContentLength);
                    totalContentLength = maxCharacters;
                } else {
                    contentToAdd = result.content;
                    totalContentLength += contentToAdd.length;
                }

                outputResults.push({
                    index: currentIndex,
                    resultUrl: result.resultUrl,
                    content: contentToAdd,
                });
                currentIndex++;

                if (totalContentLength >= maxCharacters) {
                    break;
                }
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
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.log(error);
        return { error: error };
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
