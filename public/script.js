const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const answerContainer = document.querySelector('.answerContainer');
const answerContent = document.querySelector('.answerContent');
const answerLeft = document.querySelector('.answer-left');
const answerRight = document.querySelector('.answer-right');
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
const suggestionsContainer = document.getElementById('suggestions-container');
const createForm = document.getElementById('create-form');
const createInput = document.getElementById('create-input');
const createButton = document.getElementById('create-button');
const createImage = document.getElementById('create-image');
const createLoading = document.getElementById('create-loading');
const createFeedback = document.getElementById('create-feedback');
const createPlaceholder = document.getElementById('create-placeholder');
const createImageDisplay = document.querySelector('.image-display');

let answerImageList = [];
let imagesTabImageList = [];
let currentImageList = [];
let currentImageIndex = 0;
let audioContext;
let audioSource;
let isPlaying = false;
let currentTab = 'all';
let storedImages = [];
const MAX_ANSWER_HEIGHT = 200;
const API_BASE_URL = 'https://api.totob12.com/search';
// const API_BASE_URL = 'http://localhost:3000/search';
let suggestionTimeout;

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
    removeExpandButton();
}

function removeExpandButton() {
    const existingButton = document.querySelector('.expand-button');
    if (existingButton) {
        existingButton.remove();
    }
    answerContent.style.maxHeight = '';
    answerContent.classList.remove('collapsed');
}

