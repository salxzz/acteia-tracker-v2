// Content Script for Acteia Tracker

let lastSavedTime = 0;
const SAVE_INTERVAL = 10000; // 10 seconds

function init() {
    // 1. Wait for document.body to exist before starting features
    const waitForBody = setInterval(() => {
        if (document.body) {
            clearInterval(waitForBody);
            startFeatureSet();
        }
    }, 50);

    // If body already exists
    if (document.body && !window._acteiaFeaturesStarted) {
        clearInterval(waitForBody);
        startFeatureSet();
    }
}

function startFeatureSet() {
    if (window._acteiaFeaturesStarted) return;
    window._acteiaFeaturesStarted = true;

    let playerSetupDone = false;

    function trySetupVideo() {
        if (playerSetupDone) return;
        const video = document.querySelector('video.jw-video, video');
        // readyState >= 1 means metadata is loaded (has duration), 0 means just exists
        if (video && video.readyState >= 0) {
            playerSetupDone = true;
            clearInterval(fastPoll);
            if (observer) observer.disconnect();
            // Small delay to let the page's own player scripts initialize first
            setTimeout(() => setupTracking(video), 800);
        }
    }

    const fastPoll = setInterval(trySetupVideo, 400);
    
    // MutationObserver to catch dynamically added video elements
    let observer = null;
    if (document.body) {
        observer = new MutationObserver(() => trySetupVideo());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Stop trying after 30 seconds to free resources
    setTimeout(() => {
        clearInterval(fastPoll);
        if (observer) observer.disconnect();
    }, 30000);

    // If on home page, run the history injector
    if (window.location.href.includes('/inicio') || window.location.href.includes('/home') || window.location.pathname === '/') {
        injectHistoryOnInicio();
    }
}


function setupTracking(video) {
    if (!chrome.runtime?.id) return; // Port check
    
    video.addEventListener('timeupdate', () => {
        const currentTime = video.currentTime;
        const duration = video.duration;
        
        if (currentTime - lastSavedTime > SAVE_INTERVAL / 1000 || Math.abs(currentTime - lastSavedTime) > 5) {
            saveProgress(video);
            lastSavedTime = currentTime;
        }
    });

    video.addEventListener('ended', () => {
        saveProgress(video, true);
    });

    video.addEventListener('play', () => {
        saveProgress(video);
    });

    // Check for "Continue watching" possibility
    injectContinueButton(video);

    // Inject Custom UI Overhaul
    if (window.createPlayerUI) {
        window.createPlayerUI(video);
    }
}

function extractMetadata(video) {
    const src = video.currentSrc || video.src || '';
    const pageUrl = window.location.href;
    
    let seriesTitle = 'Unknown';
    let season = null;
    let episode = null;
    let episodeTitle = '';
    
    // 1. Detect Type first
    const isMoviePage = pageUrl.toLowerCase().includes('/filme');
    const isPlayerPage = pageUrl.toLowerCase().includes('/player/');

    // 2. Try to get title from DOM (High search priority)
    const selectors = ['h1', '.series-title', '.title', '.video-title', '.name'];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText && el.innerText.length > 2) {
            let t = el.innerText.trim();
            // Ignore generic titles
            if (t.toLowerCase() === 'player' || t.toLowerCase() === 'filme') continue;
            
            // Clean site tags
            t = t.replace(/\bDublado\b/gi, '')
                 .replace(/\bLegendado\b/gi, '')
                 .replace(/-.*/g, '') // remove trailing dash info often used for "Dublado"
                 .replace(/\s+/g, ' ')
                 .trim();
                 
            seriesTitle = t;
            break;
        }
    }

    // 3. Extract Season/Episode ONLY if not a known movie page
    if (!isMoviePage) {
        // Regex 1: /Sobrenatural_1622/S01/162401_Sobrenatural%20S01E16.mp4
        const urlMatch1 = src.match(/\/([^\/]+)_(\d+)\/S(\d+)\/.*S(\d+)E(\d+)/i);
        const urlMatch2 = src.match(/S(\d+)E(\d+)/i);
        const urlMatch3 = src.match(/\/([^\/]+)\/S(\d+)\//i);

        if (urlMatch1) {
            if (seriesTitle === 'Unknown') seriesTitle = decodeURIComponent(urlMatch1[1]).replace(/_/g, ' ');
            season = parseInt(urlMatch1[3]);
            episode = parseInt(urlMatch1[5]);
        } else if (urlMatch2) {
            season = parseInt(urlMatch2[1]);
            episode = parseInt(urlMatch2[2]);
        }
        
        if (seriesTitle === 'Unknown' && urlMatch3) {
            seriesTitle = decodeURIComponent(urlMatch3[1]).replace(/_/g, ' ');
        }
    }

    // 4. Fallback for title from document.title
    if (seriesTitle === 'Unknown' || seriesTitle === 'Filme' || seriesTitle === 'Player') {
        seriesTitle = document.title.split('-')[0].split('|')[0].trim();
    }

    // 5. Episode Title extraction
    const activeEp = document.querySelector('.active-episode, .selected, .episode-item.active');
    if (activeEp) {
        episodeTitle = activeEp.innerText.split('\n').pop().trim();
    }

    const metadata = {
        seriesTitle: seriesTitle,
        season: season,
        episode: episode,
        episodeTitle: episodeTitle || (episode ? `Episódio ${episode}` : ''),
        url: pageUrl,
        videoSrc: src,
        duration: video.duration || 0,
        type: (season === null && isMoviePage) || (season === null && episode === null) ? 'movie' : 'series'
    };
    
    // Better movie type detection
    if (isMoviePage) metadata.type = 'movie';

    window.currentMetadata = metadata;
    return metadata;
}

