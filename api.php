
<?php
// PHP backend logic for AJAX requests
error_reporting(E_ALL);
ini_set('display_errors', 1);

const UPLOAD_DIR = __DIR__ . '/temp_uploads/'; // Relative to api.php location

// Ensure the upload directory exists and is writable
if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0777, true); // For testing, adjust for production
}

// Function to recursively delete a directory and its contents
function deleteDir($dirPath) {
    if (!is_dir($dirPath)) {
        return false;
    }
    if (substr($dirPath, strlen($dirPath) - 1, 1) != '/') {
        $dirPath .= '/';
    }
    $files = glob($dirPath . '*', GLOB_MARK);
    foreach ($files as $file) {
        if (is_dir($file)) {
            deleteDir($file);
        } else {
            unlink($file);
        }
    }
    rmdir($dirPath);
    return true;
}

// Check if it's an AJAX request
if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) == 'xmlhttprequest') {
    if (isset($_POST['action'])) {
        switch ($_POST['action']) {
            case 'uploadPdf':
                handlePdfUpload();
                break;
            case 'processAndDownloadPdf':
                processAndDownloadPdf();
                break;
            case 'deletePage':
                deletePage();
                break;
            default:
                echo json_encode(['success' => false, 'message' => 'Invalid action.']);
                exit;
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'No action specified.']);
        exit;
    }
} else {
    // If it's not an AJAX request, prevent direct access
    // You can redirect to index.php or show an error
    http_response_code(403);
    echo "Direct access not allowed.";
    exit;
}

// Function to handle PDF upload and preview generation
function handlePdfUpload() {
    $response = ['success' => false, 'message' => ''];
    $uploaded_files_data = [];

    if (!empty($_FILES['pdfFiles']['name'][0])) {
        $total_files = count($_FILES['pdfFiles']['name']);

        for ($i = 0; $i < $total_files; $i++) {
            $file_name = $_FILES['pdfFiles']['name'][$i];
            $file_tmp_name = $_FILES['pdfFiles']['tmp_name'][($i)];
            $file_type = $_FILES['pdfFiles']['type'][($i)];
            $file_error = $_FILES['pdfFiles']['error'][($i)];
            $file_size = $_FILES['pdfFiles']['size'][($i)];

            // Basic validation
            if ($file_error !== UPLOAD_ERR_OK) {
                $response['message'] = "Upload error for " . htmlspecialchars($file_name) . ": " . getFileUploadErrorMessage($file_error);
                echo json_encode($response);
                exit;
            }
            if ($file_type !== 'application/pdf') {
                $response['message'] = "Invalid file type for " . htmlspecialchars($file_name) . ". Only PDF files are allowed.";
                echo json_encode($response);
                exit;
            }
            // Add more stringent size checks if needed (e.g., max file size)

            // Create a unique directory for this specific PDF file's pages
            $unique_file_id = uniqid('pdf_'); // Unique ID for the uploaded PDF file itself
            $file_upload_dir = UPLOAD_DIR . $unique_file_id . '/';
            if (!mkdir($file_upload_dir, 0777, true)) {
                $response['message'] = "Failed to create directory for " . htmlspecialchars($file_name) . ".";
                echo json_encode($response);
                exit;
            }

            $target_pdf_path = $file_upload_dir . 'original_'. basename($file_name); // Store original PDF with a unique name
            
            if (move_uploaded_file($file_tmp_name, $target_pdf_path)) {
                // Determine the number of pages in the PDF first
                // Using ImageMagick: convert input.pdf -format %n info:
                $page_count_cmd = "convert " . escapeshellarg($target_pdf_path) . " -format %n info:";
                $page_count_output = shell_exec($page_count_cmd);
                $page_count = (int)trim($page_count_output);

                if ($page_count === 0) {
                    $response['message'] = "Could not determine page count for " . htmlspecialchars($file_name) . " or file is empty.";
                    // Clean up temp dir
                    deleteDir($file_upload_dir);
                    echo json_encode($response);
                    exit;
                }

                $pages_data = [];
                for ($p = 0; $p < $page_count; $p++) {
                    $output_image_path = $file_upload_dir . "page_{$p}.jpg";
                    // -density for better quality, -quality for compression
                    $convert_cmd = "convert -density 150 -quality 80 " . escapeshellarg($target_pdf_path . "[{$p}]") . " " . escapeshellarg($output_image_path) . " 2>&1";
                    $output = shell_exec($convert_cmd);

                    if (file_exists($output_image_path)) {
                        // We need the URL to access the image from the browser
                        // Construct the URL relative to the web root.
                        // Assuming temp_uploads is directly accessible via HTTP relative to the index.php.
                        // Path from web root (where index.php resides) to the image
                        $preview_url = str_replace(realpath(__DIR__ . '/../'), '', realpath($output_image_path)); // Adjust if web root is different
                        $preview_url = str_replace('\\', '/', $preview_url); // Fix for Windows paths
                        $preview_url = ltrim($preview_url, '/'); // Ensure no leading slash or double slash

                        $pages_data[] = [
                            'id' => $unique_file_id . '_page_' . $p, // Unique ID for each page preview across all PDFs
                            'original_file_id' => $unique_file_id, // ID of the original uploaded PDF
                            'page_number' => $p,
                            'preview_url' => $preview_url,
                            'rotation' => 0, // Initial rotation
                            'selected' => true, // By default selected
                            'filename' => htmlspecialchars($file_name) // Store original filename for display
                        ];
                    } else {
                        // Error during conversion for this page
                        error_log("ImageMagick conversion failed for {$target_pdf_path}[{$p}]: " . $output);
                        $response['message'] = "Failed to generate preview for page {$p} of " . htmlspecialchars($file_name) . ". Check server logs.";
                        deleteDir($file_upload_dir);
                        echo json_encode($response);
                        exit;
                    }
                }
                $uploaded_files_data[] = [
                    'unique_file_id' => $unique_file_id, // Return this to client to map pages to original file
                    'original_pdf_path' => $target_pdf_path, // Full path to the original PDF
                    'pages' => $pages_data
                ];

            } else {
                $response['message'] = "Failed to move uploaded file: " . htmlspecialchars($file_name) . ".";
                deleteDir($file_upload_dir); // Clean up partially created dir
                echo json_encode($response);
                exit;
            }
        }

        $response['success'] = true;
        $response['message'] = 'Files uploaded and processed successfully.';
        $response['uploaded_files_data'] = $uploaded_files_data;
    } else {
        $response['message'] = 'No files uploaded.';
    }

    echo json_encode($response);
    exit;
}