function handleSearchSubmission(query) {
    activateSearchLayout();
    initializeTabs();
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
        searchInput.blur();
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

searchInput.addEventListener('focus', function () {
    const query = searchInput.value.trim();
    fetchSuggestions(query);
});

searchInput.addEventListener('blur', function (event) {
    setTimeout(() => {
        if (!suggestionsContainer.contains(document.activeElement)) {
            clearSuggestions();
        }
    }, 100);
});

searchInput.addEventListener('input', function () {
    const query = searchInput.value.trim();
    if (suggestionTimeout) {
        clearTimeout(suggestionTimeout);
    }
    suggestionTimeout = setTimeout(() => {
        fetchSuggestions(query);
    }, 300);
});

document.addEventListener('click', function (event) {
    if (!searchForm.contains(event.target) && !suggestionsContainer.contains(event.target)) {
        clearSuggestions();
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

createForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const prompt = createInput.value.trim();
    if (prompt) {
        generateCreateImage(prompt);
    }
    if (createFeedback.style.display === 'block') {
        createFeedback.style.display = 'none';
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
    removeExpandButton();
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

    const skeletonLeft = document.createElement('div');
    skeletonLeft.className = 'skeleton-left';

    const skeletonTitle = document.createElement('div');
    skeletonTitle.className = 'skeleton-title skeleton-element';
    skeletonLeft.appendChild(skeletonTitle);

    for (let i = 0; i < 4; i++) {
        const skeletonText = document.createElement('div');
        skeletonText.className = 'skeleton-text skeleton-element';
        skeletonText.style.width = `${Math.floor(Math.random() * 60) + 40}%`;
        skeletonLeft.appendChild(skeletonText);
    }

    const skeletonRight = document.createElement('div');
    skeletonRight.className = 'skeleton-right';

    const skeletonImageGrid = document.createElement('div');
    skeletonImageGrid.className = 'skeleton-image-grid';

    for (let i = 0; i < 4; i++) {
        const skeletonImage = document.createElement('div');
        skeletonImage.className = 'skeleton-image skeleton-element';
        skeletonImageGrid.appendChild(skeletonImage);
    }

    skeletonRight.appendChild(skeletonImageGrid);

    skeletonLoader.appendChild(skeletonLeft);
    skeletonLoader.appendChild(skeletonRight);

    answerContainer.appendChild(skeletonLoader);
}

function hideSkeletonLoader(callback) {
    const skeletonLoader = document.getElementById('skeleton-loader');
    if (skeletonLoader) {
        skeletonLoader.style.opacity = '0';
        skeletonLoader.style.transform = 'translateY(20px)';
        setTimeout(() => {
            skeletonLoader.remove();
            answerContent.style.display = 'flex';
            answerContent.style.opacity = '0';
            answerContent.style.transform = 'translateY(20px)';
            void answerContent.offsetWidth;
            answerContent.style.opacity = '1';
            answerContent.style.transform = 'translateY(0)';
            if (callback) callback();
        }, 300);
    } else {
        answerContent.style.display = 'flex';
        if (callback) callback();
    }
}

function createSourcesList(urls) {
    const listContainer = document.createElement('div');
    listContainer.className = 'sources-grid';

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

        listContainer.appendChild(sourceItem);
    });

    return listContainer;
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

function openLightbox(imgSrc, index, imageList) {
    currentImageList = imageList;
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

    if (currentImageIndex >= currentImageList.length - 1) {
        lightboxNext.style.display = 'none';
    } else {
        lightboxNext.style.display = 'flex';
    }
}

function showPreviousImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        const imgSrc = currentImageList[currentImageIndex];
        loadImageInLightbox(imgSrc);
        updateLightboxButtons();
    }
}

function showNextImage() {
    if (currentImageIndex < currentImageList.length - 1) {
        currentImageIndex++;
        const imgSrc = currentImageList[currentImageIndex];
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

function submitSearch(query) {
    query = btoa(query);
    console.log('Submitting search:', query);
    removeExpandButton();
    showSkeletonLoader();
    removeExistingWebResults();
    removeExistingQuickResults();

    insertWebResultsSkeletonLoader();
    insertQuickResultsSkeletonLoader();

    fetch(`${API_BASE_URL}/generalWebResults?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            console.log('Received general web results:', data);
            removeWebResultsSkeletonLoader();
            if (data.status === 'completed') {
                displayGeneralWebResults(data.webResults);
            }
        })
        .catch(error => {
            console.error('Error fetching general web results:', error);
            removeWebResultsSkeletonLoader();
        });

    fetch(`${API_BASE_URL}/quick?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            console.log('Received quick results:', data);
            removeQuickResultsSkeletonLoader();
            displayQuickResults(data);
        })
        .catch(error => {
            console.error('Error fetching quick results:', error);
            removeQuickResultsSkeletonLoader();
        });

    fetch(`${API_BASE_URL}/images?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            console.log('Received images:', data);
            storedImages = data.images || [];
            displayImages(storedImages);
        })
        .catch(error => {
            console.error('Error fetching images:', error);
        });

    fetch(`${API_BASE_URL}/aiResult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'completed' && !data.error) {
                console.log('Received AI answer:', data);
                hideSkeletonLoader(() => {
                    if (answerContent.scrollHeight > MAX_ANSWER_HEIGHT) {
                        answerContent.classList.add('collapsed');
                        answerContent.style.maxHeight = MAX_ANSWER_HEIGHT + 'px';

                        const expandButton = document.createElement('button');
                        expandButton.className = 'expand-button';
                        expandButton.textContent = 'Show more';

                        answerContent.insertAdjacentElement('afterend', expandButton);

                        expandButton.addEventListener('click', function () {
                            if (answerContent.classList.contains('collapsed')) {
                                answerContent.classList.remove('collapsed');
                                answerContent.style.maxHeight = answerContent.scrollHeight + 10 + 'px';
                                expandButton.textContent = 'Show less';
                                answerContent.addEventListener('transitionend', function handler() {
                                    answerContent.style.maxHeight = 'none';
                                    answerContent.removeEventListener('transitionend', handler);
                                });
                            } else {
                                answerContent.style.maxHeight = answerContent.scrollHeight + 'px';
                                answerContent.offsetHeight;
                                answerContent.classList.add('collapsed');
                                answerContent.style.maxHeight = MAX_ANSWER_HEIGHT + 'px';
                                expandButton.textContent = 'Show more';
                            }
                        });
                    }
                });

                answerDiv.innerHTML = '';
                answerRight.innerHTML = '';

                const processedAnswer = processCitations(data.answer, data.urls);
                const parsedHtml = marked.parse(processedAnswer);

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = parsedHtml;

                const config = {
                    ADD_ATTR: ['target', 'rel']
                };
                const finalHtml = DOMPurify.sanitize(tempDiv.innerHTML, config);
                answerDiv.innerHTML = finalHtml;

                answerLeft.appendChild(toolbar);

                if (data.images && data.images.length > 0) {
                    const imagesToShow = data.images.slice(0, 4);
                    answerImageList = imagesToShow;

                    const imageGrid = document.createElement('div');
                    imageGrid.className = 'image-grid';

                    imagesToShow.forEach((imgUrl, index) => {
                        const gridItem = document.createElement('div');
                        gridItem.className = 'image-grid-item';

                        const skeletonOverlay = document.createElement('div');
                        skeletonOverlay.className = 'image-skeleton-overlay';
                        gridItem.appendChild(skeletonOverlay);

                        const img = document.createElement('img');
                        img.src = imgUrl + '&h=300&w=300';
                        img.dataset.fullSrc = imgUrl;
                        img.dataset.index = index;
                        img.alt = 'Related Image';
                        img.style.opacity = '0';

                        gridItem.appendChild(img);
                        imageGrid.appendChild(gridItem);
                    });

                    answerRight.appendChild(imageGrid);

                    const images = imageGrid.querySelectorAll('.image-grid-item img');

                    images.forEach(img => {
                        img.addEventListener('load', () => {
                            img.addEventListener('click', () => openLightbox(img.dataset.fullSrc, parseInt(img.dataset.index), answerImageList));
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
                }

                const sourcesList = createSourcesList(data.urls);
                answerRight.appendChild(sourcesList);

            } else if (data.status === 'error' || data.error) {
                hideSkeletonLoader();
                console.log(data);
                answerDiv.innerText = `Error: An error occurred while processing the search query`;
            }
        })
        .catch(error => {
            console.error('Error fetching AI result:', error);
            hideSkeletonLoader();
            answerDiv.innerText = `Error: ${error.message}`;
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

    const generalWebResults = document.querySelector('.general-web-results');
    generalWebResults.innerHTML = '';
    generalWebResults.appendChild(webResultsContainer);
}

function removeExistingWebResults() {
    const existingWebResults = document.querySelector('.web-results');
    if (existingWebResults) {
        existingWebResults.remove();
    }
}

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabIndicator = document.querySelector('.tab-indicator');

    function updateTabIndicator(button) {
        tabIndicator.style.width = `${button.offsetWidth}px`;
        tabIndicator.style.left = `${button.offsetLeft}px`;
    }

    tabButtons.forEach(button => {
        if (button.classList.contains('active')) {
            updateTabIndicator(button);
        }

        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            updateTabIndicator(button);
        });
    });
}

function switchTab(tabName) {
    if (currentTab === tabName) return;

    const currentPane = document.querySelector(`#${currentTab}-tab`);
    const newPane = document.querySelector(`#${tabName}-tab`);

    currentPane.classList.remove('active');
    newPane.classList.add('active');

    if (tabName === 'create') {
        createInput.value = searchInput.value.trim();
    }

    currentTab = tabName;
}

function displayImages(images) {
    const imagesGrid = document.querySelector('.images-grid');
    imagesGrid.innerHTML = '';

    const imagePromises = images.map((imageUrl, index) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = imageUrl + '&h=100&w=100';
            img.onload = function () {
                const aspectRatio = img.width / img.height;
                resolve({
                    url: imageUrl,
                    aspectRatio: aspectRatio,
                    index: index
                });
            };
            img.onerror = function () {
                resolve(null);
            };
        });
    });

    Promise.all(imagePromises).then(imageDataArray => {
        const validImages = imageDataArray.filter(data => data !== null);
        layoutImages(validImages);
        imagesTabImageList = validImages.map(data => data.url);
    });
}

