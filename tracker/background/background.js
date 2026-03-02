// Background Script for Acteia Tracker

console.log('Acteia Tracker: Background Script Loading...');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_PROGRESS') {
        saveProgress(message.data).then(() => {
            sendResponse({ status: 'success' });
        }).catch(err => {
            console.error('Acteia Tracker: Save error:', err);
            sendResponse({ status: 'error', error: err.message });
        });
        return true; 
    } else if (message.type === 'GET_SERIES_DATA') {
        chrome.storage.local.get(['series'], (result) => {
            sendResponse(result.series || {});
        });
        return true;
    } else if (message.type === 'GET_ALL_DATA') {
        chrome.storage.local.get(['series', 'history'], (result) => {
            sendResponse({ series: result.series || {}, history: result.history || [] });
        });
        return true;
    } else if (message.type === 'RETRY_THUMBNAILS') {
        // Re-fetch thumbnails for entries that are missing one
        chrome.storage.local.get(['series'], async (result) => {
            let series = result.series || {};
            const entries = Object.keys(series);
            for (const key of entries) {
                console.log(`Acteia Tracker: Retrying metadata for: ${series[key].title}`);
                const thumb = await fetchSeriesThumbnail(series[key].title);
                // Even if it returns '', we update it to clear old broken ones
                series[key].thumbnail = thumb;
            }
            if (entries.length > 0) chrome.storage.local.set({ series });
            sendResponse({ retried: entries.length });
        });
        return true;
    }
});

async function saveProgress(data) {
    const { seriesTitle, season, episode, progress, lastPosition, url, episodeTitle, duration, type } = data;
    
    if (!seriesTitle || seriesTitle === 'Unknown') return;

    const storage = await chrome.storage.local.get(['series', 'history']);
    let series = storage.series || {};
    let history = storage.history || [];

    if (!series[seriesTitle]) {
        series[seriesTitle] = {
            id: seriesTitle.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'),
            title: seriesTitle,
            lastWatched: new Date().toISOString(),
            thumbnail: '',
            type: type || 'series',
            seasons: {}
        };
        
        fetchSeriesThumbnail(seriesTitle).then(thumb => {
            if (thumb) {
                chrome.storage.local.get(['series'], (res) => {
                    let s = res.series || {};
                    if (s[seriesTitle]) {
                        s[seriesTitle].thumbnail = thumb;
                        chrome.storage.local.set({ series: s });
                    }
                });
            }
        });
    }

    const seriesObj = series[seriesTitle];
    seriesObj.lastWatched = new Date().toISOString();
    seriesObj.type = type || seriesObj.type;

    const sKey = season !== null ? season.toString() : 'movie';
    const eKey = episode !== null ? episode.toString() : '1';

    if (!seriesObj.seasons[sKey]) {
        seriesObj.seasons[sKey] = { episodes: {} };
    }

    const safeDuration = duration || progress || 1;
    const watched = (progress / safeDuration) >= 0.95;

    seriesObj.seasons[sKey].episodes[eKey] = {
        watched,
        progress: progress,
        duration: duration,
        lastPosition: lastPosition,
        url: url,
        title: episodeTitle || (type === 'movie' ? '' : `Episódio ${episode}`),
        updatedAt: new Date().toISOString()
    };

    // Update history (Deduplicated timeline)
    const historyEntry = {
        timestamp: new Date().toISOString(),
        series: seriesTitle,
        season,
        episode,
        type: type || 'series',
        action: watched ? 'completed' : 'progress',
        progress: Math.round((progress / safeDuration) * 100)
    };

    const existingIndex = history.findIndex(h => 
        h.series === seriesTitle && 
        h.season === season && 
        h.episode === episode
    );

    if (existingIndex !== -1) {
        history.splice(existingIndex, 1);
    }
    
    history.unshift(historyEntry);
    if (history.length > 100) history.pop();

    await chrome.storage.local.set({ series, history });
    
    if (watched && type !== 'movie') {
        checkNextEpisode(seriesTitle, season, episode, url);
    }
}

async function fetchSeriesThumbnail(rawTitle) {
    if (!rawTitle) return '';
    console.log('Acteia Tracker: Searching thumbnail for:', rawTitle);

    // Clean title for better search results
    let title = rawTitle
        .replace(/\(\d{4}\)/g, '') 
        .replace(/\b\d{4}\b/g, '')  
        .replace(/\bDublado\b/gi, '')
        .replace(/\bLegendado\b/gi, '')
        .replace(/\bAssistir\b/gi, '')
        .replace(/\bOnline\b/gi, '')
        .replace(/\bFull HD\b/gi, '')
        .replace(/\bFilme\b/gi, '')
        .replace(/\bCompleto\b/gi, '')
        .replace(/ - .*/g, '') 
        .replace(/\s+/g, ' ')
        .trim();

    console.log('Acteia Tracker: Search title:', title);

    const translations = {
        'Capitão América': 'Captain America',
        'Guerra Civil': 'Civil War',
        'Sobrenatural': 'Supernatural',
        'O Último de Nós': 'The Last of Us',
        'A Casa do Dragão': 'House of the Dragon',
        'Anéis de Poder': 'Rings of Power'
    };

    let searchTerms = [title];
    let translated = title;
    Object.keys(translations).forEach(pt => {
        if (title.toLowerCase().includes(pt.toLowerCase())) {
            translated = translated.replace(new RegExp(pt, 'gi'), translations[pt]);
        }
    });
    if (translated !== title && !searchTerms.includes(translated)) {
        searchTerms.unshift(translated); // English first prioritized
    }

    const enforceHttps = (url) => {
        if (!url) return '';
        if (url.startsWith('http://')) return url.replace('http://', 'https://');
        return url;
    };

    for (const term of searchTerms) {
        // 1. TVMaze (Best for series like Supernatural)
        try {
            const showRes = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(term)}`);
            if (showRes.ok) {
                const data = await showRes.json();
                const thumb = data.image ? (data.image.medium || data.image.original) : null;
                if (thumb) return enforceHttps(thumb);
            }
        } catch (err) {}

        // 2. OMDb (Best for movies)
        try {
            const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=trilogy&t=${encodeURIComponent(term)}&plot=short`);
            if (omdbRes.ok) {
                const data = await omdbRes.json();
                if (data.Poster && data.Poster !== 'N/A') return enforceHttps(data.Poster);
            }
        } catch (err) {}
    }

    // Secondary fallback (TVMaze broad search)
    try {
        const movieRes = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`);
        if (movieRes.ok) {
            const results = await movieRes.json();
            if (results.length > 0) {
                const best = results[0].show;
                const thumb = best.image ? (best.image.medium || best.image.original) : null;
                if (thumb) return enforceHttps(thumb);
            }
        }
    } catch (err) {}

    return '';
}

async function checkNextEpisode(seriesTitle, season, episode, currentUrl) {
    const nextEpisode = episode + 1;
    const nextUrl = currentUrl.replace(/E(\d+)/i, (match, p1) => {
        return 'E' + nextEpisode.toString().padStart(p1.length, '0');
    });
    console.log(`Suggested next episode for ${seriesTitle}: S${season}E${nextEpisode}`);
}
