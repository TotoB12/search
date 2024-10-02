document.addEventListener('DOMContentLoaded', function () {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const answerContainer = document.querySelector('.answerContainer');
    const answerDiv = document.getElementById('answer');
    const searchButton = document.getElementById('search-button');
    const lightbox = document.querySelector('.lightbox');
    const lightboxImg = lightbox.querySelector('img');
    const lightboxClose = lightbox.querySelector('.lightbox-close');
    const spinner = lightbox.querySelector('.spinner');

    searchButton.addEventListener('click', function (e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            activateSearchLayout();
            submitSearch(query);
        }
    });
    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                activateSearchLayout();
                submitSearch(query);
            }
        }
    });

    searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            activateSearchLayout();
            submitSearch(query);
        }
    });

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
        return text.replace(/\{\{\{(\d+(?:\s*,\s*\d+)*)\}\}\}/g, (match, p1) => {
            const indices = p1.split(',').map(index => Number(index.trim()));
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

    function activateSearchLayout() {
        document.body.classList.add('search-active');
    }

    function showSkeletonLoader() {
        if (answerDiv.style.display !== 'none') {
            answerDiv.style.opacity = '0';
            answerDiv.style.transform = 'translateY(20px)';
            setTimeout(() => {
                answerDiv.style.display = 'none';
                insertSkeletonLoader();
            }, 300);
        } else {
            insertSkeletonLoader();
        }
    }

    function insertSkeletonLoader() {
        const existingLoader = document.getElementById('skeleton-loader');
        if (existingLoader) {
            existingLoader.remove();
        }

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

        answerContainer.appendChild(skeletonLoader);
    }

    function hideSkeletonLoader() {
        const skeletonLoader = document.getElementById('skeleton-loader');
        if (skeletonLoader) {
            skeletonLoader.style.opacity = '0';
            skeletonLoader.style.transform = 'translateY(20px)';
            setTimeout(() => {
                skeletonLoader.remove();
                answerDiv.style.display = 'block';
                answerDiv.style.opacity = '0';
                answerDiv.style.transform = 'translateY(20px)';
                answerDiv.offsetHeight;
                answerDiv.style.opacity = '1';
                answerDiv.style.transform = 'translateY(0)';
            }, 300);
        } else {
            answerDiv.style.display = 'block';
        }
    }

    function openLightbox(imgSrc) {
        lightboxImg.src = '';
        lightboxImg.style.display = 'none';
        spinner.style.display = 'block';

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';

        const img = new Image();
        img.src = imgSrc;
        img.onload = function () {
            lightboxImg.src = imgSrc;
            spinner.style.display = 'none';
            lightboxImg.style.display = 'block';
        };

        img.onerror = function () {
            spinner.style.display = 'none';
            lightboxImg.alt = 'Failed to load image';
        };
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        lightboxImg.src = '';
        lightboxImg.style.display = 'none';
        spinner.style.display = 'none';
    }

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    function submitSearch(query) {
        answerDiv.innerHTML = '';
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
    
                        const skeletonOverlay = document.createElement('div');
                        skeletonOverlay.className = 'skeleton-element image-skeleton-overlay';
                        gridItem.appendChild(skeletonOverlay);
    
                        const img = document.createElement('img');
                        img.src = imgUrl + '?p=300';
                        img.dataset.fullSrc = imgUrl;
                        img.alt = 'Related Image';
                        img.style.opacity = '0';
    
                        // img.addEventListener('load', () => {
                        //     skeletonOverlay.remove();
                        //     img.style.opacity = '1';
                        // });
                        // img.addEventListener('error', () => {
                        //     skeletonOverlay.remove();
                        //     img.alt = 'Failed to load image';
                        // });
    
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

                const config = {
                    ADD_ATTR: ['target', 'rel']
                };
                const finalHtml = DOMPurify.sanitize(tempDiv.innerHTML, config);
                answerDiv.innerHTML = finalHtml;

                const images = answerDiv.querySelectorAll('.image-grid-item img');

                images.forEach(img => {
                    img.addEventListener('load', () => {
                        img.addEventListener('click', () => openLightbox(img.dataset.fullSrc));
                        const skeletonOverlay = img.parentElement.querySelector('.image-skeleton-overlay');
                        if (skeletonOverlay) {
                            skeletonOverlay.remove();
                        }
                        img.style.opacity = '1';
                    });
                    img.addEventListener('error', () => {
                        img.alt = 'Failed to load image';
                    });
                });

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
