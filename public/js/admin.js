$(document).ready(function() {
    let photos = [];
    let photoToDelete = null;

    const $loginContainer = $('#loginContainer');
    const $adminPanel = $('#adminPanel');
    const $loginForm = $('#loginForm');
    const $loginMessage = $('#loginMessage');
    const $loginBtn = $('#loginBtn');
    const $logoutBtn = $('#logoutBtn');
    const $photoGrid = $('#photoGrid');
    const $photoCount = $('#photoCount');
    const $galleryMessage = $('#galleryMessage');
    const $galleryLoading = $('#galleryLoading');
    const $emptyGallery = $('#emptyGallery');
    const $deleteModal = $('#deleteModal');
    const $confirmDelete = $('#confirmDelete');
    const $cancelDelete = $('#cancelDelete');
    const $qrUrlInput = $('#qrUrlInput');
    const $updateQrBtn = $('#updateQrBtn');
    const $resetQrBtn = $('#resetQrBtn');
    const $currentQrUrl = $('#currentQrUrl');
    const $qrMessage = $('#qrMessage');

    // Initialize admin panel
    init();

    function init() {
        checkAuthStatus();
        setupEventHandlers();
    }

    function checkAuthStatus() {
        $.ajax({
            url: '/api/admin/status',
            type: 'GET',
            success: function(response) {
                if (response.success && response.isAuthenticated) {
                    showAdminPanel();
                    loadPhotos();
                    loadCurrentQrUrl();
                } else {
                    showLoginForm();
                }
            },
            error: function() {
                showLoginForm();
            }
        });
    }

    function setupEventHandlers() {
        // Login form submission
        $loginForm.on('submit', function(e) {
            e.preventDefault();
            handleLogin();
        });

        // Logout button
        $logoutBtn.on('click', function() {
            handleLogout();
        });

        // QR URL management
        $updateQrBtn.on('click', function() {
            updateQrUrl();
        });

        $resetQrBtn.on('click', function() {
            resetQrUrl();
        });

        // Delete confirmation modal
        $confirmDelete.on('click', function() {
            if (photoToDelete) {
                deletePhoto(photoToDelete);
            }
        });

        $cancelDelete.on('click', function() {
            hideDeleteModal();
        });

        // Close modal when clicking outside
        $deleteModal.on('click', function(e) {
            if (e.target === this) {
                hideDeleteModal();
            }
        });

        // Keyboard shortcuts
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape') {
                hideDeleteModal();
            }
        });
    }

    function handleLogin() {
        const password = $('#password').val().trim();

        if (!password) {
            showMessage($loginMessage, 'Please enter a password', 'error');
            return;
        }

        $loginBtn.prop('disabled', true).text('Logging in...');
        hideMessage($loginMessage);

        $.ajax({
            url: '/api/admin/login',
            type: 'POST',
            data: { password: password },
            success: function(response) {
                if (response.success) {
                    showMessage($loginMessage, 'Login successful!', 'success');
                    setTimeout(() => {
                        showAdminPanel();
                        loadPhotos();
                        loadCurrentQrUrl();
                    }, 1000);
                } else {
                    showMessage($loginMessage, response.message || 'Login failed', 'error');
                }
            },
            error: function(xhr) {
                let errorMessage = 'Login failed. Please try again.';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }
                showMessage($loginMessage, errorMessage, 'error');
            },
            complete: function() {
                $loginBtn.prop('disabled', false).text('Login');
            }
        });
    }

    function handleLogout() {
        $.ajax({
            url: '/api/admin/logout',
            type: 'POST',
            success: function(response) {
                if (response.success) {
                    showLoginForm();
                    $('#password').val('');
                    showMessage($loginMessage, 'Logged out successfully', 'success');
                }
            },
            error: function() {
                showMessage($galleryMessage, 'Logout failed', 'error');
            }
        });
    }

    function showLoginForm() {
        $loginContainer.show();
        $adminPanel.hide();
    }

    function showAdminPanel() {
        $loginContainer.hide();
        $adminPanel.show();
    }

    function loadPhotos() {
        $galleryLoading.removeClass('hidden');
        hideMessage($galleryMessage);

        $.ajax({
            url: '/api/photos?showAll=true', // Admin sees all photos including hidden ones
            type: 'GET',
            success: function(response) {
                if (response.success && response.photos) {
                    photos = response.photos;
                    displayPhotos();
                    updatePhotoCount();
                } else {
                    showMessage($galleryMessage, 'Failed to load photos', 'error');
                }
            },
            error: function() {
                showMessage($galleryMessage, 'Failed to load photos', 'error');
            },
            complete: function() {
                $galleryLoading.addClass('hidden');
            }
        });
    }

    function displayPhotos() {
        $photoGrid.empty();

        if (photos.length === 0) {
            $emptyGallery.show();
            return;
        }

        $emptyGallery.hide();

        photos.forEach(photo => {
            const photoCard = createPhotoCard(photo);
            $photoGrid.append(photoCard);
        });
    }

    function createPhotoCard(photo) {
        const createdDate = new Date(photo.createdOn).toLocaleString();
        const isVisible = photo.visible !== false; // Default to true if not set
        const visibilityStatus = isVisible ? '👁️ Visible' : '🙈 Hidden';
        const visibilityClass = isVisible ? 'visible' : 'hidden';
        
        const card = $(`
            <div class="photo-card ${visibilityClass}" data-photo-id="${photo.id}">
                <img src="/uploads/photos/${photo.filename}" alt="Photo by ${photo.guestName}" loading="lazy">
                <div class="photo-info">
                    <h4>📸 ${photo.guestName}</h4>
                    <p>${photo.comment || 'No caption provided'}</p>
                    <div class="photo-meta">
                        📅 ${createdDate}<br>
                        📁 ${photo.filename}<br>
                        <span class="visibility-status">${visibilityStatus}</span>
                    </div>
                    <div class="photo-actions">
                        <button class="btn btn-primary btn-small edit-photo" data-photo-id="${photo.id}">
                            ✏️ Edit
                        </button>
                        <button class="btn btn-secondary btn-small toggle-visibility" data-photo-id="${photo.id}" data-visible="${isVisible}">
                            ${isVisible ? '🙈 Hide' : '👁️ Show'}
                        </button>
                        <button class="btn btn-danger btn-small delete-photo" data-photo-id="${photo.id}" data-filename="${photo.filename}">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            </div>
        `);

        // Add edit button handler
        card.find('.edit-photo').on('click', function() {
            const photoId = $(this).data('photo-id');
            const photo = photos.find(p => p.id === photoId);
            if (photo) {
                showEditModal(photo);
            }
        });

        // Add visibility toggle handler
        card.find('.toggle-visibility').on('click', function() {
            const photoId = $(this).data('photo-id');
            const currentlyVisible = $(this).data('visible');
            togglePhotoVisibility(photoId, !currentlyVisible);
        });

        // Add delete button handler
        card.find('.delete-photo').on('click', function() {
            const photoId = $(this).data('photo-id');
            const filename = $(this).data('filename');
            showDeleteModal(photoId, filename);
        });

        return card;
    }

    function showDeleteModal(photoId, filename) {
        photoToDelete = { id: photoId, filename: filename };
        $deleteModal.addClass('show');
    }

    function hideDeleteModal() {
        photoToDelete = null;
        $deleteModal.removeClass('show');
    }

    function deletePhoto(photoData) {
        $confirmDelete.prop('disabled', true).text('Deleting...');

        $.ajax({
            url: `/api/admin/photos/${photoData.id}`,
            type: 'DELETE',
            success: function(response) {
                if (response.success) {
                    showMessage($galleryMessage, 'Photo deleted successfully', 'success');
                    
                    // Remove photo card from UI
                    $(`.photo-card[data-photo-id="${photoData.id}"]`).fadeOut(300, function() {
                        $(this).remove();
                        
                        // Update photos array
                        photos = photos.filter(p => p.id !== photoData.id);
                        updatePhotoCount();
                        
                        // Show empty gallery if no photos left
                        if (photos.length === 0) {
                            $emptyGallery.show();
                        }
                    });
                    
                    hideDeleteModal();
                } else {
                    showMessage($galleryMessage, response.message || 'Failed to delete photo', 'error');
                }
            },
            error: function(xhr) {
                let errorMessage = 'Failed to delete photo';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }
                showMessage($galleryMessage, errorMessage, 'error');
            },
            complete: function() {
                $confirmDelete.prop('disabled', false).text('Delete');
            }
        });
    }

    function updatePhotoCount() {
        const count = photos.length;
        $photoCount.text(`${count} photo${count !== 1 ? 's' : ''}`);
    }

    function showMessage($element, text, type) {
        $element.removeClass('success error').addClass(type).text(text).show();
        
        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                hideMessage($element);
            }, 3000);
        }
    }

    function hideMessage($element) {
        $element.hide();
    }

    // QR URL Management Functions
    function loadCurrentQrUrl() {
        $.ajax({
            url: '/api/qr-url',
            type: 'GET',
            success: function(response) {
                if (response.success) {
                    $currentQrUrl.text(response.url);
                    $qrUrlInput.val(response.url);
                }
            },
            error: function() {
                $currentQrUrl.text('Failed to load');
            }
        });
    }

    function updateQrUrl() {
        console.log($qrUrlInput);
        const newUrl = $qrUrlInput.val().trim();
        
        if (!newUrl) {
            showMessage($qrMessage, 'Please enter a URL', 'error');
            return;
        }

        $updateQrBtn.prop('disabled', true).text('Updating...');

        $.ajax({
            url: '/api/admin/qr-url',
            type: 'POST',
            data: { url: newUrl },
            success: function(response) {
                if (response.success) {
                    showMessage($qrMessage, 'QR Code URL updated successfully!', 'success');
                    $currentQrUrl.text(response.url);
                } else {
                    showMessage($qrMessage, response.message || 'Failed to update URL', 'error');
                }
            },
            error: function(xhr) {
                let errorMessage = 'Failed to update QR Code URL';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }
                showMessage($qrMessage, errorMessage, 'error');
            },
            complete: function() {
                $updateQrBtn.prop('disabled', false).text('Update QR Code');
            }
        });
    }

    function resetQrUrl() {
        const defaultUrl = `${window.location.origin}/upload.html`;
        $qrUrlInput.val(defaultUrl);
        updateQrUrl();
    }

    function togglePhotoVisibility(photoId, newVisibility) {
        const $toggleBtn = $(`.photo-card[data-photo-id="${photoId}"] .toggle-visibility`);
        const originalText = $toggleBtn.text();
        
        $toggleBtn.prop('disabled', true).text('⏳ Updating...');
        
        $.ajax({
            url: `/api/admin/photos/${photoId}/visibility`,
            type: 'PATCH',
            data: { visible: newVisibility },
            success: function(response) {
                if (response.success) {
                    // Update the photo in our local array
                    const photoIndex = photos.findIndex(p => p.id === photoId);
                    if (photoIndex !== -1) {
                        photos[photoIndex].visible = newVisibility;
                    }
                    
                    // Update the photo card
                    updatePhotoCardVisibility(photoId, newVisibility);
                    
                    // Show success message
                    const action = newVisibility ? 'shown' : 'hidden';
                    showMessage($galleryMessage, `Photo ${action} successfully!`, 'success');
                } else {
                    showMessage($galleryMessage, response.message || 'Failed to update photo visibility', 'error');
                }
            },
            error: function(xhr) {
                let errorMessage = 'Failed to update photo visibility';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }
                showMessage($galleryMessage, errorMessage, 'error');
            },
            complete: function() {
                // Restore button state
                const buttonText = newVisibility ? '🙈 Hide' : '👁️ Show';
                $toggleBtn.prop('disabled', false).text(buttonText).data('visible', newVisibility);
            }
        });
    }

    function updatePhotoCardVisibility(photoId, isVisible) {
        const $photoCard = $(`.photo-card[data-photo-id="${photoId}"]`);
        const $toggleBtn = $photoCard.find('.toggle-visibility');
        const $visibilityStatus = $photoCard.find('.visibility-status');
        
        // Update card class
        $photoCard.removeClass('visible hidden').addClass(isVisible ? 'visible' : 'hidden');
        
        // Update visibility status text
        const statusText = isVisible ? '👁️ Visible' : '🙈 Hidden';
        $visibilityStatus.text(statusText);
        
        // Update button text and data
        const buttonText = isVisible ? '🙈 Hide' : '👁️ Show';
        $toggleBtn.text(buttonText).data('visible', isVisible);
        
        // Add visual feedback
        $photoCard.addClass('updated');
        setTimeout(() => {
            $photoCard.removeClass('updated');
        }, 2000);
    }

    // Handle image load errors
    $(document).on('error', 'img', function() {
        console.error('Failed to load image:', $(this).attr('src'));
        $(this).attr('src', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4=');
    });
});