function layoutImages(imagesData) {
    const imagesGrid = document.querySelector('.images-grid');
    imagesGrid.innerHTML = '';

    const containerWidth = imagesGrid.clientWidth - 30;
    const gap = 8;
    const rowHeight = 150;

    let rows = [];
    let currentRow = [];
    let currentRowWidth = 0;

    imagesData.forEach(imageData => {
        const scaledWidth = imageData.aspectRatio * rowHeight;
        currentRow.push(imageData);
        currentRowWidth += scaledWidth + gap;

        if (currentRowWidth - gap >= containerWidth) {
            rows.push(currentRow);
            currentRow = [];
            currentRowWidth = 0;
        }
    });

    if (currentRow.length > 0) {
        rows.push(currentRow);
    }

    rows.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'image-row';

        const totalAspectRatio = row.reduce((sum, img) => sum + img.aspectRatio, 0);
        const rowWidth = containerWidth - gap * (row.length - 1);
        const scale = rowWidth / (totalAspectRatio * rowHeight);

        row.forEach((imageData, index) => {
            const imgWidth = imageData.aspectRatio * rowHeight * scale;
            const imgHeight = rowHeight * scale;

            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';
            imageItem.style.flex = `0 0 ${imgWidth}px`;
            imageItem.style.height = `${imgHeight}px`;
            imageItem.style.marginRight = index < row.length - 1 ? `${gap}px` : '0';

            const img = document.createElement('img');
            img.src = imageData.url + '&h=300&w=300';
            img.alt = 'Search result image';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            img.setAttribute('data-fullSrc', imageData.url);
            img.setAttribute('data-index', imageData.index);

            imageItem.appendChild(img);
            rowDiv.appendChild(imageItem);

            imageItem.addEventListener('click', () => {
                openLightbox(imageData.url, imageData.index, imagesTabImageList);
            });
        });

        imagesGrid.appendChild(rowDiv);
    });
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (storedImages.length > 0) {
            displayImages(storedImages);
        }
    }, 200);
});

