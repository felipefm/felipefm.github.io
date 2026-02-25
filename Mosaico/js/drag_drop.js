
import { saveState } from './state.js';

let dragSrcEl = null;

export function setupDragEvents(elem) {
    elem.addEventListener('dragstart', handleDragStart);
    elem.addEventListener('dragover', handleDragOver);
    elem.addEventListener('dragenter', handleDragEnter);
    elem.addEventListener('dragleave', handleDragLeave);
    elem.addEventListener('drop', handleDrop);
    elem.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    this.style.opacity = '0.4'; // Visual feedback
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('over');
}

function handleDragLeave(e) {
    this.classList.remove('over');
}

function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    if (dragSrcEl !== this) {
        const grid = this.parentNode;
        const children = Array.from(grid.children);
        const srcIndex = children.indexOf(dragSrcEl);
        const targetIndex = children.indexOf(this);

        if (srcIndex < targetIndex) {
            this.after(dragSrcEl);
        } else {
            this.before(dragSrcEl);
        }
        saveState(); // Salva a nova ordem após arrastar
    }
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    const items = document.querySelectorAll('.video-container');
    items.forEach(item => item.classList.remove('over'));
}
