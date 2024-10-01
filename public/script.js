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
    const answerContainer = document.querySelector('.answerContainer');
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

    function showSkeletonLoader() {
        // Hide the answerDiv content
        answerDiv.style.display = 'none';

        // Remove any existing skeleton loader
        hideSkeletonLoader();

        const skeletonLoader = document.createElement('div');
        skeletonLoader.id = 'skeleton-loader';
        skeletonLoader.className = 'skeleton-loader';

        const skeletonTitle = document.createElement('div');
        skeletonTitle.className = 'skeleton-title skeleton-element';
        skeletonLoader.appendChild(skeletonTitle);

        const skeletonImageGrid = document.createElement('div');
        skeletonImageGrid.className = 'skeleton-image-grid';

        for (let i = 0; i < 4; i++) {
            const skeletonImage = document.createElement('div');
            skeletonImage.className = 'skeleton-image skeleton-element';
            skeletonImageGrid.appendChild(skeletonImage);
        }

        skeletonLoader.appendChild(skeletonImageGrid);

        for (let i = 0; i < 5; i++) {
            const skeletonText = document.createElement('div');
            skeletonText.className = 'skeleton-text skeleton-element';
            skeletonLoader.appendChild(skeletonText);
        }

        // Append the skeleton loader to the answerContainer
        answerContainer.appendChild(skeletonLoader);
    }

    function hideSkeletonLoader() {
        const skeletonLoader = document.getElementById('skeleton-loader');
        if (skeletonLoader) {
            skeletonLoader.remove();
        }
        // Show the answerDiv
        answerDiv.style.display = 'block';
    }

    function submitSearch(query) {
        answerDiv.innerHTML = ''; // Clear previous answer
        showSkeletonLoader();

        const socket = io('https://api.totob12.com', {
            transports: ['websocket'],
            withCredentials: true
        });

        socket.on('connect', () => {
            socket.emit('search', query);
        });

        socket.on('searchResult', (data) => {
            if (data.status === 'completed' && !data.error) {
                console.log(data);
                hideSkeletonLoader();

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
                        img.src = imgUrl + '?p=300';
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
                hideSkeletonLoader();
                console.log(data);
                answerDiv.innerText = `Error: An error occurred while processing the search query`;
                socket.disconnect();
            }
        });

        socket.on('connect_error', (err) => {
            console.log('Connection error:', err.message);
            hideSkeletonLoader();
            answerDiv.innerText = `Error: ${err.message}`;
        });
    }
});
