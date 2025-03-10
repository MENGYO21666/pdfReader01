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
    scale = 1,
    ctx = pdfCanvas.getContext('2d');

let drawingMode = false;
let lastX = 0;
let lastY = 0;
let isDrawing = false;

// Add these variables at the top with other state variables
let textMode = false;
let textInput = null;
let selectedFontSize = '16px'; // default size

const enableDrawingButton = document.createElement('button');
enableDrawingButton.textContent = 'Toggle Drawing';
const drawingControls = document.createElement('div');
drawingControls.id = 'drawing-controls';
drawingControls.appendChild(enableDrawingButton);

// Add after creating enableDrawingButton
const cleanDrawingButton = document.createElement('button');
cleanDrawingButton.textContent = 'Clean Drawing';
cleanDrawingButton.id = 'clean-drawing';
drawingControls.appendChild(cleanDrawingButton);

// Create text mode button
const enableTextButton = document.createElement('button');
enableTextButton.textContent = 'Add Text';
enableTextButton.id = 'enable-text';
drawingControls.appendChild(enableTextButton);

// Create font size controls
const fontSizeControls = document.createElement('div');
fontSizeControls.id = 'font-size-controls';

const smallFontButton = document.createElement('button');
smallFontButton.textContent = 'Small';
smallFontButton.id = 'small-font';
smallFontButton.dataset.size = '12px';

const mediumFontButton = document.createElement('button');
mediumFontButton.textContent = 'Medium';
mediumFontButton.id = 'medium-font';
mediumFontButton.dataset.size = '16px';
mediumFontButton.classList.add('active'); // Default active

const largeFontButton = document.createElement('button');
largeFontButton.textContent = 'Large';
largeFontButton.id = 'large-font';
largeFontButton.dataset.size = '24px';

// Add buttons to controls
fontSizeControls.appendChild(smallFontButton);
fontSizeControls.appendChild(mediumFontButton);
fontSizeControls.appendChild(largeFontButton);

// Add font controls after drawing controls
drawingControls.appendChild(fontSizeControls);

// Add after creating drawingControls
const zoomControls = document.createElement('div');
zoomControls.id = 'zoom-controls';

const zoomOutButton = document.createElement('button');
zoomOutButton.textContent = '-';
zoomOutButton.id = 'zoom-out';

const zoomInButton = document.createElement('button');
zoomInButton.textContent = '+';
zoomInButton.id = 'zoom-in';

const zoomResetButton = document.createElement('button');
zoomResetButton.textContent = '100%';
zoomResetButton.id = 'zoom-reset';

zoomControls.appendChild(zoomOutButton);
zoomControls.appendChild(zoomResetButton);
zoomControls.appendChild(zoomInButton);

const midPanel = document.getElementById('mid-panel');

const fullscreenButton = document.createElement('button');
fullscreenButton.textContent = 'Fullscreen';
const exitFullscreenButton = document.createElement('button');
exitFullscreenButton.textContent = 'Exit Fullscreen';

const fullscreenControls = document.createElement('div');
fullscreenControls.id = 'fullscreen-controls';
fullscreenControls.appendChild(fullscreenButton);
fullscreenControls.appendChild(exitFullscreenButton);

midPanel.insertBefore(fullscreenControls, midPanel.firstChild);
midPanel.insertBefore(drawingControls, pdfCanvas);

let currentScale = scale;

// Add these variables at the top of your file
let searchResults = [];
let currentSearchIndex = -1;

// Add this after creating pdfCanvas
const placeholderText = document.createElement('div');
placeholderText.id = 'pdf-placeholder';
placeholderText.textContent = 'Please upload your PDF file';
midPanel.insertBefore(placeholderText, pdfCanvas);

// Add drag and drop functionality
const dropZone = document.getElementById('pdf-placeholder');

// Add these event listeners after creating the pdf-placeholder
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
    dropZone.classList.add('drag-hover');
}

function unhighlight(e) {
    dropZone.classList.remove('drag-hover');
}

dropZone.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    
    if (file && file.type === 'application/pdf') {
        document.querySelector('h1').style.display = 'none';
        dropZone.style.display = 'none';
        
        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedArray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedArray).promise.then(function(pdfDoc_) {
                pdfDoc = pdfDoc_;
                pageNum = 1;
                pageNumInput.setAttribute('max', pdfDoc.numPages);
                renderPage(pageNum);
                renderThumbnails(pdfDoc_);
                
                const totalPagesSpan = document.getElementById('total-pages');
                totalPagesSpan.textContent = ` / ${pdfDoc.numPages}`;
            });
        };
        fileReader.readAsArrayBuffer(file);
    } else {
        alert('Please drop a PDF file');
    }
}

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
  togglePdfControls(true);  // Hide controls when page loads
  
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
    document.querySelector('h1').style.display = 'none';
    document.getElementById('pdf-placeholder').style.display = 'none'; // Hide placeholder
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

            // 更新總頁數顯示
            const totalPagesSpan = document.getElementById('total-pages');
            totalPagesSpan.textContent = ` / ${pdfDoc.numPages}`;
        });
    };

    fileReader.readAsArrayBuffer(file);
});