// Function to handle the final PDF processing and download
function processAndDownloadPdf() {
    $response = ['success' => false, 'message' => ''];
    $processed_pages_data = json_decode($_POST['pdfPagesData'], true);

    if (empty($processed_pages_data)) {
        $response['message'] = 'No pages selected for download.';
        echo json_encode($response);
        exit;
    }

    $temp_output_dir = UPLOAD_DIR . uniqid('final_pdf_');
    if (!mkdir($temp_output_dir, 0777, true)) {
        $response['message'] = 'Failed to create final output directory.';
        echo json_encode($response);
        exit;
    }

    $input_images_for_final_pdf = [];
    $original_pdf_dirs_to_clean = []; // To track which original PDF directories to clean up

    foreach ($processed_pages_data as $page_data) {
        if ($page_data['selected']) {
            $original_file_id = $page_data['original_file_id'];
            $page_number = $page_data['page_number'];
            $rotation = $page_data['rotation'];

            $original_pdf_dir = UPLOAD_DIR . $original_file_id . '/';
            // Find the original PDF file within its unique directory
            $original_pdf_files = glob($original_pdf_dir . 'original_*');
            $original_pdf_path = !empty($original_pdf_files) ? $original_pdf_files[0] : null;

            if ($original_pdf_path && file_exists($original_pdf_path)) {
                $temp_rotated_image_path = $temp_output_dir . '/' . $page_data['id'] . '_rotated.jpg';

                // Command to extract specific page, apply rotation, and save as a new temp image
                $rotation_angle = '';
                if ($rotation === 90) $rotation_angle = '-rotate 90';
                else if ($rotation === 180) $rotation_angle = '-rotate 180';
                else if ($rotation === 270) $rotation_angle = '-rotate 270';

                // Use escapeshellarg for all arguments to prevent command injection
                $cmd = "convert " . escapeshellarg($original_pdf_path . "[{$page_number}]") . " {$rotation_angle} -quality 90 " . escapeshellarg($temp_rotated_image_path) . " 2>&1";
                $output = shell_exec($cmd);

                if (file_exists($temp_rotated_image_path)) {
                    $input_images_for_final_pdf[] = $temp_rotated_image_path;
                } else {
                    error_log("Failed to process and rotate page {$page_data['id']}. Command: {$cmd}. Output: {$output}");
                    $response['message'] = "Failed to process page for download: {$page_data['id']}";
                    deleteDir($temp_output_dir); // Clean up temp files
                    echo json_encode($response);
                    exit;
                }
            } else {
                error_log("Original PDF not found for page {$page_data['id']} at path: " . $original_pdf_path);
                $response['message'] = "Original PDF not found for page: {$page_data['id']}";
                deleteDir($temp_output_dir);
                echo json_encode($response);
                exit;
            }

            // Add the original PDF's directory to the list for cleanup
            $original_pdf_dirs_to_clean[$original_file_id] = $original_pdf_dir;
        }
    }

    if (empty($input_images_for_final_pdf)) {
        $response['message'] = 'No selected pages to combine.';
        deleteDir($temp_output_dir);
        echo json_encode($response);
        exit;
    }

    // Combine all processed images into a single PDF
    $final_pdf_name = 'split_pdf_' . time() . '.pdf';
    $final_pdf_path = $temp_output_dir . '/' . $final_pdf_name;

    // Use ImageMagick to combine images into a PDF
    $image_list = implode('" "', array_map('escapeshellarg', $input_images_for_final_pdf)); // Properly quote paths for shell command
    $combine_cmd = "convert {$image_list} " . escapeshellarg($final_pdf_path) . " 2>&1";
    $output = shell_exec($combine_cmd);

    if (!file_exists($final_pdf_path)) {
        error_log("ImageMagick combine failed. Command: {$combine_cmd}. Output: {$output}");
        $response['message'] = 'Failed to create final PDF. Check server logs.';
        deleteDir($temp_output_dir);
        echo json_encode($response);
        exit;
    }

    // Send the file for download
    header('Content-Description: File Transfer');
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . basename($final_pdf_path) . '"');
    header('Expires: 0');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    header('Content-Length: ' . filesize($final_pdf_path));
    ob_clean(); // Clean any output buffers
    flush();    // Flush system output buffer
    readfile($final_pdf_path); // Read the file and output it to the browser

    // Clean up all temporary files created for this download and original PDF directories
    deleteDir($temp_output_dir);
    foreach ($original_pdf_dirs_to_clean as $dir_id => $dir_path) {
        // Ensure that the original PDF dir exists and is empty or contains only its original PDF
        // before attempting to delete it. This prevents errors if pages from the same PDF were deleted earlier.
        $files_in_original_dir = array_diff(scandir($dir_path), array('.', '..'));
        if (empty($files_in_original_dir)) { // If dir is empty, delete it
            rmdir($dir_path);
        } else if (count($files_in_original_dir) === 1 && strpos($files_in_original_dir[0], 'original_') === 0) {
            // If only the original PDF remains, delete it and the directory
            unlink($dir_path . $files_in_original_dir[0]);
            rmdir($dir_path);
        }
    }
    exit; // Important: Exit after file download to prevent further HTML output
}

