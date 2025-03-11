// DOM Elements
const checklistForm = document.getElementById('checklist-form');
const themeToggle = document.getElementById('theme-toggle');
const editModeToggle = document.getElementById('edit-mode');
const progressFill = document.querySelector('.progress-fill');
const progressText = document.querySelector('.progress-text');
const completionInfo = document.querySelector('.completion-info');
const completionTime = document.getElementById('completion-time');
const showShortcuts = document.getElementById('show-shortcuts');
const shortcutsModal = document.querySelector('.shortcuts-modal');

let editMode = false;

// Function to create a new checklist item
function createChecklistItem(text, isEditing = false) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    
    if (isEditing) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'editable-input';
        input.value = text;
        input.addEventListener('blur', saveContent);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-item';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.onclick = () => {
            label.remove();
            saveContent();
        };
        
        label.appendChild(checkbox);
        label.appendChild(input);
        label.appendChild(deleteBtn);
    } else {
        label.innerHTML = `<input type="checkbox"> ${text}`;
    }
    
    return label;
}

// Function to convert a section to edit mode
function convertSectionToEditMode(section) {
    const items = section.querySelectorAll('label');
    items.forEach(item => {
        const text = item.textContent.trim();
        const newItem = createChecklistItem(text, true);
        item.replaceWith(newItem);
    });
}

// Function to convert a section to view mode
function convertSectionToViewMode(section) {
    const items = section.querySelectorAll('label');
    items.forEach(item => {
        const input = item.querySelector('.editable-input');
        if (input) {
            const text = input.value.trim();
            const newItem = createChecklistItem(text, false);
            item.replaceWith(newItem);
        }
    });
}

// Save all editable content
function saveContent() {
    if (editMode) {
        const content = {
            title: document.querySelector('.editable-title').textContent,
            categories: {},
            items: {}
        };

        document.querySelectorAll('.section').forEach(section => {
            const sectionId = section.dataset.section;
            content.categories[sectionId] = section.querySelector('.editable-category').textContent;
            content.items[sectionId] = Array.from(section.querySelectorAll('label'))
                .map(label => {
                    const input = label.querySelector('.editable-input');
                    return input ? input.value.trim() : label.textContent.trim();
                })
                .filter(text => text);
        });

        chrome.storage.sync.set({ content });
    }
}

// Make an element editable
function makeEditable(element) {
    const text = element.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = text;
    input.addEventListener('blur', () => {
        element.textContent = input.value;
        saveContent();
    });
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });
    element.textContent = '';
    element.appendChild(input);
    input.select();
}

