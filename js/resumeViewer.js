// Draws each page of the resume PDF straight onto the page with PDF.js (no browser viewer chrome),
// with a small toolbar for zooming and full screen
const VIEWER = document.getElementById('resume-viewer');
const CONTAINER = document.getElementById('resume-pages');
const CONTROLS = VIEWER ? VIEWER.querySelector('.resume-controls') : null;
const ZOOM_LABEL = VIEWER ? VIEWER.querySelector('.resume-zoom-level') : null;
// PDF.js 3.11.174 is hosted in js/lib. index.html also loads pdf.worker.min.js as a plain script, so PDF.js
// finds window.pdfjsWorker and parses on the main thread instead of spinning up a Web Worker (which stalled here)
const WORKER_SRC = 'js/lib/pdf.worker.min.js';
const RESIZE_DEBOUNCE_MS = 200;
const LOAD_TIMEOUT_MS = 10000;
// Zoom is relative to "fit to width" (1 = the page exactly fills the viewer's width)
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
// Desktop shows the viewer as the right-hand column of the Projects section; smaller screens keep it in its own
// Resume section. Must match the desktop/mobile breakpoint in styles.css
const DESKTOP_QUERY = window.matchMedia('(min-width: 1101px)');
const PROJECTS_SLOT = document.querySelector('.resume-slot-projects');
const SECTION_SLOT = document.querySelector('.resume-slot-section');
const PROJECTS_TREE = document.querySelector('.projects-tree');
// Beside the projects tree the viewer is sized so the bottom of the resume page lines up with the bottom of the
// tree ("More on GitHub"). Widening the viewer narrows (and so lengthens) the tree, so the width is searched for.
// Bounds: the viewer never goes below 380px, and the tree keeps room for 260px-wide project descriptions
const VIEWER_MIN_WIDTH = 380;
const TREE_FIXED_WIDTH = 329;       // date + connectors + icon column in front of the descriptions (see styles.css)
const TREE_MIN_TEXT_WIDTH = 260;
const VIEWER_SCALE = 0.92;

let pdfDoc = null;
let zoom = 1;
let renderedWidth = 0;
let renderedZoom = 1;
let resizeTimer = null;
let rendering = Promise.resolve();

async function initResumeViewer() {
    if (!CONTAINER) return;

    // Move the viewer to the right spot before the first render, and again whenever the layout switches
    placeViewer();
    DESKTOP_QUERY.addEventListener('change', () => {
        placeViewer();
        if (pdfDoc) queueRender();
    });

    if (!window.pdfjsLib) {
        showFallback(new Error('PDF.js library did not load'));
        return;
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;

    try {
        // Never leave the section silently empty: give up and show the fallback if loading stalls
        let timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timed out loading resume PDF')), LOAD_TIMEOUT_MS));

        pdfDoc = await Promise.race([pdfjsLib.getDocument(CONTAINER.dataset.src).promise, timeout]);
        await renderPages();
    } catch (err) {
        console.error('error loading resume PDF', err);
        showFallback(err);
        return;
    }

    initControls();
    initDragToPan();

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Beside the projects tree the viewer's width is recalculated on every resize (the tree's width changes);
            // otherwise only redraw when the width actually changed (mobile address bars fire resize on scroll)
            let besideTree = DESKTOP_QUERY.matches && VIEWER.parentElement === PROJECTS_SLOT;
            if (besideTree || CONTAINER.clientWidth !== renderedWidth) queueRender();
        }, RESIZE_DEBOUNCE_MS);
    });

    // The tree's height depends on the web font; re-balance once it has loaded
    if (document.fonts) document.fonts.ready.then(() => queueRender());
}

// Moving the element keeps its drawn pages, controls and listeners; only its width changes, which the re-render handles
function placeViewer() {
    let slot = DESKTOP_QUERY.matches ? PROJECTS_SLOT : SECTION_SLOT;
    if (slot && VIEWER.parentElement !== slot) slot.appendChild(VIEWER);
}