function initializeLazyLoading() {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });

    document.querySelectorAll('.image-item img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

function fetchSuggestions(query) {
    query = btoa(query);
    fetch(`${API_BASE_URL}/suggestions?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            displaySuggestions(data.suggestions);
        })
        .catch(error => {
            console.error('Error fetching suggestions:', error);
        });
}

function displaySuggestions(suggestions) {
    suggestionsContainer.innerHTML = '';
    suggestions.forEach(suggestion => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        suggestionItem.textContent = suggestion;
        suggestionItem.addEventListener('click', () => {
            searchInput.value = suggestion;
            clearSuggestions();
            handleSearchSubmission(suggestion);
        });
        suggestionsContainer.appendChild(suggestionItem);
    });
    if (suggestions.length > 0) {
        suggestionsContainer.style.display = 'block';
    } else {
        suggestionsContainer.style.display = 'none';
    }
}

function clearSuggestions() {
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.style.display = 'none';
}

function generateCreateImage(prompt) {
    createLoading.style.display = 'flex';
    createFeedback.style.display = 'none';
    createImage.style.display = 'none';
    createPlaceholder.style.display = 'none';

    const encodedPrompt = btoa(prompt);

    fetch(`${API_BASE_URL}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: encodedPrompt })
    })
        .then(response => response.json())
        .then(data => {
            createLoading.style.display = 'none';

            if (data.status === 'completed' && data.imageUrl) {
                createImage.src = data.imageUrl;
                createImage.style.display = 'block';
                createPlaceholder.style.display = 'none';

                createFeedback.textContent = 'Image generated successfully!';
                createFeedback.className = 'feedback-message success';
                createFeedback.style.display = 'block';
            } else {
                createFeedback.textContent = data.error || 'Failed to generate image.';
                createFeedback.className = 'feedback-message error';
                createFeedback.style.display = 'block';
                createPlaceholder.style.display = 'block';
            }
        })
        .catch(error => {
            createLoading.style.display = 'none';
            createFeedback.textContent = 'An error occurred while generating the image.';
            createFeedback.className = 'feedback-message error';
            createFeedback.style.display = 'block';
            createPlaceholder.style.display = 'block';
            console.error('Error generating image:', error);
        });
}

