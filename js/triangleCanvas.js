const CANVAS = document.getElementById('triangles');

const TRIANGLE = {
    up: 1,
    down: 2,
    left: 3,
    right: 4
}

let triangles = [];

function initTriangles() {
    let tCount = CANVAS.dataset.triangles;
    let triangleCount = (tCount) ? tCount : ((Math.random() * (24 - 16 + 1)) + 16);

    for(let i = 0; i < triangleCount; i++) {
        if(i >= 0 && i <= (triangleCount * 0.25)) {
            triangles.push(new RandTriangle(TRIANGLE.up));
        }
        else if(i > 0.25 && i <= (triangleCount * 0.50)) {
            triangles.push(new RandTriangle(TRIANGLE.down));
        }
        else if(i > 0.5 && i <= (triangleCount * 0.75)) {
            triangles.push(new RandTriangle(TRIANGLE.left));
        }
        else {
            triangles.push(new RandTriangle(TRIANGLE.right));
        }
    }
}

function clearTriangles() {
    while (CANVAS.firstChild)
        CANVAS.removeChild(CANVAS.firstChild);
}

class RandTriangle {
    constructor(type) {
        if (!type) console.error('error creating triangle: no type specified');

        this.type = type
        this.constructTrianle();

        triangles.push(this);
    }

    constructTrianle() {
        this.fragment = new DocumentFragment();
        this.sizeScale = Math.ceil(500 * ((Math.random() * .35) + .2)) + 'px';

        let elem = this.#styleElement();

        this.fragment.append(elem);
        CANVAS.appendChild(elem);
    }

    #styleElement() {
        let elem = document.createElement('div');
        elem.setAttribute('class', 'triangle');

        switch(this.type) {
            case TRIANGLE.up:
                elem.style.top = 'calc(100% - ' + this.sizeScale + ')';
                elem.style.left = (Math.ceil((Math.random() * 100) * 0.7 ) + '%');
                elem.style.borderLeft = (this.sizeScale + ' solid transparent');
                elem.style.borderRight = (this.sizeScale + ' solid transparent');
                elem.style.borderBottom = (this.sizeScale + ' solid ' + this.#getNewColor());
                break;
            case TRIANGLE.down:
                elem.style.top = '0%';
                elem.style.left = (Math.ceil((Math.random() * 100) * 0.7 ) + '%');
                elem.style.borderLeft = (this.sizeScale + ' solid transparent');
                elem.style.borderRight = (this.sizeScale + ' solid transparent');
                elem.style.borderTop = (this.sizeScale + ' solid ' + this.#getNewColor());
                break;
            case TRIANGLE.left:
                elem.style.top = (Math.ceil((Math.random() * 100) * 0.7 ) + '%');
                elem.style.left = 'calc(100% - ' + this.sizeScale + ')';
                elem.style.borderRight = (this.sizeScale + ' solid ' + this.#getNewColor());
                elem.style.borderBottom = (this.sizeScale + ' solid transparent');
                elem.style.borderTop = (this.sizeScale + ' solid transparent');
                break;
            case TRIANGLE.right:
                elem.style.top = (Math.ceil((Math.random() * 100) * 0.7 ) + '%');
                elem.style.left = '0%';
                elem.style.borderLeft = (this.sizeScale + ' solid ' + this.#getNewColor());
                elem.style.borderBottom = (this.sizeScale + ' solid transparent');
                elem.style.borderTop = (this.sizeScale + ' solid transparent');
                break;
        }

        return elem;
    }

    // Dark slate/teal tones so the white banner text stays readable over every triangle
    #getNewColor() {
        switch(Math.ceil(Math.random() * (8))) {
            case 1:
                return '#1e293b';
            case 2:
                return '#233044';
            case 3:
                return '#283548';
            case 4:
                return '#2d3b50';
            case 5:
                return '#134e4a';
            case 6:
                return '#115e59';
            case 7:
                return '#0f4c5c';
            case 8:
                return '#1c3d52';
            default:
                return '#1e293b';
        }
    }
}

export { initTriangles };