function saveProgress(video, forceComplete = false) {
    if (!chrome.runtime?.id) return; // Context guard

    const metadata = extractMetadata(video);
    if (!metadata.seriesTitle || metadata.seriesTitle === 'Unknown') return;

    const progress = video.currentTime;
    const duration = video.duration || 0;

    try {
        chrome.runtime.sendMessage({
            type: 'UPDATE_PROGRESS',
            data: {
                ...metadata,
                progress: progress,
                lastPosition: progress,
                duration: duration,
                forceComplete
            }
        }, (response) => {
            if (chrome.runtime?.lastError) return;
        });
    } catch (e) {
        // Silently handle invalidated context
    }
}

function injectContinueButton(video) {
    if (!chrome.runtime?.id) return; // Context guard
    const metadata = extractMetadata(video);
    chrome.runtime.sendMessage({ type: 'GET_SERIES_DATA' }, (series) => {
        if (chrome.runtime?.lastError || !series) return;
        
        if (series[metadata.seriesTitle]) {
            const sKey = metadata.season !== null ? metadata.season.toString() : 'movie';
            const eKey = metadata.episode !== null ? metadata.episode.toString() : '1';
            
            const seasons = series[metadata.seriesTitle].seasons;
            if (seasons && seasons[sKey]) {
                const ep = seasons[sKey].episodes[eKey];
                if (ep && ep.lastPosition > 15 && ep.lastPosition < video.duration * 0.95) {
                    showInPlayerButton(video, ep.lastPosition);
                }
            }
        }
    });
}

function showInPlayerButton(video, position) {
    if (document.getElementById('acteia-continue-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'acteia-continue-btn';
    btn.innerText = `Continuar de ${formatTime(position)}`;
    btn.style.cssText = `
        position: absolute;
        bottom: 90px;
        left: 20px;
        z-index: 2147483647;
        background: rgba(18, 18, 18, 0.7);
        backdrop-filter: blur(10px);
        color: #dedede;
        border: 1px solid rgba(255,255,255,0.1);
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        font-family: 'Inter', sans-serif;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: 0.2s;
    `;
    
    btn.onmouseover = () => {
        btn.style.background = 'rgba(138, 90, 235, 0.9)';
        btn.style.color = 'white';
        btn.style.borderColor = 'rgba(138, 90, 235, 1)';
        btn.style.transform = 'scale(1.05)';
    };
    btn.onmouseout = () => {
        btn.style.background = 'rgba(18, 18, 18, 0.7)';
        btn.style.color = '#dedede';
        btn.style.borderColor = 'rgba(255,255,255,0.1)';
        btn.style.transform = 'scale(1)';
    };

    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        video.currentTime = position;
        btn.remove();
        if (countdownInterval) clearInterval(countdownInterval);
    };

    const overlay = document.getElementById('acteia-custom-overlay');
    const container = overlay || video.parentElement;
    
    let countdownInterval = null;

    if (container) {
        container.appendChild(btn);
        
        let timeLeft = 30;
        const originalText = `Continuar de ${formatTime(position)}`;
        btn.innerText = `${originalText} (${timeLeft}s)`;

        countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                if (btn && btn.parentNode) {
                    btn.remove();
                }
            } else {
                if (btn && btn.parentNode) {
                    btn.innerText = `${originalText} (${timeLeft}s)`;
                } else {
                    clearInterval(countdownInterval);
                }
            }
        }, 1000);
    }
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}