function initControls() {
    if (!CONTROLS) return;

    CONTROLS.hidden = false;
    CONTROLS.addEventListener('click', event => {
        let button = event.target.closest('button');
        if (!button) return;

        switch (button.dataset.action) {
            case 'zoom-in':    setZoom(ZOOM_STEPS.find(step => step > zoom) || zoom); break;
            case 'zoom-out':   setZoom([...ZOOM_STEPS].reverse().find(step => step < zoom) || zoom); break;
            case 'fit':        setZoom(1); break;
            case 'fullscreen': toggleFullscreen(); break;
        }
    });

    // Element full screen isn't available everywhere (e.g. iPhone Safari): hide the button there
    let fullscreenButton = CONTROLS.querySelector('[data-action="fullscreen"]');
    if (!document.fullscreenEnabled) fullscreenButton.hidden = true;

    document.addEventListener('fullscreenchange', () => {
        let isFullscreen = document.fullscreenElement === VIEWER;
        fullscreenButton.querySelector('.material-icons').textContent = isFullscreen ? 'fullscreen_exit' : 'fullscreen';
        fullscreenButton.setAttribute('aria-label', isFullscreen ? 'Exit full screen' : 'Full screen');
        fullscreenButton.title = fullscreenButton.getAttribute('aria-label');
        queueRender();
    });

    updateControls();
}

// With the scroll bar hidden on desktop, zoomed-in pages are moved by dragging them with the mouse.
// Touch screens keep their normal swipe scrolling, so only mouse drags are handled here.
function initDragToPan() {
    let dragging = false;
    let startX = 0, startY = 0, startScrollLeft = 0, startScrollY = 0;

    CONTAINER.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || !CONTAINER.classList.contains('zoomed')) return;

        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        startScrollLeft = CONTAINER.scrollLeft;
        startScrollY = scrollParent().scrollTop;
        CONTAINER.classList.add('dragging');
        CONTAINER.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    CONTAINER.addEventListener('pointermove', event => {
        if (!dragging) return;
        CONTAINER.scrollLeft = startScrollLeft - (event.clientX - startX);
        scrollParent().scrollTop = startScrollY - (event.clientY - startY);
    });

    let stopDragging = () => {
        dragging = false;
        CONTAINER.classList.remove('dragging');
    };
    CONTAINER.addEventListener('pointerup', stopDragging);
    CONTAINER.addEventListener('pointercancel', stopDragging);
}

// Vertical dragging scrolls whatever is scrolling the page: the viewer itself in full screen, otherwise the document
function scrollParent() {
    return document.fullscreenElement === VIEWER ? VIEWER : document.scrollingElement;
}

function setZoom(newZoom) {
    if (newZoom === zoom) return;
    zoom = newZoom;
    updateControls();
    queueRender();
}

function updateControls() {
    if (!CONTROLS) return;
    ZOOM_LABEL.textContent = Math.round(zoom * 100) + '%';
    CONTROLS.querySelector('[data-action="zoom-out"]').disabled = zoom <= ZOOM_STEPS[0];
    CONTROLS.querySelector('[data-action="zoom-in"]').disabled = zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1];
    CONTROLS.querySelector('[data-action="fit"]').disabled = zoom === 1;
}

function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else VIEWER.requestFullscreen().catch(err => console.warn('full screen unavailable:', err.message));
}

// Renders run one at a time so fast clicking can't interleave two redraws
function queueRender() {
    rendering = rendering.then(renderPages, renderPages);
    return rendering;
}