prevPageButton.addEventListener('click', showPrevPage);
nextPageButton.addEventListener('click', showNextPage);

pageNumInput.addEventListener('change', () => {
    const pageNumber = parseInt(pageNumInput.value);
    if (pageNumber !== pageNum) {
        if (pageNumber <= 0 || pageNumber > pdfDoc.numPages) {
            pageNumInput.value = pageNum;
            return;
        }
        pageNum = pageNumber;
        queueRenderPage(pageNum);
    }
    // 確保總頁數顯示更新（可選，根據需求）
    const totalPagesSpan = document.getElementById('total-pages');
    totalPagesSpan.textContent = ` / ${pdfDoc.numPages}`;
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

// Move these lines to the top of your file
const leftPanel = document.getElementById('left-panel');

// Create a container for the buttons in left panel
const leftPanelControls = document.createElement('div');
leftPanelControls.id = 'left-panel-controls';

// Move PDF upload to left panel
const pdfUploadContainer = document.createElement('div');
pdfUploadContainer.id = 'pdf-upload-container';
pdfUploadContainer.appendChild(pdfUpload);
leftPanelControls.appendChild(pdfUploadContainer);

// Move fullscreen controls to left panel
fullscreenControls.id = 'fullscreen-controls';
leftPanelControls.appendChild(fullscreenControls);

// Move drawing controls to left panel
drawingControls.id = 'drawing-controls';
leftPanelControls.appendChild(drawingControls);

// Add zoom controls to left panel
leftPanelControls.appendChild(zoomControls);

// 添加搜尋控制項到左側面板
const searchContainer = document.createElement('div');
searchContainer.id = 'search-container';

const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.id = 'search-input';
searchInput.placeholder = 'Search...';

const searchButton = document.createElement('button');
searchButton.textContent = 'Search';
searchButton.id = 'search-button';

const searchNavContainer = document.createElement('div');
searchNavContainer.id = 'search-nav-container';

const prevSearchButton = document.createElement('button');
prevSearchButton.textContent = 'prev';
prevSearchButton.id = 'prev-search';
prevSearchButton.disabled = true;

const searchCountDisplay = document.createElement('span');
searchCountDisplay.id = 'search-count';
searchCountDisplay.textContent = '0/0';

const nextSearchButton = document.createElement('button');
nextSearchButton.textContent = 'next';
nextSearchButton.id = 'next-search';
nextSearchButton.disabled = true;

searchNavContainer.appendChild(prevSearchButton);
searchNavContainer.appendChild(searchCountDisplay);
searchNavContainer.appendChild(nextSearchButton);

searchContainer.appendChild(searchInput);
searchContainer.appendChild(searchButton);
searchContainer.appendChild(searchNavContainer);
leftPanelControls.appendChild(searchContainer);

// Add this after leftPanelControls creation
const leftPanelUpload = document.createElement('div');
leftPanelUpload.id = 'left-panel-upload';

const uploadIcon = document.createElement('div');
uploadIcon.className = 'upload-icon';
uploadIcon.innerHTML = '';

const uploadText = document.createElement('div');
uploadText.id = 'left-panel-upload-text';
uploadText.textContent = 'Upload PDF';

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.pdf';
fileInput.id = 'left-panel-file-input';

leftPanelUpload.appendChild(uploadIcon);
leftPanelUpload.appendChild(uploadText);
leftPanelUpload.appendChild(fileInput);

// Insert at the top of left panel controls
leftPanelControls.insertBefore(leftPanelUpload, leftPanelControls.firstChild);

// Add event listeners
leftPanelUpload.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedArray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedArray).promise.then(function(pdfDoc_) {
                pdfDoc = pdfDoc_;
                pageNum = 1;
                pageNumInput.setAttribute('max', pdfDoc.numPages);
                renderPage(pageNum);
                renderThumbnails(pdfDoc_);
                
                const totalPagesSpan = document.getElementById('total-pages');
                if (totalPagesSpan) {
                    totalPagesSpan.textContent = ` / ${pdfDoc.numPages}`;
                }
                
                // Hide placeholder if it exists
                const placeholder = document.getElementById('pdf-placeholder');
                if (placeholder) {
                    placeholder.style.display = 'none';
                }
            });
        };
        fileReader.readAsArrayBuffer(file);
    } else {
        alert('Please select a PDF file');
    }
});

