
// JavaScript code
// DOM elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const pdfFileInput = document.getElementById('pdfFileInput');
const selectPdfButton = document.getElementById('selectPdfButton');
const pdfPreviewGrid = document.getElementById('pdfPreviewGrid');
const rotatePdfDownloadBtn = document.getElementById('rotatePdfDownloadBtn');
const addMoreFilesButton = document.getElementById('addMoreFilesButton');
const downloadPopupOverlay = document.getElementById('downloadPopupOverlay');
const downloadProgressBar = document.getElementById('downloadProgressBar');
const downloadTimeInfo = document.getElementById('downloadTimeInfo');
const fixedRightButtons = document.getElementById('fixedRightButtons');
const fixedBottomRight = document.getElementById('fixedBottomRight');


// Global array to store PDF page data (id, original_file_id, page_number, rotation, selected, filename)
let pdfPagesData = [];
let totalPreviewsExpected = 0; // Total pages expected to load (after all files are processed by server)
let totalPreviewsLoaded = 0; // To track actual image previews loaded in DOM

// Function to show Step 2 and hide Step 1
function showStep2() {
    step1.style.display = 'none';
    step2.style.display = 'block';
    fixedRightButtons.style.display = 'flex'; // Show fixed buttons
    fixedBottomRight.style.display = 'block'; // Show download button
}

// Function to show Step 1 and hide Step 2
function showStep1() {
    step1.style.display = 'block';
    step2.style.display = 'none';
    fixedRightButtons.style.display = 'none'; // Hide fixed buttons
    fixedBottomRight.style.display = 'none'; // Hide download button
    pdfPreviewGrid.innerHTML = ''; // Clear previews
    pdfPagesData = []; // Clear data
    totalPreviewsExpected = 0;
    totalPreviewsLoaded = 0;
    updateDownloadButtonState(); // Ensure button is disabled
}

// Initial state setup (hide step2 related elements)
document.addEventListener('DOMContentLoaded', () => {
    showStep1(); // Ensure Step 1 is visible and Step 2 is hidden on page load
});

// Function to update the download button state
function updateDownloadButtonState() {
    if (totalPreviewsLoaded > 0 && totalPreviewsLoaded === totalPreviewsExpected) {
        rotatePdfDownloadBtn.classList.add('active');
        rotatePdfDownloadBtn.removeAttribute('disabled');
    } else {
        rotatePdfDownloadBtn.classList.remove('active');
        rotatePdfDownloadBtn.setAttribute('disabled', 'true');
    }
}

