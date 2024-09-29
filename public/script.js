document.addEventListener('DOMContentLoaded', function() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const query = urlParams.get('q');

    if (!query) {
        document.getElementById('loading').innerText = 'No query provided.';
        return;
    }

    fetch(`/api/ask?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('answer').style.display = 'block';
                document.getElementById('answer').innerText = `Error: ${data.error}`;
            } else {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('answer').style.display = 'block';
                document.getElementById('answer').innerText = data.answer;
            }
        })
        .catch(error => {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('answer').style.display = 'block';
            document.getElementById('answer').innerText = `Error: ${error}`;
        });
});