// Load saved state when the popup opens
document.addEventListener('DOMContentLoaded', async () => {
    const result = await chrome.storage.sync.get([
        'checklistState',
        'darkMode',
        'editMode',
        'content'
    ]);
    
    // Restore dark mode
    if (result.darkMode) {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Restore edit mode
    editMode = result.editMode || false;
    if (editMode) {
        document.body.classList.add('edit-mode');
        editModeToggle.innerHTML = '<i class="fas fa-check"></i>';
        document.querySelectorAll('.section').forEach(convertSectionToEditMode);
    }

    // Restore saved content if it exists
    if (result.content) {
        // Restore title
        const titleElement = document.querySelector('.editable-title');
        titleElement.textContent = result.content.title;

        // Restore categories and items
        Object.entries(result.content.categories).forEach(([sectionId, categoryName]) => {
            const section = document.querySelector(`.section[data-section="${sectionId}"]`);
            if (section) {
                section.querySelector('.editable-category').textContent = categoryName;
            }
        });

        Object.entries(result.content.items).forEach(([sectionId, items]) => {
            const section = document.querySelector(`.section[data-section="${sectionId}"]`);
            if (section) {
                // Clear default items
                const itemsContainer = section.querySelector('.section-header').nextElementSibling;
                while (itemsContainer.nextElementSibling) {
                    itemsContainer.nextElementSibling.remove();
                }
                // Add saved items
                items.forEach(text => {
                    section.appendChild(createChecklistItem(text, editMode));
                });
            }
        });
    }

    // Restore checkbox states
    const checklistState = result.checklistState || {};
    const checkboxes = Array.from(checklistForm.querySelectorAll('input[type="checkbox"]'));
    checkboxes.forEach((checkbox, index) => {
        checkbox.checked = checklistState[index] || false;
    });

    updateProgress();
});

// Update progress bar and completion status
function updateProgress() {
    const checkboxes = Array.from(checklistForm.querySelectorAll('input[type="checkbox"]'));
    const total = checkboxes.length;
    const checked = checkboxes.filter(cb => cb.checked).length;
    const percentage = Math.round((checked / total) * 100);
    
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}%`;

    if (percentage === 100) {
        const now = new Date().toLocaleString();
        completionTime.textContent = now;
        completionInfo.style.display = 'block';
    } else {
        completionInfo.style.display = 'none';
    }
}

// Save checklist state whenever a checkbox is toggled
checklistForm.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' && !editMode) {
        const checklistState = {};
        const checkboxes = Array.from(checklistForm.querySelectorAll('input[type="checkbox"]'));
        checkboxes.forEach((checkbox, index) => {
            checklistState[index] = checkbox.checked;
        });
        chrome.storage.sync.set({ checklistState });
        updateProgress();
    }
});

// Save items when they're edited
checklistForm.addEventListener('input', (e) => {
    if (editMode && e.target.className === 'editable-input') {
        saveContent();
    }
});

// Make title and categories editable in edit mode
document.addEventListener('click', (e) => {
    if (editMode && (e.target.classList.contains('editable-title') || e.target.classList.contains('editable-category'))) {
        makeEditable(e.target);
    }
});

// Reset checklist
checklistForm.addEventListener('reset', () => {
    // Reset title and categories to defaults
    document.querySelectorAll('[data-default]').forEach(element => {
        element.textContent = element.dataset.default;
    });
    
    chrome.storage.sync.remove(['checklistState', 'content']);
    completionInfo.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = '0%';
    location.reload();
});

// Toggle dark mode
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    chrome.storage.sync.set({ darkMode: isDark });
});

// Toggle edit mode
editModeToggle.addEventListener('click', () => {
    editMode = !editMode;
    document.body.classList.toggle('edit-mode');
    editModeToggle.innerHTML = editMode ? '<i class="fas fa-check"></i>' : '<i class="fas fa-edit"></i>';
    
    document.querySelectorAll('.section').forEach(section => {
        if (editMode) {
            convertSectionToEditMode(section);
        } else {
            convertSectionToViewMode(section);
            saveContent();
        }
    });
    
    chrome.storage.sync.set({ editMode });
});

// Handle add item buttons
document.querySelectorAll('.add-item').forEach(button => {
    button.addEventListener('click', () => {
        const section = button.closest('.section');
        const newItem = createChecklistItem('New item', true);
        section.appendChild(newItem);
        const input = newItem.querySelector('.editable-input');
        input.select();
        saveContent();
    });
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.altKey) {
        switch (e.key.toLowerCase()) {
            case 'r':
                checklistForm.reset();
                break;
            case 'd':
                themeToggle.click();
                break;
            case 's':
                showShortcuts.click();
                break;
        }
    } else if (!isNaN(e.key) && e.key !== '0') {
        const index = parseInt(e.key) - 1;
        const checkboxes = Array.from(checklistForm.querySelectorAll('input[type="checkbox"]'));
        if (checkboxes[index]) {
            checkboxes[index].checked = !checkboxes[index].checked;
            checkboxes[index].dispatchEvent(new Event('change'));
        }
    }
});

// Close shortcuts modal when clicking outside
document.addEventListener('click', (e) => {
    if (!showShortcuts.contains(e.target) && !shortcutsModal.contains(e.target)) {
        shortcutsModal.style.display = 'none';
    }
});

// Toggle shortcuts modal
showShortcuts.addEventListener('click', () => {
    shortcutsModal.style.display = shortcutsModal.style.display === 'none' ? 'block' : 'none';
});
