// Elements that fade in from the bottom as they scroll into view
// (the about section under the banner has its own on-load animation in styles.css)
const REVEAL_SELECTORS = [
    '.education-header',
    '.timeline-entry',
    '.experience-header',
    '.skills-panel',
    '.projects-header',
    '.projects-disclaimer',
    '.projects-more',
    '.resume-header',
    '.resume-viewer'
];

const STAGGER_MS = 80;

function initScrollReveal() {
    let elements = document.querySelectorAll(REVEAL_SELECTORS.join(', '));

    // Without IntersectionObserver support, leave everything visible
    if (!('IntersectionObserver' in window)) return;

    let observer = new IntersectionObserver(handleIntersect, {
        threshold: 0.15,
        rootMargin: '0px 0px -100px 0px'
    });

    elements.forEach(elem => {
        elem.classList.add('reveal');
        observer.observe(elem);
    });
}

function handleIntersect(entries, observer) {
    // Stagger elements that come into view together so they cascade in
    entries
        .filter(entry => entry.isIntersecting)
        .forEach((entry, i) => {
            entry.target.style.transitionDelay = (i * STAGGER_MS) + 'ms';
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
        });
}

export { initScrollReveal };
