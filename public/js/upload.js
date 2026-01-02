$(document).ready(function() {
    const $form = $('#uploadForm');
    const $fileInput = $('#photo');
    const $fileInputArea = $('#fileInputArea');
    const $previewContainer = $('#previewContainer');
    const $uploadBtn = $('#uploadBtn');
    const $progressContainer = $('#progressContainer');
    const $progressFill = $('#progressFill');
    const $message = $('#message');

    let selectedFile = null;

    // File input change handler
    $fileInput.on('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handleFileSelection(file);
        }
    });

    // Click handler for file input area
    $fileInputArea.on('click', function(e) {
        // Prevent the click from bubbling up and triggering the file input twice
        e.stopPropagation();
        $fileInput.click();
    });

    // Drag and drop functionality
    $fileInputArea.on('dragover', function(e) {
        e.preventDefault();
        $(this).addClass('dragover');
    });

    $fileInputArea.on('dragleave', function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
    });

    $fileInputArea.on('drop', function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
        
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            // Set the file to the input element
            const dt = new DataTransfer();
            dt.items.add(file);
            $fileInput[0].files = dt.files;
            handleFileSelection(file);
        }
    });

    // Handle file selection and preview
    function handleFileSelection(file) {
        selectedFile = file;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            showMessage('Please select a valid image file (JPEG, PNG, or GIF)', 'error');
            return;
        }

        // Validate file size (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            showMessage('File size must be less than 10MB', 'error');
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            $previewContainer.html(`
                <img src="${e.target.result}" alt="Preview" class="preview-image">
                <p style="margin-top: 10px; color: #666; font-size: 14px;">
                    ${file.name} (${formatFileSize(file.size)})
                </p>
            `);
        };
        reader.readAsDataURL(file);

        // Update file input area text
        $fileInputArea.html(`
            <p>✅ Photo selected: ${file.name}</p>
            <p style="font-size: 14px; color: #666; margin-top: 5px;">Click to change photo</p>
        `);

        hideMessage();
    }

    // Form submission handler
    $form.on('submit', function(e) {
        e.preventDefault();

        if (!selectedFile) {
            showMessage('Please select a photo to upload', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('photo', selectedFile);
        formData.append('guestName', $('#guestName').val().trim());
        formData.append('comment', $('#comment').val().trim());

        // Show progress
        $uploadBtn.prop('disabled', true).text('Uploading...');
        $progressContainer.show();
        hideMessage();

        // Simulate progress for better UX
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress > 90) progress = 90;
            $progressFill.css('width', progress + '%');
        }, 200);

        // Upload file
        $.ajax({
            url: '/api/upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                clearInterval(progressInterval);
                $progressFill.css('width', '100%');
                
                setTimeout(() => {
                    $progressContainer.hide();
                    showMessage(response.message || 'Photo uploaded successfully!', 'success');
                    
                    // Reset form after successful upload
                    setTimeout(() => {
                        resetForm();
                        // Optionally redirect to slideshow
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 2000);
                    }, 1500);
                }, 500);
            },
            error: function(xhr) {
                clearInterval(progressInterval);
                $progressContainer.hide();
                
                let errorMessage = 'Upload failed. Please try again.';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }
                
                showMessage(errorMessage, 'error');
                $uploadBtn.prop('disabled', false).text('🚀 Upload Photo');
            }
        });
    });

    // Utility functions
    function showMessage(text, type) {
        $message.removeClass('success error').addClass(type).text(text).show();
    }

    function hideMessage() {
        $message.hide();
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function resetForm() {
        $form[0].reset();
        selectedFile = null;
        $previewContainer.empty();
        $fileInputArea.html(`
            <p>📁 Click here or drag & drop your photo</p>
            <p style="font-size: 14px; color: #666; margin-top: 5px;">JPEG, PNG, GIF up to 10MB</p>
        `);
        $uploadBtn.prop('disabled', false).text('🚀 Upload Photo');
        $progressFill.css('width', '0%');
    }
});