document.addEventListener('DOMContentLoaded', () => {
    console.log('Acteia Tracker: Popup opened');
    
    // Store data globally for modal
    window.trackerData = { series: {}, history: [] };
    
    loadData();
    setupHeaderActions();
    setupSearch();
    setupModalEvents();
});

function setupHeaderActions() {
    document.getElementById('options-btn').onclick = () => {
        chrome.runtime.openOptionsPage();
    };

    document.getElementById('sync-btn').onclick = (e) => {
        console.log('Acteia Tracker: Manual sync and metadata retry triggered');
        const icon = e.currentTarget.querySelector('svg');
        if (icon) icon.style.transition = 'transform 0.5s ease';
        if (icon) icon.style.transform = 'rotate(360deg)';
        
        chrome.runtime.sendMessage({ type: 'RETRY_THUMBNAILS' }, (response) => {
            console.log('Acteia Tracker: Retry thumbnails response:', response);
            loadData();
            setTimeout(() => {
                if (icon) icon.style.transform = 'rotate(0deg)';
            }, 500);
        });
    };
    
    const searchBtn = document.getElementById('search-btn');
    const searchContainer = document.getElementById('search-bar-container');
    const searchInput = document.getElementById('search-input');
    
    searchBtn.onclick = () => {
        searchContainer.classList.toggle('hidden');
        if (!searchContainer.classList.contains('hidden')) {
            searchInput.focus();
        } else {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        }
    };
}

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.series-card');
        let visibleCount = 0;
        
        cards.forEach(card => {
            const title = card.getAttribute('data-title').toLowerCase();
            if (title.includes(query)) {
                card.style.display = 'flex';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
        
        const emptyState = document.getElementById('empty-state');
        if (visibleCount === 0 && cards.length > 0) {
            emptyState.classList.remove('hidden');
            emptyState.innerText = 'Nenhuma série encontrada na pesquisa.';
        } else if (cards.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.innerText = 'Nenhum histórico encontrado.';
        } else {
            emptyState.classList.add('hidden');
        }
    };
}

function loadData() {
    console.log('Acteia Tracker: Loading data from storage...');
    chrome.storage.local.get(['series', 'history'], (storage) => {
        console.log('Acteia Tracker: Data retrieved:', storage);
        window.trackerData.series = storage.series || {};
        window.trackerData.history = storage.history || [];

        renderUnifiedGrid(window.trackerData.series);
    });
}

function renderUnifiedGrid(series) {
    const grid = document.getElementById('unified-grid');
    const emptyState = document.getElementById('empty-state');
    
    grid.innerHTML = '';

    const seriesList = Object.values(series).sort((a, b) => new Date(b.lastWatched) - new Date(a.lastWatched));
    console.log('Acteia Tracker: Rendering unified series list:', seriesList.length, 'items');

    if (seriesList.length === 0) {
        emptyState.classList.remove('hidden');
        emptyState.innerText = 'Nenhum histórico encontrado.';
        return;
    }
    
    emptyState.classList.add('hidden');

    seriesList.forEach(s => {
        let latestEp = null;
        let latestDate = null;
        let isFullyWatched = true;
        let totalWatched = 0;
        let totalEps = 0;
        let allEpisodesList = [];

        if (!s.seasons) return;

        Object.keys(s.seasons).forEach(sNum => {
            const season = s.seasons[sNum];
            if (!season.episodes) return;
            
            Object.keys(season.episodes).forEach(eNum => {
                const ep = season.episodes[eNum];
                totalEps++;
                if (ep.watched) totalWatched++;
                else isFullyWatched = false;
                
                const epDate = ep.updatedAt ? new Date(ep.updatedAt) : new Date(0);
                
                allEpisodesList.push({ ...ep, season: sNum, episode: eNum, dateObj: epDate });

                if (!latestDate || epDate > latestDate) {
                    latestDate = epDate;
                    latestEp = { ...ep, season: sNum, episode: eNum };
                }
            });
        });

        if (!latestEp) return;
        
        // Sort episodes by most recently watched
        allEpisodesList.sort((a, b) => b.dateObj - a.dateObj);

        const card = createSeriesCard(s, latestEp, isFullyWatched, totalWatched, totalEps, allEpisodesList);
        grid.appendChild(card);
    });
}

function createSeriesCard(series, episode, isFullyWatched, totalWatched, totalEps, allEpisodesList) {
    const card = document.createElement('div');
    card.className = 'series-card';
    card.setAttribute('data-title', series.title);
    
    const duration = episode.duration || 1;
    const progressPerc = episode.watched ? 100 : Math.round((episode.progress / duration) * 100);
    
    const thumbUrl = series.thumbnail || '';
    const thumbHtml = thumbUrl ? `<img src="${thumbUrl}" alt="${series.title}" class="card-img-actual" loading="lazy">` : `<div class="card-img-placeholder">${series.title.charAt(0)}</div>`;

    const isMovie = series.type === 'movie' || episode.season === 'movie';
    const subTitle = isMovie ? 'Filme' : `T${episode.season.toString().padStart(2, '0')} E${episode.episode.toString().padStart(2, '0')}`;

    card.innerHTML = `
        <div class="card-img-container">
            ${thumbHtml}
            <div class="delete-btn" title="Remover do Histórico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${progressPerc}%"></div>
            </div>
            <div class="card-overlay">
                <div class="card-title" title="${series.title}">${series.title}</div>
                <div class="card-sub">${subTitle}</div>
            </div>
        </div>
    `;

    const delBtn = card.querySelector('.delete-btn');
    delBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Remover "${series.title}" do histórico?`)) {
            removeSeries(series.title);
        }
    };

    card.onclick = () => {
        openModal(series, episode, isFullyWatched, totalWatched, totalEps, allEpisodesList, isMovie);
    };

    return card;
}

function setupModalEvents() {
    const modal = document.getElementById('details-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const backdrop = document.querySelector('.modal-backdrop');

    const closeModal = () => {
        modal.classList.add('modal-hidden');
    };

    closeBtn.onclick = closeModal;
    backdrop.onclick = closeModal;
}

function openModal(series, latestEp, isFullyWatched, watchedCount, totalCount, episodesList, isMovie) {
    const modal = document.getElementById('details-modal');
    const titleEl = document.getElementById('modal-title');
    const statusEl = document.getElementById('modal-status');
    const progressTextEl = document.getElementById('modal-progress-text');
    const continueBtn = document.getElementById('modal-continue-btn');
    const episodesListEl = document.getElementById('modal-episodes-list');

    titleEl.innerText = series.title;

    // Status logic (No emojis as requested!)
    if (isFullyWatched || (isMovie && latestEp.watched)) {
        statusEl.innerText = 'Concluído';
        statusEl.className = 'status-badge completed';
    } else {
        statusEl.innerText = 'Assistindo';
        statusEl.className = 'status-badge watching';
    }

    // Progress text
    if (isMovie) {
        const p = latestEp.watched ? 100 : Math.round((latestEp.progress / (latestEp.duration || 1)) * 100);
        progressTextEl.innerText = `${p}% Concluído`;
    } else {
        const overallPerc = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;
        progressTextEl.innerText = `${overallPerc}% ( ${watchedCount}/${totalCount} eps )`;
    }

    // Continue button
    continueBtn.onclick = () => {
        chrome.tabs.create({ url: latestEp.url });
    };
    
    if (isFullyWatched) {
        continueBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Assistir Novamente';
    } else {
        let btnText = isMovie ? 'Continuar Filme' : `Continuar T${latestEp.season} E${latestEp.episode}`;
        continueBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M5 3v18l15-9L5 3z"/></svg> ${btnText}`;
    }

    // Render Episodes list
    episodesListEl.innerHTML = '';
    
    // Take up to 10 recent episodes for the list
    const recentEps = episodesList.slice(0, 10);
    
    if (recentEps.length === 0) {
        episodesListEl.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Nenhum episódio registrado.</div>';
    }

    recentEps.forEach(ep => {
        const item = document.createElement('div');
        item.className = 'episode-item';
        
        const epTitle = isMovie ? 'Filme' : `Temporada ${ep.season} • Episódio ${ep.episode}${ep.title ? ' - ' + ep.title : ''}`;
        const p = ep.watched ? 100 : Math.round((ep.progress / (ep.duration || 1)) * 100);
        
        const timeAgo = getTimeAgo(ep.dateObj);

        item.innerHTML = `
            <div class="episode-info">
                <div class="episode-title" title="${epTitle}">${epTitle}</div>
                <div class="episode-meta-row">
                    <div class="episode-progress-wrap">
                        <div class="episode-progress-fill" style="width: ${p}%"></div>
                    </div>
                    <div class="episode-date">${timeAgo}</div>
                </div>
            </div>
            <div class="play-icon">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
        `;

        item.onclick = () => {
            chrome.tabs.create({ url: ep.url });
        };

        episodesListEl.appendChild(item);
    });

    modal.classList.remove('modal-hidden');
}

// Helper to format dates
function getTimeAgo(date) {
    if (!date || isNaN(date.getTime())) return 'Desconhecido';
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffMins < 60) {
        return diffMins <= 1 ? 'Agora' : `Há ${diffMins} min`;
    } else if (diffHours < 24) {
        return `Há ${diffHours} h`;
    } else if (diffDays === 1) {
        return 'Ontem';
    } else if (diffDays < 7) {
        return `Há ${diffDays} dias`;
    } else {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }
}

function removeSeries(title) {
    chrome.storage.local.get(['series', 'history'], (storage) => {
        const series = storage.series || {};
        let history = storage.history || [];

        // Remove from series object
        if (series[title]) {
            delete series[title];
        }

        // Remove from history array
        history = history.filter(h => h.series !== title);

        chrome.storage.local.set({ series, history }, () => {
            console.log(`Acteia Tracker: Removed "${title}" from storage.`);
            loadData(); // Refresh UI
        });
    });
}
