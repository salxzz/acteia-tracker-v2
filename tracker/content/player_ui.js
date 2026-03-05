// Custom Player UI Implementation for Acteia Tracker

function createPlayerUI(video) {
    if (document.getElementById('acteia-custom-overlay')) return;

    const pageUrl = window.location.href;
    const isMoviePage = pageUrl.toLowerCase().includes('/filme');

    if (!isMoviePage) {
        document.body.classList.add('notMovie');
    } else {
        document.body.classList.add('Movie');
        if (document.body.classList.contains("notMovie")) {
            document.body.classList.remove('notMovie');
        }
    }

    const overlay = document.createElement('div');
    overlay.id = 'acteia-custom-overlay';
    
    // Safety check: Don't activate UI overhaul on home page even if a video is found (previews)
    const isHomePage = window.location.pathname === '/' || 
                       window.location.href.includes('/inicio') || 
                       window.location.href.includes('/home');
    
    if (isHomePage) {
        console.log('Acteia Tracker: Skipping UI overhaul on home page.');
        return;
    }

    // Add class to body to enable player-specific global CSS (like hiding site header)
    document.body.classList.add('acteia-custom-player-active');
    
    // Structure
    const isMovie = window.currentMetadata && window.currentMetadata.type === 'movie';
    
    const ICONS = {
        play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
        pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
        skipBack: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-1.1 11h-.85v-3.26l-1.01.31v-.69l1.77-.63h.09V16zm4.28-1.76c0 .32-.03.6-.1.82s-.17.42-.29.57-.28.26-.45.33-.37.1-.59.1-.41-.03-.59-.1-.33-.18-.46-.33-.23-.35-.3-.57-.11-.5-.11-.82v-.74c0-.32.03-.6.1-.82s.17-.42.29-.57.28-.26.45-.33.37-.1.59-.1.41.03.59.1.33.18.46.33.23.35.3.57.11.5.11.82v.74zm-.85-.86c0-.19-.01-.35-.04-.48s-.07-.23-.12-.31-.11-.14-.19-.17-.16-.05-.25-.05-.18.02-.25.05-.12.09-.18.17-.09.18-.12.31-.04.29-.04.48v.97c0 .19.01.35.04.48s.07.24.12.32.11.14.19.17.16.05.25.05.18-.02.25-.05.12-.09.18-.17.09-.18.12-.32.04-.29.04-.48v-.97z"/></svg>`,
        skipForward: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2zm-5.46 3h-.85v-3.26l-1.01.31v-.69l1.77-.63h.09V16zm4.28-1.76c0 .32-.03.6-.1.82s-.17.42-.29.57-.28.26-.45.33-.37.1-.59.1-.41-.03-.59-.1-.33-.18-.46-.33-.23-.35-.3-.57-.11-.5-.11-.82v-.74c0-.32.03-.6.1-.82s.17-.42.29-.57.28-.26.45-.33.37-.1.59-.1.41.03.59.1.33.18.46.33.23.35.3.57.11.5.11.82v.74zm-.85-.86c0-.19-.01-.35-.04-.48s-.07-.23-.12-.31-.11-.14-.19-.17-.16-.05-.25-.05-.18.02-.25.05-.12.09-.18.17-.09.18-.12.31-.04.29-.04.48v.97c0 .19.01.35.04.48s.07.24.12.32.11.14.19.17.16.05.25.05.18-.02.25-.05.12-.09.18-.17.09-.18.12-.32.04-.29.04-.48v-.97z"/></svg>`,
        volumeHigh: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
        volumeMute: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.09V4z"/></svg>`,
        fullscreen: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
        history: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>`,
        exitFullscreen: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`,
        prevEp: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`,
        nextEp: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`,
        back: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`
    };

    window.ACTEIA_ICONS = ICONS; // Expose for reuse

    // Build title for top bar
    const meta = window.currentMetadata || {};
    let topTitle = '';
    if (meta.seriesTitle && meta.seriesTitle !== 'Unknown') {
        if (meta.type === 'movie') {
            topTitle = meta.seriesTitle;
        } else if (meta.season && meta.episode) {
            const epLabel = meta.episodeTitle ? `: ${meta.episodeTitle}` : '';
            topTitle = `${meta.seriesTitle} — T${String(meta.season).padStart(2,'0')} Ep${String(meta.episode).padStart(2,'0')}${epLabel}`;
        } else {
            topTitle = meta.seriesTitle;
        }
    }

    overlay.innerHTML = `
        <div class="acteia-top-bar">
            <button class="acteia-btn-back" id="acteia-back-to-inicio">
                <div class="acteia-icon-wrapper">${ICONS.back}</div> Inicio
            </button>
            <div class="acteia-top-title" id="acteia-top-title">${topTitle}</div>
            <div class="acteia-top-spacer">
                <button class="acteia-btn-history" id="acteia-toggle-history-list" title="Histórico">
                    <div class="acteia-icon-wrapper">${ICONS.history}</div>
                </button>
            </div>
        </div>
        
        <div class="acteia-center-controls">
            <button class="acteia-center-btn skip-back" id="acteia-skip-back" title="Voltar 10s">${ICONS.skipBack}</button>
            <button class="acteia-center-btn play-pause" id="acteia-play-pause-btn">${video.paused ? ICONS.play : ICONS.pause}</button>
            <button class="acteia-center-btn skip-forward" id="acteia-skip-forward" title="Avançar 10s">${ICONS.skipForward}</button>
        </div>
        
        <div class="acteia-bottom-bar">
            <div class="acteia-timeline-wrapper" id="acteia-timeline-wrapper">
                <div class="acteia-timeline-tooltip" id="acteia-timeline-tooltip">00:00</div>
                <div class="acteia-progress-bar" id="acteia-main-progress">
                    <div class="acteia-progress-fill" id="acteia-progress-fill">
                        <div class="acteia-progress-knob"></div>
                    </div>
                </div>
            </div>
            
            <div class="acteia-controls-row">
                <div class="acteia-left-tools">
                    ${isMovie ? '' : `
                    <button class="acteia-tool-btn" id="acteia-prev-ep" title="Episódio Anterior">${ICONS.prevEp}</button>
                    <button class="acteia-tool-btn" id="acteia-next-ep" title="Próximo Episódio">${ICONS.nextEp}</button>
                    `}
                    <div class="acteia-volume-container">
                        <button class="acteia-tool-btn" id="acteia-vol-btn" title="Volume">${video.muted || video.volume === 0 ? ICONS.volumeMute : ICONS.volumeHigh}</button>
                        <input type="range" class="acteia-volume-slider" id="acteia-vol-slider" min="0" max="1" step="0.05" value="${video.volume}">
                    </div>
                    <button class="acteia-tool-btn" id="acteia-speed-btn" style="font-size: 15px; font-weight: bold; width: 44px;">1.0x</button>
                </div>
                
                <div class="acteia-episode-selector" ${isMovie ? 'style="visibility:hidden"' : ''}>
                    <button class="acteia-episode-list-btn" id="acteia-toggle-ep-list">Lista de Episódios</button>
                </div>
                
                <div class="acteia-right-tools">
                    <div style="color: rgba(255,255,255,0.8); font-size: 14px; margin-right: 10px; font-family: 'Inter', sans-serif;" id="acteia-time-display">
                        00:00 / 00:00
                    </div>
                    <button class="acteia-tool-btn" id="acteia-fullscreen-btn" title="Tela Cheia">${document.fullscreenElement ? ICONS.exitFullscreen : ICONS.fullscreen}</button>
                </div>
            </div>
        </div>

        <div id="acteia-ep-queue" class="acteia-ep-queue">
            <div class="acteia-ep-queue-header">Lista de Episódios</div>
            <div id="acteia-ep-items-container"></div>
        </div>

        <div id="acteia-history-queue" class="acteia-ep-queue" style="bottom: auto; top: 70px; right: 20px; left: auto; transform: none; width: 420px; max-height: 80vh;">
            <div class="acteia-ep-queue-header">Seu Histórico</div>
            <div id="acteia-history-items-container"></div>
        </div>
        
        <div id="acteia-skip-indicator-left" class="acteia-skip-indicator left">
            ${ICONS.skipBack} -10s
        </div>
        <div id="acteia-skip-indicator-right" class="acteia-skip-indicator right">
            +10s ${ICONS.skipForward}
        </div>
    `;

    const container = video.closest('.jwplayer') || video.parentElement;
    if (container) {
        container.style.position = 'relative';
        container.appendChild(overlay);
        setupUIEvents(video, container);
    }
}

function setupUIEvents(video, container) {
    const playPauseBtn = document.getElementById('acteia-play-pause-btn');
    const skipBack = document.getElementById('acteia-skip-back');
    const skipForward = document.getElementById('acteia-skip-forward');
    const progressBar = document.getElementById('acteia-main-progress');
    const progressFill = document.getElementById('acteia-progress-fill');
    const timeDisplay = document.getElementById('acteia-time-display');
    const backBtn = document.getElementById('acteia-back-to-inicio');
    const speedBtn = document.getElementById('acteia-speed-btn');
    const epListBtn = document.getElementById('acteia-toggle-ep-list');
    const epHistoryBtn = document.getElementById('acteia-toggle-history-list');
    const epQueue = document.getElementById('acteia-ep-queue');
    const historyQueue = document.getElementById('acteia-history-queue');
    const overlay = document.getElementById('acteia-custom-overlay');
    const timelineWrapper = document.getElementById('acteia-timeline-wrapper');
    const timelineTooltip = document.getElementById('acteia-timeline-tooltip');

    // Timeline Tooltip Logic
    timelineWrapper.onmousemove = (e) => {
        const rect = progressBar.getBoundingClientRect();
        let pos = (e.clientX - rect.left) / rect.width;
        pos = Math.max(0, Math.min(1, pos));
        
        const time = pos * video.duration;
        timelineTooltip.innerText = formatTime(time);
        
        // Position tooltip
        const tooltipWidth = timelineTooltip.offsetWidth;
        let leftPos = e.clientX - rect.left;
        
        // Keep inside bounds
        leftPos = Math.max(tooltipWidth / 2, Math.min(rect.width - tooltipWidth / 2, leftPos));
        
        timelineTooltip.style.left = leftPos + 'px';
        timelineTooltip.style.opacity = '1';
    };

    timelineWrapper.onmouseleave = () => {
        timelineTooltip.style.opacity = '0';
    };

    // Play/Pause
    playPauseBtn.onclick = () => {
        if (video.paused) video.play();
        else video.pause();
    };

    video.addEventListener('play', () => playPauseBtn.innerHTML = window.ACTEIA_ICONS.pause);
    video.addEventListener('pause', () => playPauseBtn.innerHTML = window.ACTEIA_ICONS.play);

    // Skip Animation Helper
    const indLeft = document.getElementById('acteia-skip-indicator-left');
    const indRight = document.getElementById('acteia-skip-indicator-right');
    let skipLeftTimeout;
    let skipRightTimeout;
    let skipLeftAccumulator = 0;
    let skipRightAccumulator = 0;

    const triggerSkipAnim = (element, contentHTML) => {
        element.innerHTML = contentHTML;
        element.classList.remove('acteia-skip-animating');
        void element.offsetWidth; // trigger reflow to reset
        element.classList.add('acteia-skip-animating');
    };

    // Seek
    const doSkipBack = () => {
        video.currentTime = Math.max(0, video.currentTime - 10);
        skipLeftAccumulator += 10;
        triggerSkipAnim(indLeft, `${window.ACTEIA_ICONS.skipBack} -${skipLeftAccumulator}s`);
        
        clearTimeout(skipLeftTimeout);
        skipLeftTimeout = setTimeout(() => { skipLeftAccumulator = 0; }, 800);
    };
    const doSkipForward = () => {
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        skipRightAccumulator += 10;
        triggerSkipAnim(indRight, `+${skipRightAccumulator}s ${window.ACTEIA_ICONS.skipForward}`);
        
        clearTimeout(skipRightTimeout);
        skipRightTimeout = setTimeout(() => { skipRightAccumulator = 0; }, 800);
    };

    skipBack.onclick = doSkipBack;
    skipForward.onclick = doSkipForward;

    // Timeline Drag / Slider Logic
    let isDragging = false;

    const updateTimelineFromEvent = (e) => {
        const rect = progressBar.getBoundingClientRect();
        // Calculate position relative to the progress bar (0 to 1)
        let pos = (e.clientX - rect.left) / rect.width;
        pos = Math.max(0, Math.min(1, pos)); // Clamp between 0 and 1
        
        // Update visual fill instantly for smooth dragging
        progressFill.style.width = (pos * 100) + '%';
        timeDisplay.innerText = `${formatTime(pos * video.duration)} / ${formatTime(video.duration)}`;
        
        return pos;
    };

    progressBar.parentElement.addEventListener('mousedown', (e) => {
        isDragging = true;
        video.pause(); // Pause while dragging for smoother experience
        updateTimelineFromEvent(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            updateTimelineFromEvent(e);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isDragging) {
            isDragging = false;
            const pos = updateTimelineFromEvent(e);
            video.currentTime = pos * video.duration;
            video.play(); // Resume playback after dropping
        }
    });

    // Update from video playback only if not being dragged
    video.addEventListener('timeupdate', () => {
        if (!isDragging) {
            const percent = (video.currentTime / video.duration) * 100;
            progressFill.style.width = percent + '%';
            timeDisplay.innerText = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
        }
    });

    // Return to Inicio
    backBtn.onclick = () => window.location.href = 'https://acteia.ca/inicio';

    // Speed
    const speeds = [1.0, 1.25, 1.5, 2.0, 0.5];
    let speedIdx = 0;
    speedBtn.onclick = () => {
        speedIdx = (speedIdx + 1) % speeds.length;
        video.playbackRate = speeds[speedIdx];
        speedBtn.innerText = speeds[speedIdx] + 'x';
    };

    // Fullscreen Attempt (on interaction)
    video.addEventListener('playing', () => {
        if (!document.fullscreenElement) {
            // container.requestFullscreen().catch(err => console.log('Fullscreen rejected', err));
        }
    }, { once: true });

    // Volume Slider
    const volBtn = document.getElementById('acteia-vol-btn');
    const volSlider = document.getElementById('acteia-vol-slider');
    
    volBtn.onclick = () => {
        video.muted = !video.muted;
        volBtn.innerHTML = video.muted ? window.ACTEIA_ICONS.volumeMute : window.ACTEIA_ICONS.volumeHigh;
    };

    volSlider.oninput = (e) => {
        video.volume = e.target.value;
        video.muted = false;
        volBtn.innerHTML = video.volume === 0 ? window.ACTEIA_ICONS.volumeMute : window.ACTEIA_ICONS.volumeHigh;
    };

    // Fullscreen Button
    const fsBtn = document.getElementById('acteia-fullscreen-btn');
    const toggleFullscreen = () => {
        try {
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        } catch(e) {
            // Silently handle any errors
        }
    };
    fsBtn.onclick = toggleFullscreen;
    
    document.addEventListener('fullscreenchange', () => {
        fsBtn.innerHTML = document.fullscreenElement ? window.ACTEIA_ICONS.exitFullscreen : window.ACTEIA_ICONS.fullscreen;
    });

    // Idle Tracker for Custom UI and Mouse Cursor
    let idleTimeout;
    const resetIdleTimer = () => {
        overlay.classList.add('active');
        container.classList.remove('acteia-idle');
        clearTimeout(idleTimeout);
        idleTimeout = setTimeout(() => {
            if (!video.paused) {
                overlay.classList.remove('active');
                container.classList.add('acteia-idle');
            }
        }, 3000); // 3 seconds idle timeout
    };

    container.addEventListener('mousemove', resetIdleTimer);
    container.addEventListener('click', resetIdleTimer);
    // Also track key presses to show UI
    window.addEventListener('keydown', resetIdleTimer);
    container.addEventListener('touchstart', resetIdleTimer);
    video.addEventListener('play', resetIdleTimer);
    video.addEventListener('pause', () => overlay.classList.add('active'));

    // Keyboard Shortcuts
    const handleKeydown = (e) => {
        // Only trigger if not typing in an input
        const tag = e.target.tagName ? e.target.tagName.toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (e.repeat) return;
            toggleFullscreen();
        } else if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (e.repeat) return;
            
            if (video.paused) {
                video.play();
            } else {
                video.pause();
            }
            
            resetIdleTimer();
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (e.repeat) return;
            doSkipBack();
            resetIdleTimer();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            if (e.repeat) return;
            doSkipForward();
            resetIdleTimer();
        }
    };

    const blockKeyEvents = (e) => {
        const tag = e.target.tagName ? e.target.tagName.toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyF' || e.key === 'f' || e.key === 'F' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    };
    
    // Add useCapture = true to catch the event BEFORE JWPlayer does
    window.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('keyup', blockKeyEvents, true);
    window.addEventListener('keypress', blockKeyEvents, true);

    // Prev/Next Episode
    const prevBtn = document.getElementById('acteia-prev-ep');
    const nextBtn = document.getElementById('acteia-next-ep');
    
    if (prevBtn) {
        prevBtn.onclick = () => {
            const sitePrev = document.querySelector('.nav-button.previous');
            if (sitePrev) sitePrev.click();
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            const siteNext = document.querySelector('.nav-button.next');
            if (siteNext) siteNext.click();
        };
    }

    // Episode List logic
    if (epListBtn) {
        epListBtn.onclick = (e) => {
            e.stopPropagation();
            const isVisible = epQueue.style.display === 'block';
            historyQueue.style.display = 'none'; // hide history
            epQueue.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) populateEpisodeQueue();
        };
    }

    // History List logic
    if (epHistoryBtn) {
        epHistoryBtn.onclick = (e) => {
            e.stopPropagation();
            const isVisible = historyQueue.style.display === 'block';
            epQueue.style.display = 'none'; // hide ep list
            historyQueue.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) populateHistoryQueue();
        };
    }

    document.addEventListener('click', () => {
        epQueue.style.display = 'none';
        historyQueue.style.display = 'none';
    });
}

function populateEpisodeQueue() {
    const container = document.getElementById('acteia-ep-items-container');
    container.innerHTML = '';
    
    // Extract episodes from Acteia's sidebar
    const items = document.querySelectorAll('.episode-item');
    
    const renderItems = (seriesData) => {
        const currentSeasonKey = (window.currentMetadata && window.currentMetadata.season !== null) 
            ? window.currentMetadata.season.toString() 
            : '1';

        const enforceHttps = (url) => url ? url.replace(/^http:\/\//i, 'https://') : url;
            
        items.forEach(item => {
            const clone = item.cloneNode(true);
            clone.style.margin = '5px';
            clone.style.display = 'grid';
            
            if (seriesData && seriesData.seasons && seriesData.seasons[currentSeasonKey]) {
                const text = clone.innerText || clone.textContent;
                const match = text.match(/Epis[óo]dio\s*(\d+)/i);
                
                if (match) {
                    const epKey = match[1];
                    const epData = seriesData.seasons[currentSeasonKey].episodes[epKey];
                    // If marked completed or user watched more than 90%
                    if (epData && (epData.completed || (epData.lastPosition && epData.duration && epData.lastPosition > epData.duration * 0.9))) {
                        clone.classList.add('acteia-ep-watched');
                    }
                }
            }
            // Fix mixed content: enforce HTTPS on all images in the cloned episode item
            clone.querySelectorAll('img').forEach(img => {
                if (img.src && img.src.startsWith('http://')) {
                    img.src = enforceHttps(img.src);
                }
                if (img.srcset) {
                    img.srcset = img.srcset.replace(/http:\/\//gi, 'https://');
                }
            });
            container.appendChild(clone);
        });
    };

    if (window.currentMetadata && window.currentMetadata.seriesTitle && window.currentMetadata.type !== 'movie') {
        chrome.runtime.sendMessage({ type: 'GET_SERIES_DATA' }, (series) => {
            const seriesData = (series && series[window.currentMetadata.seriesTitle]) ? series[window.currentMetadata.seriesTitle] : null;
            renderItems(seriesData);
        });
    } else {
        renderItems(null);
    }
}

function populateHistoryQueue() {
    const container = document.getElementById('acteia-history-items-container');
    container.innerHTML = '<div style="padding: 15px; color: #aaa; text-align: center;">Carregando histórico...</div>';
    
    chrome.storage.local.get(['series'], (storage) => {
        const series = storage.series || {};
        
        container.innerHTML = '';
        container.className = 'acteia-series-grid';

        const seriesList = Object.values(series).sort((a, b) => new Date(b.lastWatched) - new Date(a.lastWatched));
        
        if (seriesList.length === 0) {
            container.innerHTML = '<div style="padding: 15px; color: #aaa; text-align: center;">Seu histórico está vazio.</div>';
            container.className = '';
            return;
        }

        seriesList.slice(0, 15).forEach(s => {
            let latestEp = null;
            let latestDate = null;

            if (!s.seasons) return;

            Object.keys(s.seasons).forEach(sNum => {
                const season = s.seasons[sNum];
                if (!season.episodes) return;
                
                Object.keys(season.episodes).forEach(eNum => {
                    const ep = season.episodes[eNum];
                    const epDate = ep.updatedAt ? new Date(ep.updatedAt) : new Date(0);

                    if (!latestDate || epDate > latestDate) {
                        latestDate = epDate;
                        latestEp = { ...ep, season: sNum, episode: eNum };
                    }
                });
            });

            if (!latestEp) return;

            const card = document.createElement('div');
            card.className = 'acteia-series-card';
            
            const duration = latestEp.duration || 1;
            const progressPerc = latestEp.watched ? 100 : Math.round((latestEp.progress / duration) * 100);
            
            const thumbUrl = s.thumbnail || '';
            const thumbHtml = thumbUrl ? `<img src="${thumbUrl}" alt="${s.title}" class="acteia-card-img-actual" loading="lazy">` : `<div class="acteia-card-img-placeholder">${s.title.charAt(0)}</div>`;

            const isMovie = s.type === 'movie' || latestEp.season === 'movie';
            const subTitle = isMovie ? 'Filme' : `T${latestEp.season.toString().padStart(2, '0')} E${latestEp.episode.toString().padStart(2, '0')}`;

            card.innerHTML = `
                <div class="acteia-card-img-container">
                    ${thumbHtml}
                    <div class="acteia-progress-container-card">
                        <div class="acteia-progress-bar-card" style="width: ${progressPerc}%"></div>
                    </div>
                    <div class="acteia-card-overlay">
                        <div class="acteia-card-title" title="${s.title}">${s.title}</div>
                        <div class="acteia-card-sub">${subTitle}</div>
                    </div>
                </div>
            `;

            card.onclick = () => {
                if (latestEp.url) {
                    window.location.href = latestEp.url;
                }
            };
            
            container.appendChild(card);
        });
    });
}

function formatTime(seconds) {
    if (!seconds) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Export for use in content.js
if (typeof window !== 'undefined') {
    window.createPlayerUI = createPlayerUI;
}