// Function to create and append a PDF page preview card
function createPdfPageCard(page) {
    const card = document.createElement('div');
    card.classList.add('pdf-page-card');
    card.setAttribute('data-id', page.id); // Unique ID for drag and drop
    card.setAttribute('data-original-file-id', page.original_file_id); // Original PDF ID
    card.setAttribute('data-page-number', page.page_number); // Original page number
    card.setAttribute('data-rotation', page.rotation); // Store current rotation
    card.setAttribute('data-selected', page.selected); // Store current selected state
    card.setAttribute('draggable', 'true'); // Make it draggable

    const pageIcons = document.createElement('div');
    pageIcons.classList.add('page-icons');

    // Rotate icon
    const rotateIcon = document.createElement('span');
    rotateIcon.classList.add('icon-button', 'rotate');
    rotateIcon.title = 'Rotate Page';
    rotateIcon.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent drag from starting if clicked on icon
        let currentRotation = parseInt(card.dataset.rotation);
        currentRotation = (currentRotation + 90) % 360;
        card.dataset.rotation = currentRotation; // Update data attribute
        card.querySelector('.preview-image').style.transform = `rotate(${currentRotation}deg)`;

        // Update data in global array
        const pageIndex = pdfPagesData.findIndex(p => p.id === page.id);
        if (pageIndex !== -1) {
            pdfPagesData[pageIndex].rotation = currentRotation;
        }
    });
    pageIcons.appendChild(rotateIcon);

    // Remove icon
    const removeIcon = document.createElement('span');
    removeIcon.classList.add('icon-button', 'remove');
    removeIcon.title = 'Remove Page';
    removeIcon.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent drag from starting if clicked on icon
        const pageIdToRemove = card.dataset.id;
        const originalFileId = card.dataset.originalFileId;

        // Optimistically remove from DOM
        card.remove();

        // Remove from global array
        pdfPagesData = pdfPagesData.filter(p => p.id !== pageIdToRemove);
        totalPreviewsExpected--; // Decrement expected count
        totalPreviewsLoaded--; // If it was loaded, decrement loaded count too
        updateDownloadButtonState();

        if (pdfPagesData.length === 0) {
            showStep1(); // Redirect to Step 1 if all pages are removed
        }

        // Send AJAX request to server to delete physical file
        try {
            const formData = new FormData();
            formData.append('action', 'deletePage');
            formData.append('pageId', pageIdToRemove);
            formData.append('originalFileId', originalFileId); // Pass original file ID for cleanup

            const response = await fetch('api.php', { // **Changed to api.php**
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            if (!result.success) {
                console.error('Server side delete failed:', result.message);
                alert('Failed to delete page on server: ' + result.message);
                // Potentially re-add card or show error to user if deletion failed
            } else {
                console.log('Page deleted on server:', pageIdToRemove);
            }
        } catch (error) {
            console.error('Error during AJAX delete:', error);
            alert('An error occurred while deleting page: ' + error.message);
        }
    });
    pageIcons.appendChild(removeIcon);

    // Select/Deselect icon
    const selectIcon = document.createElement('span');
    selectIcon.classList.add('icon-button');
    if (page.selected) {
        selectIcon.classList.add('select'); // Default to selected
        selectIcon.title = 'Deselect Page';
    } else {
        selectIcon.classList.add('deselect');
        selectIcon.title = 'Select Page';
    }

    selectIcon.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent drag from starting if clicked on icon
        const pageIndex = pdfPagesData.findIndex(p => p.id === page.id);
        if (pageIndex !== -1) {
            const isSelected = pdfPagesData[pageIndex].selected;
            pdfPagesData[pageIndex].selected = !isSelected;
            card.dataset.selected = !isSelected; // Update data attribute
            selectIcon.classList.toggle('select', !isSelected);
            selectIcon.classList.toggle('deselect', isSelected);
            selectIcon.title = isSelected ? 'Select Page' : 'Deselect Page';
        }
    });
    pageIcons.appendChild(selectIcon);


    // Loading indicator / Progress bar
    const progressBar = document.createElement('div');
    progressBar.classList.add('progress-circle');
    card.appendChild(progressBar);

    const img = document.createElement('img');
    img.classList.add('preview-image');
    img.style.display = 'none'; // Initially hide image
    img.src = page.preview_url;
    img.alt = `Page ${page.page_number + 1}`;
    img.onload = () => {
        progressBar.remove(); // Remove progress bar once image loads
        img.style.display = 'block'; // Show image
        totalPreviewsLoaded++;
        updateDownloadButtonState();
    };
    img.onerror = () => {
        progressBar.remove();
        img.style.display = 'block'; // Still show, but maybe a broken image icon
        img.alt = 'Error loading preview';
        // Fallback SVG image for broken previews
        img.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22200%22%20height%3D%22200%22%20viewBox%3D%220%200%20200%20200%22%3E%3Crect%20width%3D%22200%22%20height%3D%22200%22%20fill%3D%22%23f0f0f0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-family%3D%22Arial%22%20font-size%3D%2224%22%20fill%3D%22%23999%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3EError%3C%2Ftext%3E%3C%2Fsvg%3E';
        console.error("Failed to load image:", page.preview_url);
        totalPreviewsLoaded++; // Still count as loaded to unblock download button
        updateDownloadButtonState();
    };
    card.appendChild(img);

    const filenameText = document.createElement('div');
    filenameText.classList.add('page-filename');
    filenameText.textContent = page.filename;
    card.appendChild(filenameText);

    card.appendChild(pageIcons);

    return card;
}

