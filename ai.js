require('dotenv').config();
const GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;

async function searchInternet(query) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.AI_STUDIO_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "Hi.";

        const result = await model.generateContent(prompt);
        return result;
    } catch (error) {
        console.log(error);
        return { error: error };
    }
}

searchInternet('OpenAI').then((result) => {
    console.log(result.response.text());
}).catch((error) => {
    console.error(error);
});