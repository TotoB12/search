document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const loadingDiv = document.getElementById('loading');
    const answerDiv = document.getElementById('answer');

    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            submitSearch(query);
        }
    });

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
                loadingDiv.style.display = 'none';
                answerDiv.style.display = 'block';
                answerDiv.innerText = data.answer;
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
});