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

    function submitSearch(query) {
        loadingDiv.style.display = 'block';
        answerDiv.style.display = 'none';

        const socket = io('https://api.totob12.com', {
        // const socket = io('http://localhost:3000', {
            transports: ['websocket'],
            withCredentials: true
        });

        socket.on('connect', () => {
            socket.emit('search', query);
        });

        socket.on('searchResult', (data) => {
            if (data.status === 'completed' && !data.error) {
                console.log(data);
                loadingDiv.style.display = 'none';
                answerDiv.style.display = 'block';

                const processedAnswer = processCitations(data.answer, data.urls);
                const parsedHtml = marked.parse(processedAnswer);

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = parsedHtml;

                const firstElement = tempDiv.firstElementChild;
                let insertPosition = 'start';

                if (firstElement && firstElement.tagName === 'H2') {
                    insertPosition = 'afterH2';
                }

                if (data.images && data.images.length > 0) {
                    const imagesToShow = data.images.slice(0, 4);
                    const imageGrid = document.createElement('div');
                    imageGrid.className = 'image-grid';

                    imagesToShow.forEach(imgUrl => {
                        const gridItem = document.createElement('div');
                        gridItem.className = 'image-grid-item';
                        const img = document.createElement('img');
                        // img.src = imgUrl + '?p=300';
                        img.src = imgUrl + '&w=300&h=300';
                        img.alt = 'Related Image';
                        gridItem.appendChild(img);
                        imageGrid.appendChild(gridItem);
                    });

                    if (insertPosition === 'afterH2') {
                        if (firstElement.nextSibling) {
                            tempDiv.insertBefore(imageGrid, firstElement.nextSibling);
                        } else {
                            tempDiv.appendChild(imageGrid);
                        }
                    } else {
                        tempDiv.insertBefore(imageGrid, tempDiv.firstChild);
                    }
                }

                const finalHtml = DOMPurify.sanitize(tempDiv.innerHTML);
                answerDiv.innerHTML = finalHtml;

                socket.disconnect();
            } else if (data.status === 'error' || (data.answer && data.answer.error)) {
                loadingDiv.style.display = 'none';
                answerDiv.style.display = 'block';
                console.log(data);
                answerDiv.innerText = `Error: An error occurred while processing the search query`;
                socket.disconnect();
            }
        });

        socket.on('connect_error', (err) => {
            console.log('Connection error:', err.message);
            loadingDiv.style.display = 'none';
            answerDiv.style.display = 'block';
            answerDiv.innerText = `Error: ${err.message}`;
        });
    }
});