// Event listener for the "Select PDF file" button
selectPdfButton.addEventListener('click', () => {
    pdfFileInput.click(); // Trigger the hidden file input click
});

// Event listener for "Add More Files" button (similar to select PDF, but for existing step2)
addMoreFilesButton.addEventListener('click', () => {
     pdfFileInput.click(); // Re-trigger the file input
});


// Event listener for the hidden file input
pdfFileInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files.length === 0) {
        return; // No files selected
    }

    // Clear previous previews if new files are selected from Step 1
    if (step1.style.display === 'block' || pdfPagesData.length === 0) {
         pdfPagesData = [];
         pdfPreviewGrid.innerHTML = '';
         totalPreviewsExpected = 0;
         totalPreviewsLoaded = 0;
    }

    showStep2(); // Show Step 2 immediately

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('pdfFiles[]', files[i]);
    }
    formData.append('action', 'uploadPdf');

    try {
        // You could show a global overlay/spinner here if the upload/processing takes time
        // For now, reliance on per-page progress bars.

        const response = await fetch('api.php', { // **Changed to api.php**
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Upload Result:', result);

        if (result.success) {
            result.uploaded_files_data.forEach(fileData => {
                fileData.pages.forEach(page => {
                    pdfPagesData.push(page); // Add page data to global array
                    const card = createPdfPageCard(page);
                    pdfPreviewGrid.appendChild(card);
                    totalPreviewsExpected++;
                });
            });
            updateDownloadButtonState(); // Update button state after adding all expected pages
        } else {
            alert('Error: ' + result.message);
            if (pdfPagesData.length === 0) { // If no files were previously loaded, go back to step 1
               showStep1();
            }
        }
    } catch (error) {
        console.error('Upload Error:', error);
        alert('An error occurred during file upload or processing: ' + error.message);
        if (pdfPagesData.length === 0) { // If no files were previously loaded, go back to step 1
           showStep1();
        }
    } finally {
        // Reset the file input to allow selecting the same file again if needed
        pdfFileInput.value = '';
    }
});


// --- Drag and Drop functionality ---
let draggedItem = null;

pdfPreviewGrid.addEventListener('dragstart', (e) => {
    // Check if the drag started on an icon within the card
    if (e.target.closest('.icon-button')) {
        e.preventDefault(); // Do not allow drag if icon is clicked
        return;
    }

    draggedItem = e.target.closest('.pdf-page-card'); // Ensure we drag the whole card
    if (draggedItem) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedItem.dataset.id);
        setTimeout(() => {
            draggedItem.classList.add('dragging');
        }, 0);
    }
});

pdfPreviewGrid.addEventListener('dragover', (e) => {
    e.preventDefault(); // Allow drop
    const afterElement = getDragAfterElement(pdfPreviewGrid, e.clientX, e.clientY);
    const draggable = document.querySelector('.dragging');
    if (draggable && draggable !== afterElement) { // Ensure not dropping on itself
        if (afterElement == null) { // If it's the last element
            pdfPreviewGrid.appendChild(draggable);
        } else {
            pdfPreviewGrid.insertBefore(draggable, afterElement);
        }
    }
});

pdfPreviewGrid.addEventListener('drop', (e) => {
    e.preventDefault();
    const draggable = document.querySelector('.dragging');
    if (draggable) {
        draggable.classList.remove('dragging');
        draggedItem = null; // Clear dragged item
        updatePdfPagesDataOrder(); // Update the underlying data array order
    }
});