// Binary search for the viewer width where the resume page's bottom meets the tree's bottom
async function balanceWithTree() {
    let inProjects = DESKTOP_QUERY.matches && VIEWER.parentElement === PROJECTS_SLOT && PROJECTS_TREE;
    if (!inProjects || document.fullscreenElement === VIEWER) {
        if (PROJECTS_SLOT) PROJECTS_SLOT.style.flex = '';
        return;
    }

    let firstPage = await pdfDoc.getPage(1);
    let base = firstPage.getViewport({ scale: 1 });
    let aspect = base.height / base.width;

    let row = PROJECTS_SLOT.parentElement;
    let rowStyle = getComputedStyle(row);
    let available = row.clientWidth - parseFloat(rowStyle.paddingLeft) - parseFloat(rowStyle.paddingRight)
        - parseFloat(rowStyle.columnGap || rowStyle.gap || 0);
    let toolbar = VIEWER.querySelector('.resume-toolbar');

    let low = VIEWER_MIN_WIDTH;
    let high = Math.max(low, available - TREE_FIXED_WIDTH - TREE_MIN_TEXT_WIDTH);

    // How far the bottom of the resume page is from the bottom of the tree at a given viewer width. Everything is
    // measured live: the tree re-wraps its text and the toolbar can wrap to two rows as widths change
    let gapAt = width => {
        PROJECTS_SLOT.style.flex = '0 0 ' + width + 'px';
        let toolbarHeight = toolbar.offsetHeight + parseFloat(getComputedStyle(toolbar).marginBottom);
        return (toolbarHeight + width * aspect) - PROJECTS_TREE.offsetHeight;
    };

    // Widening the viewer lengthens the tree too, sometimes faster than the resume grows, so the gap isn't
    // monotonic: sweep the allowed range, then refine around the closest match
    let best = low, bestGap = Infinity;
    for (let width = low; width <= high; width += 20) {
        let gap = Math.abs(gapAt(width));
        if (gap < bestGap) { best = width; bestGap = gap; }
    }
    for (let width = Math.max(low, best - 19); width <= Math.min(high, best + 19); width++) {
        let gap = Math.abs(gapAt(width));
        if (gap < bestGap) { best = width; bestGap = gap; }
    }

    // Then shown slightly smaller than the closest match, so the resume doesn't dominate the section
    gapAt(Math.max(low, Math.round(best * VIEWER_SCALE)));
}

async function renderPages() {
    await balanceWithTree();

    let fitWidth = CONTAINER.clientWidth;
    let pageWidth = Math.floor(fitWidth * zoom);
    // Desktop draws at twice the screen's pixel density (capped at 4x) and lets the browser scale it down:
    // the resume is small beside the projects tree, and downsampled text reads cleaner than text drawn 1:1
    let pixelRatio = (window.devicePixelRatio || 1) * (DESKTOP_QUERY.matches ? 2 : 1);
    pixelRatio = Math.min(pixelRatio, 4);
    let canvases = [];

    // Keep the same spot centered horizontally when zooming
    let centerRatio = CONTAINER.scrollWidth > 0 ? (CONTAINER.scrollLeft + fitWidth / 2) / CONTAINER.scrollWidth : 0.5;

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        let page = await pdfDoc.getPage(i);
        let baseViewport = page.getViewport({ scale: 1 });

        // Size the canvas in whole device pixels and give it the exact matching CSS size, so every canvas pixel
        // lands on exactly one screen pixel (any mismatch makes the browser resample the image, which blurs text)
        let cssHeight = Math.round(pageWidth * baseViewport.height / baseViewport.width);
        let canvas = document.createElement('canvas');
        canvas.className = 'resume-page';
        canvas.width = Math.round(pageWidth * pixelRatio);
        canvas.height = Math.round(cssHeight * pixelRatio);
        canvas.style.width = pageWidth + 'px';
        canvas.style.height = cssHeight + 'px';

        let viewport = page.getViewport({ scale: canvas.width / baseViewport.width });
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
        canvases.push(canvas);
    }

    CONTAINER.replaceChildren(...canvases);
    CONTAINER.classList.toggle('zoomed', zoom > 1);
    if (zoom !== renderedZoom) CONTAINER.scrollLeft = centerRatio * CONTAINER.scrollWidth - fitWidth / 2;

    renderedWidth = fitWidth;
    renderedZoom = zoom;
}

// If PDF.js can't draw the resume (e.g. the page was opened from file://, where Chrome blocks reading the PDF),
// point to the PDF instead of leaving the section empty
function showFallback(err) {
    if (err) console.warn('resume viewer fallback:', err.message);

    let message = document.createElement('p');
    message.className = 'resume-fallback';
    message.innerHTML = 'The resume couldn\'t be displayed here. <a href="' + CONTAINER.dataset.src +
        '" target="_blank" rel="noopener">Open the PDF</a> instead.';

    CONTAINER.replaceChildren(message);
}

export { initResumeViewer };
