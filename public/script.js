const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const answerContainer = document.querySelector('.answerContainer');
const answerContent = document.querySelector('.answerContent');
const answerDiv = document.getElementById('answer');
const searchButton = document.getElementById('search-button');
const lightbox = document.querySelector('.lightbox');
const lightboxImg = lightbox.querySelector('img');
const lightboxClose = lightbox.querySelector('.lightbox-close');
const spinner = lightbox.querySelector('.spinner');
const lightboxPrev = document.querySelector('.lightbox-prev');
const lightboxNext = document.querySelector('.lightbox-next');
const toolbar = document.querySelector('.toolbar');
const ttsButton = document.getElementById('tts-button');
const ttsIcon = ttsButton.querySelector('.tts-icon');
const ttsSpinner = ttsButton.querySelector('.tts-spinner');
const ttsStop = ttsButton.querySelector('.tts-stop');
const copyButton = document.getElementById('copy-button');
const copyIcon = copyButton.querySelector('.copy-icon');
const checkmarkIcon = copyButton.querySelector('.checkmark-icon');

let imageList = [];
let currentImageIndex = 0;
let audioContext;
let audioSource;
let isPlaying = false;

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function resetSearchLayout() {
    document.body.classList.remove('search-active');
    answerContainer.style.display = 'none';
    answerDiv.innerHTML = '';
    removeExistingWebResults();
    searchInput.value = '';
}

