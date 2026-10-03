import * as TriangleCanvas from './triangleCanvas.js?v=4';
import * as Nav from './nav.js?v=5';
import * as ScrollReveal from './scrollReveal.js?v=4';
import * as ResumeViewer from './resumeViewer.js?v=4';

function main() {
    TriangleCanvas.initTriangles();
    Nav.initNavBar();
    ScrollReveal.initScrollReveal();
    ResumeViewer.initResumeViewer();
}

main();