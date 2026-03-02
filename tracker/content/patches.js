(function() {
    // Definitive silence for "requestFullscreen" errors
    // Browsers log a console error if requestFullscreen is called without a user gesture.
    // To prevent this log, we must NOT call the original method unless a gesture is active.
    
    function patch(obj, prop) {
        if (!obj || !obj.prototype) return;
        const original = obj.prototype[prop];
        if (!original) return;

        Object.defineProperty(obj.prototype, prop, {
            value: function(...args) {
                // native userActivation check (Chrome 72+)
                if (navigator.userActivation && !navigator.userActivation.isActive) {
                    // Silently ignore the call to prevent browser console pollution
                    return Promise.resolve();
                }

                try {
                    return new Promise((resolve) => {
                        try {
                            const result = original.apply(this, args);
                            if (result instanceof Promise) {
                                result.then(resolve).catch(() => resolve());
                            } else {
                                resolve();
                            }
                        } catch (err) {
                            resolve();
                        }
                    });
                } catch (e) {
                    return Promise.resolve();
                }
            },
            configurable: true,
            writable: true
        });
    }

    // Patch all variations on all relevant prototypes
    const methods = ['requestFullscreen', 'webkitRequestFullscreen', 'msRequestFullscreen', 'mozRequestFullScreen'];
    const targets = [Element, HTMLElement, HTMLVideoElement, HTMLDivElement];

    targets.forEach(t => {
        methods.forEach(m => patch(t, m));
    });

    // Patch Document.exitFullscreen
    const exitMethods = ['exitFullscreen', 'webkitExitFullscreen', 'msExitFullscreen', 'mozCancelFullScreen'];
    exitMethods.forEach(m => {
        const original = Document.prototype[m];
        if (original) {
            Document.prototype[m] = function(...args) {
                if (!document.fullscreenElement && !document.webkitFullscreenElement) return Promise.resolve();
                try {
                    const p = original.apply(this, args);
                    return (p instanceof Promise) ? p.catch(() => {}) : p;
                } catch (e) {
                    return Promise.resolve();
                }
            };
        }
    });

    // Upgrade URLs before they hit the DOM
    const upgradeUrl = (url) => {
        if (typeof url === 'string' && url.startsWith('http://')) {
            return url.replace('http://', 'https://');
        }
        return url;
    };

    const origImgSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (origImgSrc && origImgSrc.set) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            ...origImgSrc,
            set: function(val) {
                return origImgSrc.set.call(this, upgradeUrl(val));
            }
        });
    }

    const origSourceSrc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'src');
    if (origSourceSrc && origSourceSrc.set) {
        Object.defineProperty(HTMLSourceElement.prototype, 'src', {
            ...origSourceSrc,
            set: function(val) {
                return origSourceSrc.set.call(this, upgradeUrl(val));
            }
        });
    }
})();