function injectHistoryOnInicio() {
    console.log('Acteia Tracker: Waiting for page sections to load...');
    let attempts = 0;
    
    const interval = setInterval(() => {
        attempts++;
        if (attempts > 30) {
            clearInterval(interval);
            console.log('Acteia Tracker: Gave up trying to find the source row.');
            return;
        }
        
        // Find a title containing "Acabaram de Chegar" or similar
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, .title, .section-title, span'));
        const arrivedHeading = headings.find(h => 
            h.innerText && 
            (h.innerText.toLowerCase().includes('acabaram de chegar') || h.innerText.toLowerCase().includes('últimos filmes'))
        );
        
        if (arrivedHeading) {
            console.log('Acteia Tracker: Found row title:', arrivedHeading.innerText);
            clearInterval(interval);
            buildHistoryRow(arrivedHeading);
        }
    }, 1000);
}

function buildHistoryRow(referenceHeading) {
    if (document.getElementById('acteia-history-row')) return;

    // Find the closest wrapper for the entire row section
    let sectionWrapper = referenceHeading.parentElement;
    let maxLevels = 5;
    while(sectionWrapper && sectionWrapper.tagName !== 'BODY' && maxLevels > 0) {
        // Look for multiple cards/links
        const links = sectionWrapper.querySelectorAll('a[href*="/serie/"], a[href*="/filme/"], a[href*="/anime/"]');
        if (links.length > 2) {
            console.log('Acteia Tracker: Identified section wrapper', sectionWrapper);
            break;
        }
        sectionWrapper = sectionWrapper.parentElement;
        maxLevels--;
    }

    if (!sectionWrapper || sectionWrapper.tagName === 'BODY' || maxLevels === 0) {
        console.log('Acteia Tracker: Failed to identify the complete section wrapper.');
        return;
    }

    // Clone it
    const clone = sectionWrapper.cloneNode(true);
    clone.id = 'acteia-history-row';
    
    // Change the heading text
    const cloneHeadings = Array.from(clone.querySelectorAll('h1, h2, h3, h4, h5, .title, .section-title, span'));
    const cloneArrivedHeading = cloneHeadings.find(h => 
        h.innerText && 
        (h.innerText.toLowerCase().includes('acabaram de chegar') || h.innerText.toLowerCase().includes('últimos filmes'))
    );
    
    if (cloneArrivedHeading) {
        cloneArrivedHeading.innerHTML = '<span style="color:#8a5aeb;">⏱</span> Histórico';
        cloneArrivedHeading.style.color = 'white';
        cloneArrivedHeading.style.fontWeight = 'bold';
    }

    // Find the swiper wrapper / card container
    const allLinks = Array.from(clone.querySelectorAll('a[href*="/serie/"], a[href*="/filme/"], a[href*="/anime/"]'));
    const sampleCard = allLinks[0];
    
    if (!sampleCard) {
        console.log('Acteia Tracker: No sample card found in cloned row.');
        return;
    }
    
    // Determine the container that holds the direct card items
    // (if sampleCard is nested in a slide div, we need the slide div)
    let cardElement = sampleCard;
    // Walk up to find the immediate child of the scrolling container
    // A heuristic: if it has siblings of the same exact tag/class, it's the item.
    let parent = cardElement.parentElement;
    while (parent && parent.children.length < 3) {
        cardElement = parent;
        parent = cardElement.parentElement;
    }
    
    const track = parent;
    if (!track) return;
    
    console.log('Acteia Tracker: Identified track component. Emptying it for new items.');
    track.innerHTML = ''; // Start fresh
    
    // Populate from storage
    chrome.storage.local.get(['history', 'series'], (result) => {
        const history = result.history || [];
        const series = result.series || {};
        
        if (history.length === 0) {
            // No history to display
            const emptyState = document.createElement('div');
            emptyState.style.padding = '20px';
            emptyState.style.color = '#888';
            emptyState.innerText = 'Seu histórico aparecerá aqui. Comece a assistir algo!';
            track.appendChild(emptyState);
        } else {
            // Deduplicate by series title
            const uniqueHistory = [];
            const seen = new Set();
            for (const item of history) {
                if (!seen.has(item.series)) {
                    seen.add(item.series);
                    uniqueHistory.push(item);
                }
            }

            console.log('Acteia Tracker: Generating history cards for', uniqueHistory.length, 'unique items');

            uniqueHistory.slice(0, 15).forEach(item => {
                const sData = series[item.series];
                if (!sData) return;
                
                const card = cardElement.cloneNode(true);
                const actualLink = card.tagName === 'A' ? card : card.querySelector('a');
                
                // Set the URL link
                if (actualLink) {
                    let lastUrl = '';
                    const sKey = item.season !== null ? item.season.toString() : 'movie';
                    const eKey = item.episode !== null ? item.episode.toString() : '1';
                    
                    if (sData.seasons && sData.seasons[sKey] && sData.seasons[sKey].episodes && sData.seasons[sKey].episodes[eKey]) {
                        lastUrl = sData.seasons[sKey].episodes[eKey].url;
                    } 
                    
                    if (!lastUrl && actualLink.href) {
                        // fallback to a generic construction if we can guess it, otherwise just leave the original link hash removed
                        lastUrl = `javascript:alert('URL não encontrada no histórico para este item.')`;
                    }
                    
                    if (lastUrl) actualLink.href = lastUrl;
                }
                
                // Set Image
                const img = card.querySelector('img');
                if (img) {
                    if (sData.thumbnail) {
                        img.src = sData.thumbnail;
                        img.srcset = ''; 
                    } else {
                        // Keep original if no thumb found, it's better than broken image
                    }
                }
                
                // Titles and text replacements
                const textNodesRegex = /^\s*[A-Za-z0-9]/;
                const innerTextEls = Array.from(card.querySelectorAll('*'))
                    .filter(el => el.children.length === 0 && el.innerText.trim().length > 0);
                
                // Try to find title by longest string without numbers
                let titleCandidates = innerTextEls.filter(el => isNaN(Number(el.innerText)) && el.innerText.length > 3);
                
                // Replace closest matched title with item.series
                if (titleCandidates.length > 0) {
                    // We assume the largest original text might be the title
                    let longest = titleCandidates.reduce((a, b) => a.innerText.length > b.innerText.length ? a : b);
                    longest.innerText = item.series;
                    longest.style.color = '#fff';
                    longest.style.fontWeight = 'bold';
                    longest.title = item.series; // tooltip
                }
                
                // Badges (e.g. Episode Number)
                const badgeLike = card.querySelector('.badge, .ep-count, .new, [class*="absolute"]');
                if (badgeLike) {
                    if (item.type !== 'movie' && item.season && item.episode) {
                        badgeLike.innerText = `S${item.season} E${item.episode}`;
                        badgeLike.style.background = '#8a5aeb';
                        badgeLike.style.color = '#fff';
                        badgeLike.style.display = 'inline-block';
                    } else if (item.type === 'movie') {
                        badgeLike.innerText = 'Filme';
                        badgeLike.style.background = '#8a5aeb';
                        badgeLike.style.color = '#fff';
                        badgeLike.style.display = 'inline-block';
                    } else {
                        badgeLike.style.display = 'none';
                    }
                }
                
                // Add tiny progress bar indicator
                if (item.progress && item.progress > 0) {
                    const progWrap = document.createElement('div');
                    progWrap.style.cssText = 'width: 100%; height: 4px; background: rgba(255,255,255,0.2); position: absolute; bottom: 0; left: 0; z-index: 10; border-radius: 0 0 8px 8px; overflow: hidden;';
                    const progFill = document.createElement('div');
                    progFill.style.cssText = `height: 100%; background: #8a5aeb; width: ${item.progress}%; transition: width 0.3s ease;`;
                    progWrap.appendChild(progFill);
                    
                    const imgContainer = card.querySelector('img') ? card.querySelector('img').parentElement : null;
                    if (imgContainer) {
                        // Ensure relative
                        if (window.getComputedStyle(imgContainer).position === 'static') {
                            imgContainer.style.position = 'relative';
                        }
                        imgContainer.appendChild(progWrap);
                    }
                }
                
                track.appendChild(card);
            });
        }
        
        // Insert right BEFORE the original section wrapper so History comes FIRST
        // Or if the user prefers, AFTER it. The prompt says "coloque a aba de historico, igual as outras abas", so let's put it as the FIRST section below the hero.
        sectionWrapper.parentNode.insertBefore(clone, sectionWrapper);
    });
}

init();
