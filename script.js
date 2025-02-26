const pdfUpload = document.getElementById('pdf-upload');
const pdfCanvas = document.getElementById('pdf-canvas');
const pageNumInput = document.getElementById('page-num');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const thumbnailsDiv = document.getElementById('thumbnails');
let pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = 1.5,
    ctx = pdfCanvas.getContext('2d');

let drawingMode = false;
let lastX = 0;
let lastY = 0;
let isDrawing = false;

const enableDrawingButton = document.createElement('button');
enableDrawingButton.textContent = 'Toggle Drawing';
const drawingControls = document.createElement('div');
drawingControls.id = 'drawing-controls';
drawingControls.appendChild(enableDrawingButton);

const leftPanel = document.getElementById('left-panel');

const fullscreenButton = document.createElement('button');
fullscreenButton.textContent = 'Fullscreen';
const exitFullscreenButton = document.createElement('button');
exitFullscreenButton.textContent = 'Exit Fullscreen';

const fullscreenControls = document.createElement('div');
fullscreenControls.id = 'fullscreen-controls';
fullscreenControls.appendChild(fullscreenButton);
fullscreenControls.appendChild(exitFullscreenButton);

leftPanel.insertBefore(fullscreenControls, leftPanel.firstChild);
leftPanel.insertBefore(drawingControls, pdfCanvas);

let currentScale = scale;

function renderPage(num) {
  pageRendering = true;
  pdfDoc.getPage(num).then(function(page) {
    const viewport = page.getViewport({scale: currentScale});
    pdfCanvas.height = viewport.height;
    pdfCanvas.width = viewport.width;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };
    const renderTask = page.render(renderContext);

    renderTask.promise.then(function() {
      pageRendering = false;
      if (pageNumPending !== null) {
        renderPage(pageNumPending);
        pageNumPending = null;
      }
      
      const thumbnails = document.querySelectorAll('.thumbnail');
      thumbnails.forEach(thumb => thumb.classList.remove('selected'));
      thumbnails[num - 1].classList.add('selected');
    });
  });

  pageNumInput.value = num;
}

function queueRenderPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    renderPage(num);
  }
}

function showPrevPage() {
  if (pageNum <= 1) {
    return;
  }
  pageNum--;
  queueRenderPage(pageNum);
}

function showNextPage() {
  if (pageNum >= pdfDoc.numPages) {
    return;
  }
  pageNum++;
  queueRenderPage(pageNum);
}

function renderThumbnails(pdfDoc) {
    thumbnailsDiv.innerHTML = '';

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        pdfDoc.getPage(i).then(page => {
            const viewport = page.getViewport({ scale: 0.3 });
            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.className = 'thumbnail';
            canvas.dataset.page = i;
            thumbnailsDiv.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            page.render(renderContext);

            canvas.addEventListener('click', () => {
                pageNum = i;
                queueRenderPage(pageNum);
            });
        });
    }
}

function toggleDrawing(enable) {
    drawingMode = enable;
    if (enable) {
        enableDrawingButton.classList.add('active');
        pdfCanvas.style.cursor = 'crosshair';
    } else {
        enableDrawingButton.classList.remove('active');
        pdfCanvas.style.cursor = 'default';
    }
}

enableDrawingButton.addEventListener('click', () => {
    toggleDrawing(!drawingMode);
});

pdfCanvas.addEventListener('mousedown', function(e) {
    if (!drawingMode) return;
    lastX = e.offsetX * (pdfCanvas.width / pdfCanvas.offsetWidth);
    lastY = e.offsetY * (pdfCanvas.height / pdfCanvas.offsetHeight);
    isDrawing = true;
});

pdfCanvas.addEventListener('mouseup', function() {
    isDrawing = false;
});

pdfCanvas.addEventListener('mouseout', function() {
    isDrawing = false;
});

pdfCanvas.addEventListener('mousemove', function(e) {
    if (!drawingMode || !isDrawing) return;

    const x = e.offsetX * (pdfCanvas.width / pdfCanvas.offsetWidth);
    const y = e.offsetY * (pdfCanvas.height / pdfCanvas.offsetHeight);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    lastX = x;
    lastY = y;
});

pdfCanvas.addEventListener('wheel', (event) => {
    if (document.fullscreenElement) {
        event.preventDefault();
        const delta = event.deltaY;
        if (delta > 0) {
            currentScale -= 0.1;
        } else {
            currentScale += 0.1;
        }

        currentScale = Math.max(0.5, Math.min(3.0, currentScale));

        renderPage(pageNum);
    }
});

pdfUpload.addEventListener('change', (event) => {
  const file = event.target.files[0];
  const fileReader = new FileReader();

  fileReader.onload = function() {
    const typedArray = new Uint8Array(this.result);

    pdfjsLib.getDocument(typedArray).promise.then(function(pdfDoc_) {
      pdfDoc = pdfDoc_;
      pageNum = 1;
      pageNumInput.setAttribute('max', pdfDoc.numPages);
      renderPage(pageNum);
      renderThumbnails(pdfDoc_);
    });
  };

  fileReader.readAsArrayBuffer(file);
});

prevPageButton.addEventListener('click', showPrevPage);
nextPageButton.addEventListener('click', showNextPage);

pageNumInput.addEventListener('change', () => {
    const pageNumber = parseInt(pageNumInput.value);
    if (pageNumber != pageNum) {
        if (pageNumber <= 0 || pageNumber > pdfDoc.numPages) {
            pageNumInput.value = pageNum;
            return;
        }
        pageNum = pageNumber;
        queueRenderPage(pageNum);
    }
});

function toggleFullscreen() {
    const container = document.documentElement; 
    if (!document.fullscreenElement) {
        container.requestFullscreen()
            .then(() => {
                fullscreenButton.classList.add('active');
                exitFullscreenButton.classList.remove('active');
                // No need to adjust layout here; CSS will handle it
            })
            .catch(err => {
                alert(`Error attempting to enable fullscreen: ${err.message} (${err.name})`);
            });
    } else {
        document.exitFullscreen();
    }
}

function updateFullscreenButton() {
    if (document.fullscreenElement) {
        fullscreenButton.classList.add('active');
        exitFullscreenButton.classList.remove('active');
        fullscreenButton.style.display = 'none';
        exitFullscreenButton.style.display = 'inline-block';
    } else {
        exitFullscreenButton.classList.add('active');
        fullscreenButton.classList.remove('active');
        fullscreenButton.style.display = 'inline-block';
        exitFullscreenButton.style.display = 'none';
    }
}

fullscreenButton.addEventListener('click', () => {
    toggleFullscreen();
});

exitFullscreenButton.addEventListener('click', () => {
    toggleFullscreen();
});

document.addEventListener('fullscreenchange', () => {
    updateFullscreenButton();
});

updateFullscreenButton();