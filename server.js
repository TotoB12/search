const express = require('express');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get("/image/*", async (req, res) => {
    const imageUrl = decodeURIComponent(req.params[0]);
    const { p } = req.query;

    try {
        const imageResponse = await axios.get(imageUrl, {
            responseType: "stream",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
            },
        });

        const contentType = imageResponse.headers["content-type"];
        res.set("Content-Type", contentType);

        if (p) {
            const pixels = parseInt(p, 10);

            const transformer = sharp().resize(pixels, pixels, { fit: 'inside' });

            imageResponse.data.pipe(transformer).pipe(res);
        } else {
            imageResponse.data.pipe(res);
        }

    } catch (error) {
        console.error("Failed to retrieve the image:", error);
        res.status(500).send("Failed to retrieve image");
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