pdfPreviewGrid.addEventListener('dragend', () => {
    const draggable = document.querySelector('.dragging');
    if (draggable) {
        draggable.classList.remove('dragging');
    }
    draggedItem = null;
});

// Helper function for drag and drop to find where to insert
function getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('.pdf-page-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        // Calculate the center of the child's bounding box
        const childCenterX = box.left + box.width / 2;
        const childCenterY = box.top + box.height / 2;

        // Determine if the mouse pointer is to the left or right of the child's center
        // and above or below its center. For a grid, you'd typically want to reorder
        // based on which "slot" the dragged item is being hovered over.
        // This is a simplified horizontal check. For a true grid, a more complex
        // calculation (e.g., finding the closest grid cell) would be needed.
        
        // This simple logic attempts to place before if mouse is in left half.
        // For a grid, you might check if (x < childCenterX && y is within row range)
        // or find the element whose center is closest to the mouse.
        const offset = x - box.left;
        if (offset < box.width / 2 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: -Infinity, element: null }).element;
}


// Function to update the global pdfPagesData array order after drag and drop
function updatePdfPagesDataOrder() {
    const orderedIds = Array.from(pdfPreviewGrid.children).map(card => card.dataset.id);
    const newPdfPagesData = [];
    orderedIds.forEach(id => {
        const page = pdfPagesData.find(p => p.id === id);
        if (page) {
            newPdfPagesData.push(page);
        }
    });
    pdfPagesData = newPdfPagesData;
    console.log('PDF Pages Data Order Updated:', pdfPagesData.map(p => p.id));
}

// --- Download Button Functionality ---
rotatePdfDownloadBtn.addEventListener('click', async () => {
    if (!rotatePdfDownloadBtn.classList.contains('active')) {
        return; // Do nothing if button is inactive
    }

    const selectedPages = pdfPagesData.filter(page => page.selected);

    if (selectedPages.length === 0) {
        alert('Please select at least one page to download.');
        return;
    }

    downloadPopupOverlay.style.display = 'flex'; // Show download pop-up
    downloadProgressBar.style.width = '0%';
    downloadProgressBar.textContent = '0%';
    downloadTimeInfo.textContent = 'Processing PDF...';

    const formData = new FormData();
    formData.append('action', 'processAndDownloadPdf');
    formData.append('pdfPagesData', JSON.stringify(selectedPages)); // Send selected pages data

    try {
        const startTime = Date.now();
        const response = await fetch('api.php', { // **Changed to api.php**
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error! status: ${response.status}, message: ${errorText}`);
        }

        // Check if the response is JSON (meaning an error from server) or a file download
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            if (!result.success) {
                throw new Error('Server processing failed: ' + result.message);
            }
        } else {
            // It's a file download. Browser will handle it.
            // For a more accurate "download complete" state, we manually create a blob and trigger download.
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Attempt to get filename from content-disposition header, fallback to generic name
            a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || `split_pdf_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url); // Clean up URL object

            const endTime = Date.now();
            const timeTaken = (endTime - startTime) / 1000; // in seconds

            downloadProgressBar.style.width = '100%';
            downloadProgressBar.textContent = '100%';
            downloadTimeInfo.textContent = `Download complete in ${timeTaken.toFixed(2)} seconds.`;

            // Keep popup for a short while then hide and reset to step 1
            setTimeout(() => {
                downloadPopupOverlay.style.display = 'none';
                showStep1(); // Reset to Step 1 after successful download
            }, 3000); // Hide after 3 seconds
        }

    } catch (error) {
        console.error('Download Error:', error);
        downloadProgressBar.style.width = '0%';
        downloadProgressBar.textContent = 'Error!';
        downloadTimeInfo.textContent = 'An error occurred: ' + error.message;
        alert('Download failed: ' + error.message);
        // Keep popup open for user to read error, then hide
        setTimeout(() => {
            downloadPopupOverlay.style.display = 'none';
        }, 5000); // Hide after 5 seconds on error
    }
});