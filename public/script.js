document.addEventListener('DOMContentLoaded', function () {
    const highlightExtension = {
        name: 'highlight',
        level: 'inline',
        start(src) { return src.indexOf('{{'); },
        tokenizer(src, tokens) {
            const rule = /^{{(?!{)([\s\S]+?[^}])}}(?!})/;
            const match = rule.exec(src);
            if (match) {
                return {
                    type: 'highlight',
                    raw: match[0],
                    text: match[1],
                };
            }
        },
        renderer(token) {
            return '<span class="highlight">' + token.text + '</span>';
        }
    };

    marked.use({ extensions: [highlightExtension] });

    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const loadingDiv = document.getElementById('loading');
    const answerDiv = document.getElementById('answer');

    searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            activateSearchLayout();
            submitSearch(query);
        }
    });

    function activateSearchLayout() {
        document.body.classList.add('search-active');
    }

    async function submitSearch(query) {
        loadingDiv.style.display = 'block';
        answerDiv.style.display = 'none';

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            pollForResult(data.jobId);
        } catch (error) {
            loadingDiv.style.display = 'none';
            answerDiv.style.display = 'block';
            answerDiv.innerText = `Error: ${error.message}`;
        }
    }

    async function pollForResult(jobId) {
        try {
            const response = await fetch(`/api/result/${jobId}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            if (data.status === 'completed') {
                console.log(data);
                loadingDiv.style.display = 'none';
                answerDiv.style.display = 'block';
                const processedAnswer = processCitations(data.answer, data.urls);
                answerDiv.innerHTML = DOMPurify.sanitize(marked.parse(processedAnswer));
            } else if (data.status === 'error') {
                loadingDiv.style.display = 'none';
                answerDiv.style.display = 'block';
                answerDiv.innerText = `Error: ${data.error}`;
            } else {
                setTimeout(() => pollForResult(jobId), 100);
            }
        } catch (error) {
            loadingDiv.style.display = 'none';
            answerDiv.style.display = 'block';
            answerDiv.innerText = `Error: ${error.message}`;
        }
    }

    function processCitations(text, urls) {
        return text.replace(/\{\{\{(\d+(?:,\d+)*)\}\}\}/g, (match, p1) => {
            const indices = p1.split(',').map(Number);
            const links = indices.map(index => {
                const url = urls.find(u => u.index === index);
                if (url) {
                    return `<a href="${url.url}" target="_blank" rel="noopener noreferrer">${index + 1}</a>`;
                }
                return index + 1;
            });
            return `<sup>[${links.join(',')}]</sup>`;
        });
    }
});