function handleSearchSubmission(query) {
    activateSearchLayout();
    submitSearch(query);
    const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}`;
    history.pushState({ query }, '', newUrl);
}

searchButton.addEventListener('click', function (e) {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
        handleSearchSubmission(query);
    }
});

searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            handleSearchSubmission(query);
        }
    }
});

searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
        handleSearchSubmission(query);
    }
});

const initialQuery = getQueryParam('q');
if (initialQuery) {
    searchInput.value = initialQuery;
    handleSearchSubmission(initialQuery);
}

window.addEventListener('popstate', function (event) {
    const query = getQueryParam('q');
    if (query) {
        searchInput.value = query;
        activateSearchLayout();
        submitSearch(query);
    } else {
        resetSearchLayout();
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
    if (isPlaying) {
        stopTTS();
    }
    if (answerContent.style.display !== 'none') {
        answerContent.style.opacity = '0';
        answerContent.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            answerContent.style.display = 'none';
            answerDiv.innerHTML = '';
            insertSkeletonLoader();
        }, 100);
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
            answerContent.style.display = 'block';
            answerContent.style.opacity = '0';
            answerContent.style.transform = 'translateY(20px)';
            void answerContent.offsetWidth;
            answerContent.style.opacity = '1';
            answerContent.style.transform = 'translateY(0)';
        }, 300);
    } else {
        answerContent.style.display = 'block';
    }
}

function createSourcesGrid(urls) {
    const gridContainer = document.createElement('div');
    gridContainer.className = 'sources-grid';

    urls.forEach(urlObj => {
        const sourceItem = document.createElement('div');
        sourceItem.className = 'source-item';

        const sourceHeader = document.createElement('div');
        sourceHeader.className = 'source-header';

        const faviconImg = document.createElement('img');
        faviconImg.className = 'favicon';
        faviconImg.src = urlObj.favicon;
        faviconImg.alt = 'Favicon';

        const urlText = document.createElement('span');
        urlText.className = 'source-url';
        let urlDisplayText;
        try {
            urlDisplayText = (new URL(urlObj.url)).hostname;
        } catch (e) {
            urlDisplayText = urlObj.url;
        }
        urlText.textContent = urlDisplayText;

        sourceHeader.appendChild(faviconImg);
        sourceHeader.appendChild(urlText);

        const titleLink = document.createElement('a');
        titleLink.href = urlObj.url;
        titleLink.target = '_blank';
        titleLink.rel = 'noopener noreferrer';
        titleLink.className = 'source-title';

        let titleText = urlObj.title || '';
        titleText = titleText.replace(/Search icon.*$/, '').trim();
        titleLink.textContent = titleText || urlObj.url;

        sourceItem.appendChild(sourceHeader);
        sourceItem.appendChild(titleLink);

        gridContainer.appendChild(sourceItem);
    });

    return gridContainer;
}

async function handleTTS() {
    if (isPlaying) {
        stopTTS();
        return;
    }

    const answerElement = document.getElementById('answer');
    const clonedAnswerElement = answerElement.cloneNode(true);
    const supElements = clonedAnswerElement.querySelectorAll('sup');
    supElements.forEach(sup => sup.remove());
    const h2Elements = clonedAnswerElement.querySelectorAll('h2');
    h2Elements.forEach(h2 => h2.remove());
    const answerText = clonedAnswerElement.innerText;
    // console.log('TTS text:', answerText);

    ttsIcon.style.display = 'none';
    ttsSpinner.style.display = 'block';

    try {
        const response = await fetch('https://api.totob12.com/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: answerText }),
        });

        if (!response.ok) throw new Error('TTS request failed');

        const arrayBuffer = await response.arrayBuffer();

        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (audioSource) {
            audioSource.stop();
        }

        audioSource = audioContext.createBufferSource();
        audioSource.buffer = audioBuffer;
        audioSource.connect(audioContext.destination);

        audioSource.onended = stopTTS;

        audioSource.start(0);
        isPlaying = true;

        ttsSpinner.style.display = 'none';
        ttsStop.style.display = 'block';
    } catch (error) {
        console.error('TTS error:', error);
        stopTTS();
    }
}

function stopTTS() {
    if (audioSource) {
        audioSource.stop();
        audioSource = null;
    }
    isPlaying = false;
    ttsSpinner.style.display = 'none';
    ttsStop.style.display = 'none';
    ttsIcon.style.display = 'block';
}

ttsButton.addEventListener('click', handleTTS);
copyButton.addEventListener('click', handleCopy);

function handleCopy() {
    const answerElement = document.getElementById('answer');
    const clonedAnswerElement = answerElement.cloneNode(true);

    const supElements = clonedAnswerElement.querySelectorAll('sup');
    supElements.forEach(sup => sup.remove());

    const answerText = clonedAnswerElement.innerText;

    navigator.clipboard.writeText(answerText).then(() => {
        copyIcon.style.display = 'none';
        checkmarkIcon.style.display = 'block';

        setTimeout(() => {
            checkmarkIcon.style.display = 'none';
            copyIcon.style.display = 'block';
        }, 2000);
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

function openLightbox(imgSrc, index) {
    currentImageIndex = index;
    loadImageInLightbox(imgSrc);
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateLightboxButtons();
}

function loadImageInLightbox(imgSrc) {
    lightboxImg.src = '';
    lightboxImg.style.display = 'none';
    spinner.style.display = 'block';

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

function updateLightboxButtons() {
    if (currentImageIndex <= 0) {
        lightboxPrev.style.display = 'none';
    } else {
        lightboxPrev.style.display = 'flex';
    }

    if (currentImageIndex >= imageList.length - 1) {
        lightboxNext.style.display = 'none';
    } else {
        lightboxNext.style.display = 'flex';
    }
}

function showPreviousImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        const imgSrc = imageList[currentImageIndex];
        loadImageInLightbox(imgSrc);
        updateLightboxButtons();
    }
}

function showNextImage() {
    if (currentImageIndex < imageList.length - 1) {
        currentImageIndex++;
        const imgSrc = imageList[currentImageIndex];
        loadImageInLightbox(imgSrc);
        updateLightboxButtons();
    }
}

lightboxPrev.addEventListener('click', showPreviousImage);
lightboxNext.addEventListener('click', showNextImage);

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
    showSkeletonLoader();

    removeExistingWebResults();

    const socket = io('https://api.totob12.com', {
        transports: ['websocket'],
        withCredentials: true
    });

    socket.on('connect', () => {
        socket.emit('search', query);
    });

    socket.on('generalResults', (data) => {
        console.log('Received general web results:', data);
        displayGeneralWebResults(data.webResults);
    });

    socket.on('aiAnswer', (data) => {
        if (data.status === 'completed' && !data.error) {
            console.log(data);
            hideSkeletonLoader();

            const existingSourcesGrid = document.querySelector('.sources-grid');
            if (existingSourcesGrid) {
                existingSourcesGrid.remove();
            }

            const processedAnswer = processCitations(data.answer, data.urls);
            const parsedHtml = marked.parse(processedAnswer);

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = parsedHtml;

            const firstElement = tempDiv.firstElementChild;
            let insertPosition = 'start';

            if (firstElement && firstElement.tagName === 'H2') {
                insertPosition = 'afterH2';
            }

            const sourcesGrid = createSourcesGrid(data.urls);
            const toolbar = document.querySelector('.toolbar');
            answerContent.insertBefore(sourcesGrid, toolbar);

            if (data.images && data.images.length > 0) {
                const imagesToShow = data.images.slice(0, 4);

                imageList = imagesToShow;

                const imageGrid = document.createElement('div');
                imageGrid.className = 'image-grid';

                imagesToShow.forEach((imgUrl, index) => {
                    const gridItem = document.createElement('div');
                    gridItem.className = 'image-grid-item';

                    const skeletonOverlay = document.createElement('div');
                    skeletonOverlay.className = 'skeleton-element image-skeleton-overlay';
                    gridItem.appendChild(skeletonOverlay);

                    const img = document.createElement('img');
                    img.src = imgUrl + '?p=300';
                    img.dataset.fullSrc = imgUrl;
                    img.dataset.index = index;
                    img.alt = 'Related Image';
                    img.style.opacity = '0';

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
                    img.addEventListener('click', () => openLightbox(img.dataset.fullSrc, parseInt(img.dataset.index)));
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

function displayGeneralWebResults(webResults) {
    const webResultsContainer = document.createElement('div');
    webResultsContainer.className = 'web-results';

    webResults.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = 'web-result-item';

        const titleLink = document.createElement('a');
        titleLink.href = result.url;
        titleLink.target = '_blank';
        titleLink.rel = 'noopener noreferrer';
        titleLink.className = 'web-result-title';
        titleLink.textContent = result.title;

        const urlLink = document.createElement('a');
        urlLink.href = result.url;
        urlLink.target = '_blank';
        urlLink.rel = 'noopener noreferrer';
        urlLink.className = 'web-result-url';
        urlLink.textContent = result.url;

        const description = document.createElement('p');
        description.className = 'web-result-description';
        description.textContent = result.description;

        const faviconImg = document.createElement('img');
        faviconImg.className = 'web-result-favicon';
        faviconImg.src = result.favicon;
        faviconImg.alt = 'Favicon';

        const header = document.createElement('div');
        header.className = 'web-result-header';
        header.appendChild(faviconImg);
        header.appendChild(urlLink);

        resultItem.appendChild(titleLink);
        resultItem.appendChild(header);
        resultItem.appendChild(description);

        webResultsContainer.appendChild(resultItem);
    });

    const answerContainer = document.querySelector('.answerContainer');
    answerContainer.appendChild(webResultsContainer);
}

function removeExistingWebResults() {
    const existingWebResults = document.querySelector('.web-results');
    if (existingWebResults) {
        existingWebResults.remove();
    }
}