function displayQuickResults(data) {
    const quickResults = document.querySelector('.quick-results');
    quickResults.innerHTML = '';

    const queryResult = data.queryresult;
    if (!queryResult || !queryResult.pods || !queryResult.pods.length) {
        return;
    }

    queryResult.pods.forEach(pod => {
        const podTitle = pod.title;
        const podDiv = document.createElement('div');
        podDiv.className = 'quick-pod';

        if (podTitle) {
            const titleElement = document.createElement('h3');
            titleElement.className = 'quick-pod-title';
            titleElement.textContent = podTitle;
            podDiv.appendChild(titleElement);
        }

        if (pod.subpods && pod.subpods.length) {
            pod.subpods.forEach(subpod => {
                if (subpod.title) {
                    const subpodTitleElement = document.createElement('h4');
                    subpodTitleElement.className = 'quick-subpod-title';
                    subpodTitleElement.textContent = subpod.title;
                    podDiv.appendChild(subpodTitleElement);
                }

                const img = subpod.img;
                if (img && img.src) {
                    const imgElement = document.createElement('img');
                    imgElement.src = img.src;
                    imgElement.alt = img.alt || '';
                    imgElement.title = img.title || '';
                    imgElement.className = 'quick-pod-image';
                    podDiv.appendChild(imgElement);
                }
            });
        }

        quickResults.appendChild(podDiv);
    });
}

function insertWebResultsSkeletonLoader() {
    const generalWebResults = document.querySelector('.general-web-results');
    generalWebResults.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const skeletonItem = document.createElement('div');
        skeletonItem.className = 'web-result-item skeleton-web-result-item';

        const titleSkeleton = document.createElement('div');
        titleSkeleton.className = 'skeleton-element skeleton-title';
        titleSkeleton.style.width = `${Math.floor(Math.random() * 31) + 55}%`;
        skeletonItem.appendChild(titleSkeleton);

        const headerSkeleton = document.createElement('div');
        headerSkeleton.className = 'web-result-header';

        const faviconSkeleton = document.createElement('div');
        faviconSkeleton.className = 'skeleton-element skeleton-favicon';
        headerSkeleton.appendChild(faviconSkeleton);

        const urlSkeleton = document.createElement('div');
        urlSkeleton.className = 'skeleton-element skeleton-url';
        urlSkeleton.style.width = `${Math.floor(Math.random() * 21) + 30}%`;
        headerSkeleton.appendChild(urlSkeleton);

        skeletonItem.appendChild(headerSkeleton);

        for (let j = 0; j < 2; j++) {
            const descriptionSkeleton = document.createElement('div');
            descriptionSkeleton.className = 'skeleton-element skeleton-description';
            if (j === 1) {
                descriptionSkeleton.style.width = `${Math.floor(Math.random() * 51) + 25}%`;
            }
            skeletonItem.appendChild(descriptionSkeleton);
        }

        generalWebResults.appendChild(skeletonItem);
    }
}

function removeWebResultsSkeletonLoader() {
    const generalWebResults = document.querySelector('.general-web-results');
    const skeletonItems = generalWebResults.querySelectorAll('.skeleton-web-result-item');
    skeletonItems.forEach(item => item.remove());
}

function insertQuickResultsSkeletonLoader() {
    const quickResults = document.querySelector('.quick-results');
    quickResults.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const skeletonPod = document.createElement('div');
        skeletonPod.className = 'quick-pod skeleton-quick-pod';

        const titleSkeleton = document.createElement('div');
        titleSkeleton.className = 'skeleton-element skeleton-quick-title';
        titleSkeleton.style.width = `${Math.floor(Math.random() * 51) + 30}%`;
        skeletonPod.appendChild(titleSkeleton);

        const imageSkeleton = document.createElement('div');
        imageSkeleton.className = 'skeleton-element skeleton-quick-image';
        imageSkeleton.style.width = `${Math.floor(Math.random() * 51) + 50}%`;
        imageSkeleton.style.height = `${Math.floor(Math.random() * 81) + 70}px`;
        skeletonPod.appendChild(imageSkeleton);

        quickResults.appendChild(skeletonPod);
    }
}

function removeQuickResultsSkeletonLoader() {
    const quickResults = document.querySelector('.quick-results');
    const skeletonPods = quickResults.querySelectorAll('.skeleton-quick-pod');
    skeletonPods.forEach(pod => pod.remove());
}

function removeExistingQuickResults() {
    const quickResults = document.querySelector('.quick-results');
    quickResults.innerHTML = '';
}