// Add all controls to left panel
leftPanel.appendChild(leftPanelControls);

// Add keyboard navigation event listener
document.addEventListener('keydown', (event) => {
    // Check if we're not in an input field
    if (event.target.tagName !== 'INPUT') {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            showPrevPage();
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            showNextPage();
        }
    }
});

// Add the clean drawing functionality
cleanDrawingButton.addEventListener('click', () => {
    clearDrawing();
});

// Add this function to clear the drawings
function clearDrawing() {
    // Store the current canvas content
    const currentCanvas = pdfCanvas.toDataURL();
    const img = new Image();
    
    img.onload = function() {
        // Clear the entire canvas
        ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        // Re-render the current page
        renderPage(pageNum);
    };
    
    img.src = currentCanvas;
}

// Add text input functionality
function toggleTextMode(enable) {
    textMode = enable;
    if (enable) {
        enableTextButton.classList.add('active');
        pdfCanvas.style.cursor = 'text';
    } else {
        enableTextButton.classList.remove('active');
        pdfCanvas.style.cursor = 'default';
    }
}

enableTextButton.addEventListener('click', () => {
    toggleTextMode(!textMode);
});

pdfCanvas.addEventListener('click', function(e) {
    if (!textMode) return;
    
    // Remove any existing text input
    if (textInput) {
        applyText();
    }
    
    // Create text input
    textInput = document.createElement('textarea');
    textInput.style.position = 'absolute';
    textInput.style.left = e.pageX + 'px';
    textInput.style.top = e.pageY + 'px';
    textInput.style.background = 'transparent';
    textInput.style.border = '1px solid #000';
    textInput.style.padding = '5px';
    textInput.style.minWidth = '100px';
    textInput.style.minHeight = '20px';
    textInput.style.resize = 'both';
    textInput.style.overflow = 'hidden';
    textInput.style.zIndex = '1000';
    textInput.style.fontSize = selectedFontSize;
    
    document.body.appendChild(textInput);
    textInput.focus();
    
    // Handle text input events
    textInput.addEventListener('blur', applyText);
    textInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            applyText();
        }
    });
});

function applyText() {
    if (!textInput || !textInput.value.trim()) {
        textInput?.remove();
        textInput = null;
        return;
    }
    
    const rect = textInput.getBoundingClientRect();
    const canvasRect = pdfCanvas.getBoundingClientRect();
    
    // Convert coordinates relative to canvas
    const x = (rect.left - canvasRect.left) * (pdfCanvas.width / pdfCanvas.offsetWidth);
    const y = (rect.top - canvasRect.top) * (pdfCanvas.height / pdfCanvas.offsetHeight);
    
    // Use selected font size
    ctx.font = `${selectedFontSize} Arial`;
    ctx.fillStyle = '#000000';
    // Adjust y-offset based on font size
    const fontSize = parseInt(selectedFontSize);
    ctx.fillText(textInput.value, x, y + fontSize);
    
    // Clean up
    textInput.remove();
    textInput = null;
}

// Add font size selection handlers
[smallFontButton, mediumFontButton, largeFontButton].forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons
        [smallFontButton, mediumFontButton, largeFontButton].forEach(btn => 
            btn.classList.remove('active'));
        // Add active class to clicked button
        button.classList.add('active');
        selectedFontSize = button.dataset.size;
        if (textInput) {
            textInput.style.fontSize = selectedFontSize;
        }
    });
});

// Add zoom control handlers
zoomInButton.addEventListener('click', () => {
    currentScale += 0.2;
    currentScale = Math.min(3.0, currentScale); // Max zoom 300%
    renderPage(pageNum);
    updateZoomDisplay();
});

zoomOutButton.addEventListener('click', () => {
    currentScale -= 0.2;
    currentScale = Math.max(0.5, currentScale); // Min zoom 50%
    renderPage(pageNum);
    updateZoomDisplay();
});

zoomResetButton.addEventListener('click', () => {
    currentScale = 1.0;
    renderPage(pageNum);
    updateZoomDisplay();
});

function updateZoomDisplay() {
    zoomResetButton.textContent = `${Math.round(currentScale * 100)}%`;
}

function togglePdfControls(show) {
    const elements = [
        document.getElementById('pdf-canvas'),
        document.getElementById('navigation'),
        document.getElementById('page-num')
    ];

    elements.forEach(element => {
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    });
}

// Add at the beginning of your script, after variable declarations
document.addEventListener('DOMContentLoaded', () => {
    togglePdfControls(false);  // Hide controls when page loads
});