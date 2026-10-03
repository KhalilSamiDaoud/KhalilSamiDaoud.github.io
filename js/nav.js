const NAV_BAR = document.getElementById('nav');

let navItems = [];
let focusedIcon;

function initNavBar() {
    Array.from(NAV_BAR.children).forEach( node => {
        navItems.push(new navItem(node));
    });

    focusedIcon = navItems[0];
    focusedIcon.elem.classList.add('active');

    window.addEventListener('scroll', requestActiveSectionUpdate, { passive: true });
    window.addEventListener('resize', requestActiveSectionUpdate, { passive: true });
    updateActiveSection();
}

function setFocusedIcon(navItem) {
    if (navItem === focusedIcon) return;

    focusedIcon.elem.classList.remove('active');
    focusedIcon = navItem;
    focusedIcon.elem.classList.add('active');
}

function handleNavItemSelect(navItem) {
    setFocusedIcon(navItem);
    smoothScrollTo(focusedIcon.elem.dataset.target);
}

// A section counts as current once its top passes this fraction of the viewport height
const ACTIVE_SECTION_OFFSET = 0.4;

let activeSectionFrame = null;

function requestActiveSectionUpdate() {
    if (activeSectionFrame !== null) return;

    activeSectionFrame = requestAnimationFrame(() => {
        activeSectionFrame = null;
        updateActiveSection();
    });
}

function updateActiveSection() {
    // Keep the clicked item highlighted while we animate past the sections in between
    if (scrollAnimation !== null) return;

    // Skip sections the current layout hides (e.g. the resume section on desktop, where the viewer lives in projects)
    let visibleItems = navItems.filter(item => {
        let section = document.getElementById(item.elem.dataset.target);
        return section && isRendered(section) && isRendered(item.elem);
    });
    if (visibleItems.length === 0) return;

    let current = visibleItems[0];
    let atBottom = window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 2;

    if (atBottom) {
        // The last section may be too short to ever reach the offset line
        current = visibleItems[visibleItems.length - 1];
    } else {
        let threshold = window.innerHeight * ACTIVE_SECTION_OFFSET;

        // Positions are read fresh each time since the resume viewer changes the page height as it loads
        for (let item of visibleItems) {
            let section = document.getElementById(item.elem.dataset.target);
            if (section.getBoundingClientRect().top <= threshold) {
                current = item;
            }
        }
    }

    setFocusedIcon(current);
}

// display: none elements have no boxes, and report a misleading top of 0
function isRendered(elem) {
    return elem.getClientRects().length > 0;
}

const SCROLL_MIN_MS = 400;
const SCROLL_MAX_MS = 900;

let scrollAnimation = null;

// Animate the scroll ourselves rather than relying on scrollIntoView's 'smooth' option,
// which some browsers/OS settings silently turn into an instant jump
function smoothScrollTo(id) {
    let element = document.getElementById(id);
    if (!element) return;

    cancelScrollAnimation();

    let start = window.pageYOffset;
    let maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    let target = Math.min(Math.max(element.getBoundingClientRect().top + start, 0), maxScroll);
    let distance = target - start;
    let duration = Math.min(SCROLL_MAX_MS, Math.max(SCROLL_MIN_MS, Math.abs(distance) * 0.5));
    let startTime = null;

    function step(now) {
        if (startTime === null) startTime = now;
        let progress = Math.min((now - startTime) / duration, 1);

        // 'instant' so the page's CSS scroll-behavior doesn't smooth each individual frame
        window.scrollTo({ top: start + distance * easeInOutCubic(progress), behavior: 'instant' });

        scrollAnimation = (progress < 1) ? requestAnimationFrame(step) : null;
        if (scrollAnimation === null) updateActiveSection();
    }

    scrollAnimation = requestAnimationFrame(step);
}

function cancelScrollAnimation() {
    if (scrollAnimation !== null) {
        cancelAnimationFrame(scrollAnimation);
        scrollAnimation = null;
    }
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Let the user take over mid-animation with the mouse wheel or a touch
window.addEventListener('wheel', cancelScrollAnimation, { passive: true });
window.addEventListener('touchstart', cancelScrollAnimation, { passive: true });

class navItem {
    constructor(element) {
        this.elem = element;
        this.eventManager = new AbortController();

        this.elem.addEventListener(
            'click', 
            this.#handleNavClick.bind(this), 
            { signal: this.eventManager.signal }
        );
        this.elem.addEventListener(
            'mouseover',
             this.#handleNavIn.bind(this),
            { signal: this.eventManager.signal }
        );
        this.elem.addEventListener(
            'mouseout',
            this.#handleNavOut.bind(this),
            { signal: this.eventManager.signal }
        );

        this.#constructToolTip();
    }

    destroy() {
        this.eventManager.abort();
    }

    #constructToolTip() {
        this.toolTip = document.createElement('span');
        this.toolTip.setAttribute('class', 'nav-item-tool-tip');
        this.toolTip.innerText = this.elem.dataset.tooltip;
    }

    #handleNavClick() {
        handleNavItemSelect(this);
    }
    
    #handleNavIn() {
        let position = this.#getCoords();
        this.toolTip.style.top = position.top + 'px';
        this.toolTip.style.left = position.left + 'px';
        this.toolTip.classList.remove('fade-out');
        this.toolTip.classList.add('fade-in');

        document.getElementsByTagName('body')[0].appendChild(this.toolTip);
    }
    
    #handleNavOut() {
        document.getElementsByTagName('body')[0].removeChild(this.toolTip);
    }

    #getCoords() {
        let box = this.elem.getBoundingClientRect();
    
        let body = document.body;
        let docEl = document.documentElement;
    
        let scrollTop = window.pageYOffset || docEl.scrollTop || body.scrollTop;
        let scrollLeft = window.pageXOffset || docEl.scrollLeft || body.scrollLeft;
    
        let clientTop = docEl.clientTop || body.clientTop || 0;
        let clientLeft = docEl.clientLeft || body.clientLeft || 0;
    
        let top  = box.top +  scrollTop - clientTop;
        let left = box.left + scrollLeft - clientLeft;
    
        return { top: Math.round(top), left: Math.round(left) };
    }
    
}

export { initNavBar };