$(document).ready(function () {
    let photos = [];
    let currentSlide = 0;
    let slideInterval = null;
    let isPaused = false;
    let isLoading = false;
    let isAdmin = false;

    const $slideshowContainer = $('.slideshow-container');
    const $welcomeScreen = $('#welcomeScreen');
    const $photoCounter = $('#photoCounter');
    const $loadingIndicator = $('#loadingIndicator');
    const $pauseBtn = $('#pauseBtn');
    const $prevBtn = $('#prevBtn');
    const $nextBtn = $('#nextBtn');
    const $qrBtn = $('#qrBtn');
    const $qrModal = $('#qrModal');
    const $closeQrModal = $('#closeQrModal');
    const $adminIndicator = $('#adminIndicator');

    // Initialize slideshow
    init();

    function init() {
        checkAdminStatus();
        generateQRCode();
        loadPhotos();
        setupControls();

        // Start polling for new photos every 5 seconds
        setInterval(loadPhotos, 5000);

        // Check admin status periodically (every 30 seconds)
        setInterval(checkAdminStatus, 30000);
    }

    function checkAdminStatus() {
        $.ajax({
            url: '/api/admin/status',
            type: 'GET',
            success: function (response) {
                const wasAdmin = isAdmin;
                isAdmin = response.success && response.isAuthenticated;

                // Update controls visibility if admin status changed
                if (wasAdmin !== isAdmin) {
                    console.log(`Admin status changed: ${wasAdmin} → ${isAdmin}`);
                    updateControlsVisibility();
                }
            },
            error: function () {
                const wasAdmin = isAdmin;
                isAdmin = false;

                // Update controls visibility if admin status changed
                if (wasAdmin !== isAdmin) {
                    console.log(`Admin status changed: ${wasAdmin} → ${isAdmin}`);
                    updateControlsVisibility();
                }
            }
        });
    }

    function updateControlsVisibility() {
        if (isAdmin) {
            // Show all controls for admin with smooth transition
            $pauseBtn.removeClass('hidden').show();
            $prevBtn.removeClass('hidden').show();
            $nextBtn.removeClass('hidden').show();
            $qrBtn.removeClass('hidden').show();

            // Show admin indicator and update photo counter style
            $adminIndicator.addClass('visible');
            $photoCounter.addClass('admin-mode');

            console.log('Admin controls enabled');
        } else {
            // Hide slideshow controls for regular users, keep only Upload and Admin
            $pauseBtn.addClass('hidden');
            $prevBtn.addClass('hidden');
            $nextBtn.addClass('hidden');
            $qrBtn.addClass('hidden');

            // Hide admin indicator and remove photo counter admin style
            $adminIndicator.removeClass('visible');
            $photoCounter.removeClass('admin-mode');

            // Hide them completely after transition
            setTimeout(() => {
                if (!isAdmin) {
                    $pauseBtn.hide();
                    $prevBtn.hide();
                    $nextBtn.hide();
                    $qrBtn.hide();
                }
            }, 300);

            console.log('Admin controls disabled');
        }
    }

    function generateQRCode() {
        // Get dynamic QR URL from server
        $.ajax({
            url: '/api/qr-url',
            type: 'GET',
            success: function (response) {
                if (response.success) {
                    const qrUrl = response.url;
                    console.log('Generating QR code for URL:', qrUrl);

                    // Generate QR code for welcome screen
                    const qrElement = document.getElementById('qrcode');
                    if (qrElement && typeof qrcode !== 'undefined') {
                        try {
                            const qr = qrcode(0, 'M');
                            qr.addData(qrUrl);
                            qr.make();

                            // Create QR code as HTML image
                            const qrHtml = qr.createImgTag(4, 8);
                            $('#qrcode').html(qrHtml);
                            console.log('QR Code generated successfully');
                        } catch (error) {
                            console.error('QR Code generation error:', error);
                            $('#qrcode').html('<p>QR Code unavailable</p>');
                        }
                    }

                    // Set upload URL text
                    $('#uploadUrl span').text(qrUrl);
                }
            },
            error: function () {
                console.error('Failed to get QR URL');
                $('#qrcode').html('<p>QR Code unavailable</p>');
            }
        });
    }

    function generateModalQRCode() {
        // Get dynamic QR URL from server
        $.ajax({
            url: '/api/qr-url',
            type: 'GET',
            success: function (response) {
                if (response.success) {
                    const qrUrl = response.url;
                    console.log('Generating modal QR code for:', qrUrl);

                    // Clear previous QR code
                    $('#qrcode-modal').empty();

                    try {
                        // Use qrcode-generator library
                        if (typeof qrcode !== 'undefined') {
                            console.log('Using qrcode-generator library');
                            const qr = qrcode(0, 'M');
                            qr.addData(qrUrl);
                            qr.make();

                            // Create QR code as HTML image
                            const qrHtml = qr.createImgTag(4, 8);
                            $('#qrcode-modal').html(qrHtml);
                            console.log('QR code generated successfully');
                        } else {
                            console.log('QR code library not available');
                            $('#qrcode-modal').html('<p>QR Code library not available</p>');
                        }
                    } catch (error) {
                        console.error('QR Code generation error:', error);
                        $('#qrcode-modal').html('<p>QR Code generation failed</p>');
                    }

                    // Set upload URL text
                    $('#uploadUrl span').text(qrUrl);
                }
            },
            error: function () {
                console.error('Failed to get QR URL');
                $('#qrcode-modal').html('<p>Failed to load QR URL</p>');
            }
        });
    }

    function loadPhotos() {
        if (isLoading) return;

        isLoading = true;
        $loadingIndicator.addClass('visible');

        $.ajax({
            url: '/api/photos',
            type: 'GET',
            success: function (response) {
                if (response.success && response.photos) {
                    const hadPhotos = photos.length > 0;
                    const previousCount = photos.length;

                    // Update photos array
                    photos = response.photos;

                    // Log photo updates for debugging
                    if (photos.length !== previousCount) {
                        console.log(`Photos updated: ${previousCount} → ${photos.length}`);
                    }

                    // Update UI
                    updatePhotoCounter();

                    if (photos.length > 0) {
                        // Hide welcome screen if we have photos
                        if (!hadPhotos) {
                            $welcomeScreen.addClass('hidden');
                            createSlides();
                            startSlideshow();
                        } else {
                            // Update existing slides if new photos were added or order changed
                            updateSlides();
                            // Ensure slideshow is running if we have multiple photos
                            if (photos.length > 1 && !slideInterval) {
                                startSlideshow();
                            }
                        }
                    } else {
                        // Show welcome screen if no photos
                        $welcomeScreen.removeClass('hidden');
                        stopSlideshow();
                    }
                }
            },
            error: function (xhr, status, error) {
                console.error('Failed to load photos:', error);
            },
            complete: function () {
                isLoading = false;
                $loadingIndicator.removeClass('visible');
            }
        });
    }

    function createSlides() {
        // Remove existing slides
        $('.slide').remove();

        // Create slides for each photo
        photos.forEach((photo, index) => {
            const slide = createSlideElement(photo, index);
            $slideshowContainer.append(slide);
        });

        // Show first slide
        if (photos.length > 0) {
            currentSlide = 0;
            $('.slide').eq(currentSlide).addClass('active');
        }
    }

    function updateSlides() {
        const existingSlides = $('.slide').length;
        const newPhotosCount = photos.length;

        // If we have new photos or the order has changed, recreate all slides
        if (newPhotosCount !== existingSlides || hasPhotosOrderChanged()) {
            console.log('Photos changed, recreating slides...');

            // Store current slide index to maintain position if possible
            const wasActive = currentSlide < newPhotosCount;

            // Remove all existing slides
            $('.slide').remove();

            // Create slides for all photos
            photos.forEach((photo, index) => {
                const slide = createSlideElement(photo, index);
                $slideshowContainer.append(slide);
            });

            // Restore active slide or reset to first slide
            if (wasActive && photos.length > 0) {
                $('.slide').eq(currentSlide).addClass('active');
            } else if (photos.length > 0) {
                currentSlide = 0;
                $('.slide').eq(currentSlide).addClass('active');
            }
        }
    }

    // Helper function to detect if photo order has changed
    function hasPhotosOrderChanged() {
        const existingSlides = $('.slide');
        if (existingSlides.length !== photos.length) {
            return true;
        }

        // Check if the filenames match the current order
        for (let i = 0; i < Math.min(existingSlides.length, photos.length); i++) {
            const slideImg = $(existingSlides[i]).find('img');
            const expectedSrc = `/uploads/photos/${photos[i].filename}`;
            if (slideImg.attr('src') !== expectedSrc) {
                return true;
            }
        }

        return false;
    }

    function createSlideElement(photo, index) {
        const slide = $(`
            <div class="slide" data-index="${index}">
                <img src="/uploads/photos/${photo.filename}" alt="Photo by ${photo.guestName}" loading="lazy">
                <div class="photo-overlay">
                    <h3>📸 ${photo.guestName}</h3>
                    <p>${photo.comment || 'No caption provided'}</p>
                </div>
            </div>
        `);

        return slide;
    }

    function startSlideshow() {
        if (photos.length <= 1) return;

        stopSlideshow(); // Clear any existing interval

        slideInterval = setInterval(() => {
            if (!isPaused) {
                nextSlide();
            }
        }, 10000); // 10 seconds per slide
    }

    function stopSlideshow() {
        if (slideInterval) {
            clearInterval(slideInterval);
            slideInterval = null;
        }
    }

    function nextSlide() {
        if (photos.length === 0) return;

        $('.slide').eq(currentSlide).removeClass('active');
        currentSlide = (currentSlide + 1) % photos.length;
        $('.slide').eq(currentSlide).addClass('active');

        updatePhotoCounter();
    }

    function prevSlide() {
        if (photos.length === 0) return;

        $('.slide').eq(currentSlide).removeClass('active');
        currentSlide = (currentSlide - 1 + photos.length) % photos.length;
        $('.slide').eq(currentSlide).addClass('active');

        updatePhotoCounter();
    }

    function togglePause() {
        isPaused = !isPaused;
        $pauseBtn.html(isPaused ? '▶️ Play' : '⏸️ Pause');

        if (isPaused) {
            stopSlideshow();
        } else {
            startSlideshow();
        }
    }

    function updatePhotoCounter() {
        if (photos.length === 0) {
            $photoCounter.text('No photos yet');
        } else {
            $photoCounter.text(`Photo ${currentSlide + 1} of ${photos.length}`);
        }
    }

    function setupControls() {
        // Set initial controls visibility
        updateControlsVisibility();

        $pauseBtn.on('click', togglePause);
        $nextBtn.on('click', nextSlide);
        $prevBtn.on('click', prevSlide);

        // QR Code modal controls
        $qrBtn.on('click', function () {
            const uploadUrl = `${window.location.origin}/upload.html`;

            // Always show the URL text
            $('#uploadUrl span').text(uploadUrl);

            // Try to generate QR code
            if (typeof QRCode !== 'undefined') {
                console.log('QRCode library available, generating QR code...');
                generateModalQRCode();
            } else {
                console.log('QRCode library not available, showing URL fallback');
                // Fallback: show URL as text
                $('#qrcode-modal').html(`
                    <div style="padding: 20px; text-align: center; border: 2px dashed #ccc; border-radius: 10px;">
                        <p style="margin-bottom: 10px; font-weight: bold;">QR Code Library Not Available</p>
                        <p style="margin-bottom: 15px;">Please visit this URL on your phone:</p>
                        <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; font-family: monospace; word-break: break-all;">
                            ${uploadUrl}
                        </div>
                    </div>
                `);
            }

            $qrModal.addClass('show');
        });

        $closeQrModal.on('click', function () {
            $qrModal.removeClass('show');
        });

        // Close modal when clicking outside
        $qrModal.on('click', function (e) {
            if (e.target === this) {
                $qrModal.removeClass('show');
            }
        });

        // Keyboard controls (only work for admin users)
        $(document).on('keydown', function (e) {
            // Only allow keyboard controls for admin users
            if (!isAdmin) {
                // Allow only escape key for everyone to close modals
                if (e.key === 'Escape') {
                    e.preventDefault();
                    $qrModal.removeClass('show');
                }
                return;
            }

            switch (e.key) {
                case 'ArrowRight':
                case ' ':
                    e.preventDefault();
                    nextSlide();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    prevSlide();
                    break;
                case 'p':
                case 'P':
                    e.preventDefault();
                    togglePause();
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    loadPhotos();
                    break;
                case 'q':
                case 'Q':
                    e.preventDefault();
                    generateModalQRCode();
                    $qrModal.addClass('show');
                    break;
                case 'Escape':
                    e.preventDefault();
                    $qrModal.removeClass('show');
                    break;
            }
        });

        // Show cursor on mouse movement, hide after 3 seconds of inactivity
        let cursorTimeout;
        $(document).on('mousemove', function () {
            $('body').removeClass('hide-cursor');
            clearTimeout(cursorTimeout);
            cursorTimeout = setTimeout(() => {
                $('body').addClass('hide-cursor');
            }, 3000);
        });

        // Initially hide cursor after 3 seconds
        setTimeout(() => {
            $('body').addClass('hide-cursor');
        }, 3000);
    }

    // Handle image load errors
    $(document).on('error', 'img', function () {
        console.error('Failed to load image:', $(this).attr('src'));
        $(this).attr('src', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=');
    });
});