// Function to delete a specific page's preview and potentially original PDF data
function deletePage() {
    $response = ['success' => false, 'message' => ''];
    $page_id = $_POST['pageId'] ?? null;
    $original_file_id = $_POST['originalFileId'] ?? null;

    if (!$page_id || !$original_file_id) {
        $response['message'] = 'Invalid page ID or original file ID for deletion.';
        echo json_encode($response);
        exit;
    }

    $original_pdf_dir = UPLOAD_DIR . $original_file_id . '/';
    // The page_id is like 'pdf_XXXX_page_Y', we need to extract 'page_Y.jpg'
    // This is more robust: we stored the preview image as 'page_Y.jpg' in the PHP handlePdfUpload function
    $preview_image_filename = 'page_' . explode('_page_', $page_id)[1] . '.jpg';
    $preview_image_path = $original_pdf_dir . $preview_image_filename;
    
    // Delete the preview image
    if (file_exists($preview_image_path)) {
        unlink($preview_image_path);
    }

    // Check if the directory is now empty or only contains the original PDF
    $remaining_files = array_diff(scandir($original_pdf_dir), array('.', '..'));
    
    if (empty($remaining_files)) {
        // Directory is completely empty, delete it
        rmdir($original_pdf_dir);
    } else if (count($remaining_files) === 1 && strpos($remaining_files[0], 'original_') === 0) {
        // Only the original PDF file remains, delete it and the directory
        unlink($original_pdf_dir . $remaining_files[0]);
        rmdir($original_pdf_dir);
    }
    
    $response['success'] = true;
    $response['message'] = 'Page deleted.';
    echo json_encode($response);
    exit;
}

// Helper function to get readable upload error messages
function getFileUploadErrorMessage($error_code) {
    switch ($error_code) {
        case UPLOAD_ERR_INI_SIZE:
            return 'The uploaded file exceeds the upload_max_filesize directive in php.ini.';
        case UPLOAD_ERR_FORM_SIZE:
            return 'The uploaded file exceeds the MAX_FILE_SIZE directive that was specified in the HTML form.';
        case UPLOAD_ERR_PARTIAL:
            return 'The uploaded file was only partially uploaded.';
        case UPLOAD_ERR_NO_FILE:
            return 'No file was uploaded.';
        case UPLOAD_ERR_NO_TMP_DIR:
            return 'Missing a temporary folder.';
        case UPLOAD_ERR_CANT_WRITE:
            return 'Failed to write file to disk.';
        case UPLOAD_ERR_EXTENSION:
            return 'A PHP extension stopped the file upload.';
        default:
            return 'Unknown upload error.';
    }
}
?>