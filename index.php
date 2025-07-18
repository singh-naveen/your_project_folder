
<?php
// PHP constants or session setup if needed for the main page.
// For this application, most PHP logic moves to api.php.

// Ensure the temporary uploads directory exists.
// This is also defined in api.php, but good to have a check here if needed for direct access.
const UPLOAD_DIR = __DIR__ . '/temp_uploads/';
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0777, true); // Create with full permissions for easy testing
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF Splitter</title>
    <link rel="stylesheet" href="style.css"> </head>
<body>

    <div class="container">
        <div id="step1">
            <h1>Split PDF file</h1>
            <p>Separate one page or a whole set for easy conversion into independent PDF files.</p>
            <input type="file" id="pdfFileInput" accept="application/pdf" class="hidden-file-input" multiple>
            <button class="select-button" id="selectPdfButton">Select PDF file</button>
            <div class="cloud-icons">
                <img src="https://img.icons8.com/color/48/000000/google-drive.png" alt="Google Drive">
                <img src="https://img.icons8.com/color/48/000000/dropbox.png" alt="Dropbox">
            </div>
        </div>

        <div id="step2">
            <h2>Manage PDF Pages</h2>
            <div class="pdf-preview-grid" id="pdfPreviewGrid">
                </div>
        </div>
    </div>

    <div class="fixed-right-buttons" id="fixedRightButtons">
        <button class="fixed-button settings" title="Settings">⚙️</button>
        <button class="fixed-button add-file" title="Add More Files" id="addMoreFilesButton">➕</button>
        <button class="fixed-button sort-file" title="Sort Files">⬇️⬆️</button>
    </div>

    <div class="fixed-bottom-right">
        <button id="rotatePdfDownloadBtn">Rotate PDF Download <span style="font-size: 1.5em; line-height: 1;">➔</span></button>
    </div>

    <div class="download-popup-overlay" id="downloadPopupOverlay">
        <div class="download-popup-content">
            <h3>Processing & Downloading...</h3>
            <div class="progress-bar-container">
                <div class="progress-bar" id="downloadProgressBar" style="width: 0%;">0%</div>
            </div>
            <p class="download-info" id="downloadTimeInfo">Please wait...</p>
        </div>
    </div>

    <script src="script.js"></script> </body>
</html>