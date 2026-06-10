/* ==========================================================================
   BugDex - Application logic & Cloud Sync System
   ========================================================================== */

// --- תצפיות מובנות כדמו ראשוני (אם אין מידע קיים) ---
const INITIAL_DEMO_OBSERVATIONS = [];

// --- משתני המצב הגלובליים ---
let supabaseClient = null;
let observations = [];
let activeCategoryFilter = "all";
let searchQuery = "";
let currentSelectedObservation = null;

// --- אלמנטים מה-DOM ---
const dom = {
    // כפתורים ומצבים
    btnToggleUpload: document.getElementById('btn-toggle-upload'),
    btnOpenSettings: document.getElementById('btn-open-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    badgeDemoMode: document.getElementById('badge-demo-mode'),
    badgeCloudMode: document.getElementById('badge-cloud-mode'),
    spanCurrentYear: document.getElementById('span-current-year'),
    
    // הגדרות ענן
    modalSettings: document.getElementById('modal-settings-overlay'),
    formCloudSettings: document.getElementById('form-cloud-settings'),
    inputSupabaseUrl: document.getElementById('input-supabase-url'),
    inputSupabaseKey: document.getElementById('input-supabase-key'),
    btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
    btnCopySql: document.getElementById('btn-copy-sql'),
    btnClearSettings: document.getElementById('btn-clear-settings'),
    
    // טופס תצפית
    sectionUploadForm: document.getElementById('section-upload-form'),
    btnCloseUpload: document.getElementById('btn-close-upload'),
    formAddObservation: document.getElementById('form-add-observation'),
    inputBugName: document.getElementById('input-bug-name'),
    inputBugCategory: document.getElementById('input-bug-category'),
    inputLocation: document.getElementById('input-observation-location'),
    inputNotes: document.getElementById('input-observation-notes'),
    btnCancelUpload: document.getElementById('btn-cancel-upload'),
    btnSubmitObservation: document.getElementById('btn-submit-observation'),
    
    // העלאת תמונה
    dropzone: document.getElementById('dropzone-image'),
    inputFileImage: document.getElementById('input-file-image'),
    dropzonePlaceholder: document.getElementById('dropzone-placeholder-content'),
    dropzonePreview: document.getElementById('dropzone-preview-container'),
    imgPreview: document.getElementById('img-upload-preview'),
    btnRemovePreview: document.getElementById('btn-remove-image-file'),
    
    // חיפוש וגלריה
    inputSearchGallery: document.getElementById('input-search-gallery'),
    galleryStats: document.getElementById('gallery-stats-text'),
    categoryFiltersContainer: document.getElementById('container-category-filters'),
    galleryContainer: document.getElementById('album-gallery-container'),
    galleryLoading: document.getElementById('gallery-loading-indicator'),
    emptyStateSection: document.getElementById('section-empty-state'),
    btnEmptyStateAdd: document.getElementById('btn-empty-state-add'),
    
    // לייטבוקס
    modalLightbox: document.getElementById('modal-lightbox-overlay'),
    btnCloseLightbox: document.getElementById('btn-close-lightbox'),
    lightboxImg: document.getElementById('lightbox-main-img'),
    lightboxBadgeCategory: document.getElementById('lightbox-badge-category'),
    lightboxBugName: document.getElementById('lightbox-bug-name'),
    lightboxDate: document.getElementById('lightbox-observation-date'),
    lightboxLocation: document.getElementById('lightbox-bug-location'),
    lightboxNotes: document.getElementById('lightbox-bug-notes'),
    btnDeleteObservation: document.getElementById('btn-delete-observation'),
    
    // מסך התקדמות
    modalUploading: document.getElementById('modal-uploading-overlay')
};

// --- אתחול האפליקציה בטעינה ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // מחיקה חד-פעמית של נתוני הדמו הישנים מהדפדפן ואיפוס מצב ענן
    if (!localStorage.getItem('bugdex_version_reset_v4')) {
        localStorage.removeItem('bugdex_local_observations');
        localStorage.removeItem('bugdex_use_demo');
        localStorage.setItem('bugdex_version_reset_v4', 'true');
    }

    // 1. הגדרת השנה הנוכחית בפוטר
    if (dom.spanCurrentYear) {
        dom.spanCurrentYear.innerText = new Date().getFullYear();
    }
    
    // 2. רישום מאזיני אירועים (Event Listeners)
    registerEventListeners();
    
    // 3. טעינה וניסיון חיבור לענן
    loadCloudCredentials();
    
    // 4. טעינת הנתונים והצגתם
    loadObservations();
}

// --- מאזיני אירועים (Event Listeners) ---
function registerEventListeners() {
    // פתיחה/סגירה של טופס ההעלאה
    dom.btnToggleUpload.addEventListener('click', () => togglePanel(dom.sectionUploadForm));
    dom.btnCloseUpload.addEventListener('click', () => hidePanel(dom.sectionUploadForm));
    dom.btnCancelUpload.addEventListener('click', () => {
        hidePanel(dom.sectionUploadForm);
        resetForm();
    });
    dom.btnEmptyStateAdd.addEventListener('click', () => showPanel(dom.sectionUploadForm));

    // פתיחה/סגירה של הגדרות ענן
    dom.btnOpenSettings.addEventListener('click', openSettingsModal);
    dom.btnCloseSettings.addEventListener('click', closeSettingsModal);
    dom.modalSettings.addEventListener('click', (e) => {
        if (e.target === dom.modalSettings) closeSettingsModal();
    });

    // שינוי נראות הסיסמה
    dom.btnToggleKeyVisibility.addEventListener('click', toggleKeyVisibility);
    
    // העתקת קוד SQL
    dom.btnCopySql.addEventListener('click', copySqlSetupScript);
    
    // שמירה ומחיקה של הגדרות הענן
    dom.formCloudSettings.addEventListener('submit', saveCloudSettings);
    dom.btnClearSettings.addEventListener('click', clearCloudSettings);
    
    // ניהול אזור גרירת התמונות
    initImageUploadDropzone();
    
    // הגשת טופס תצפית חדשה
    dom.formAddObservation.addEventListener('submit', handleObservationSubmit);
    
    // חיפוש בגלריה
    dom.inputSearchGallery.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderGallery();
    });
    
    // לייטבוקס
    dom.btnCloseLightbox.addEventListener('click', closeLightboxModal);
    dom.modalLightbox.addEventListener('click', (e) => {
        if (e.target === dom.modalLightbox) closeLightboxModal();
    });
    dom.btnDeleteObservation.addEventListener('click', handleDeleteObservation);
    
    // תמיכה במקש Escape לסגירת מודלים
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSettingsModal();
            closeLightboxModal();
        }
    });
}

// --- פקדי ה-UI של הפאנלים ---
function togglePanel(panel) {
    if (panel.classList.contains('hidden')) {
        showPanel(panel);
    } else {
        hidePanel(panel);
    }
}

function showPanel(panel) {
    panel.classList.remove('hidden');
    lucide.createIcons();
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hidePanel(panel) {
    panel.classList.add('hidden');
}

// --- ניהול הגדרות ענן (Supabase Credentials) ---
function loadCloudCredentials() {
    const useDemo = localStorage.getItem('bugdex_use_demo') === 'true';
    
    let url = localStorage.getItem('bugdex_supabase_url');
    let key = localStorage.getItem('bugdex_supabase_key');
    
    const defaultUrl = "https://jypdrvdhqffcolplwxvi.supabase.co";
    const defaultKey = atob("c2JfcHVibGlzaGFibGVfLW85aFVKNG5GNlBPdXBadWtrQ181d19LN24yUldPdA==");

    if (useDemo) {
        initDemoMode();
        return;
    }

    if (!url && !key) {
        url = defaultUrl;
        key = defaultKey;
    }
    
    if (url && key) {
        // ניקוי סלאשים מיותרים של ה-rest API
        let cleanUrl = url.trim();
        if (cleanUrl.endsWith('/rest/v1/')) {
            cleanUrl = cleanUrl.slice(0, -9);
        } else if (cleanUrl.endsWith('/rest/v1')) {
            cleanUrl = cleanUrl.slice(0, -8);
        }

        dom.inputSupabaseUrl.value = url;
        dom.inputSupabaseKey.value = key;
        
        try {
            // אתחול לקוח Supabase מה-CDN
            supabaseClient = supabase.createClient(cleanUrl, key);
            
            dom.badgeCloudMode.classList.remove('hidden');
            dom.badgeDemoMode.classList.add('hidden');
        } catch (error) {
            console.error("שגיאה באתחול לקוח Supabase:", error);
            alert("שגיאה באתחול לקוח Supabase: " + error.message);
            initDemoMode();
        }
    } else {
        initDemoMode();
    }
}

function initDemoMode() {
    supabaseClient = null;
    dom.badgeCloudMode.classList.add('hidden');
    dom.badgeDemoMode.classList.remove('hidden');
}

function openSettingsModal() {
    dom.modalSettings.classList.remove('hidden');
}

function closeSettingsModal() {
    dom.modalSettings.classList.add('hidden');
}

function toggleKeyVisibility() {
    const input = dom.inputSupabaseKey;
    const icon = dom.btnToggleKeyVisibility.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        icon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
}

function copySqlSetupScript() {
    const code = document.getElementById('sql-setup-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        const span = dom.btnCopySql.querySelector('span');
        const originalText = span.innerText;
        span.innerText = "הועתק!";
        setTimeout(() => {
            span.innerText = originalText;
        }, 2000);
    }).catch(err => {
        console.error("שגיאה בהעתקת הטקסט:", err);
    });
}

function saveCloudSettings(e) {
    e.preventDefault();
    
    const url = dom.inputSupabaseUrl.value.trim();
    const key = dom.inputSupabaseKey.value.trim();
    
    if (url && key) {
        localStorage.removeItem('bugdex_use_demo');
        localStorage.setItem('bugdex_supabase_url', url);
        localStorage.setItem('bugdex_supabase_key', key);
        
        loadCloudCredentials();
        closeSettingsModal();
        
        // טעינה מחדש של הנתונים מהענן
        loadObservations();
        alert("הגדרות החיבור לענן נשמרו בהצלחה! האתר ינסה להתחבר כעת.");
    }
}

function clearCloudSettings() {
    if (confirm("האם אתה בטוח שברצונך למחוק את הגדרות החיבור לענן ולחזור למצב דמו מקומי?")) {
        localStorage.setItem('bugdex_use_demo', 'true');
        localStorage.removeItem('bugdex_supabase_url');
        localStorage.removeItem('bugdex_supabase_key');
        
        dom.inputSupabaseUrl.value = "";
        dom.inputSupabaseKey.value = "";
        
        initDemoMode();
        closeSettingsModal();
        loadObservations();
    }
}

// --- ניהול גרירת והעלאת קבצי תמונה ---
function initImageUploadDropzone() {
    const dropzone = dom.dropzone;
    const fileInput = dom.inputFileImage;
    
    // לחיצה על אזור הגרירה
    dropzone.addEventListener('click', () => {
        fileInput.click();
    });
    
    // גרירה מעל האזור
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleSelectedImageFile(files[0]);
        }
    });
    
    // שינוי שדה בחירת קובץ
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handleSelectedImageFile(files[0]);
        }
    });
    
    // כפתור הסרת התמונה מהתצוגה המקדימה
    dom.btnRemovePreview.addEventListener('click', (e) => {
        e.stopPropagation(); // מונע הפעלת אירוע הלחיצה של ה-dropzone
        resetImagePreview();
    });
}

function handleSelectedImageFile(file) {
    if (!file.type.startsWith('image/')) {
        alert("אנא בחר קובץ תמונה תקין בלבד (PNG, JPG, WEBP).");
        return;
    }
    
    // הגבלת נפח ל-8MB
    if (file.size > 8 * 1024 * 1024) {
        alert("נפח הקובץ גדול מדי. אנא העלה תמונה קטנה מ-8MB.");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        // הצגת תמונה מוגדלת בתצוגה מקדימה
        dom.imgPreview.src = e.target.result;
        dom.dropzonePlaceholder.classList.add('hidden');
        dom.dropzonePreview.classList.remove('hidden');
        
        // עדכון מאפיין הנדרש של שדה הקובץ
        dom.inputFileImage.required = false;
    };
    reader.readAsDataURL(file);
}

function resetImagePreview() {
    dom.imgPreview.src = "";
    dom.dropzonePreview.classList.add('hidden');
    dom.dropzonePlaceholder.classList.remove('hidden');
    dom.inputFileImage.value = "";
    dom.inputFileImage.required = true;
}

// --- דחיסת תמונה מקומית למצב דמו (כדי שלא יפוצץ את ה-LocalStorage) ---
function compressImageForLocal(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // כיווץ לפורמט JPEG באיכות של 70%
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// --- שליחה ושמירת תצפית חדשה ---
async function handleObservationSubmit(e) {
    e.preventDefault();
    
    const name = dom.inputBugName.value.trim();
    const category = dom.inputBugCategory.value.trim();
    const location = dom.inputLocation.value.trim();
    const notes = dom.inputNotes.value.trim();
    
    // קובץ התמונה שנבחר
    const file = dom.inputFileImage.files[0];
    
    if (!name || !category || !location) {
        alert("נא למלא את כל שדות החובה המסומנים בכוכבית (*).");
        return;
    }
    
    // הצגת מודל הטעינה
    dom.modalUploading.classList.remove('hidden');
    dom.btnSubmitObservation.disabled = true;
    
    try {
        let imageUrl = "";
        
        if (supabaseClient) {
            // === שמירה בענן עם Supabase ===
            
            // 1. העלאת הקובץ ל-Storage של Supabase תחת תיקיית קטגוריית החרק
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
            // נתיב מאורגן בתיקייה
            const filePath = `${category}/${fileName}`;
            
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('insects')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });
                
            if (uploadError) {
                // בדיקה אם הבעיה היא שהבאקט לא קיים
                if (uploadError.message && uploadError.message.includes("Bucket not found")) {
                    throw new Error("תיקיית האחסון (Bucket) בשם 'insects' אינה קיימת ב-Supabase Storage שלך. אנא צור אותה שם והגדר אותה כציבורית (Public).");
                }
                throw uploadError;
            }
            
            // 2. קבלת ה-Public URL של התמונה שהועלתה
            const { data: urlData } = supabaseClient.storage
                .from('insects')
                .getPublicUrl(filePath);
                
            imageUrl = urlData.publicUrl;
            
            // 3. יצירת רשומה חדשה בטבלת observations
            const { error: insertError } = await supabaseClient
                .from('observations')
                .insert([
                    { name, category, location, notes, image_url: imageUrl }
                ]);
                
            if (insertError) throw insertError;
            
        } else {
            // === שמירה מקומית במצב דמו ===
            let localImgData = "";
            if (file) {
                // דחיסה מקומית של התמונה ושמירת ה-base64
                localImgData = await compressImageForLocal(file);
            } else {
                localImgData = "https://via.placeholder.com/600?text=No+Image";
            }
            
            const newObservation = {
                id: `local-${Date.now()}`,
                created_at: new Date().toISOString(),
                name,
                category,
                location,
                notes,
                image_url: localImgData
            };
            
            // שמירה ב-LocalStorage
            const localObs = JSON.parse(localStorage.getItem('bugdex_local_observations') || "[]");
            localObs.unshift(newObservation);
            localStorage.setItem('bugdex_local_observations', JSON.stringify(localObs));
        }
        
        // הצלחה
        alert(`התצפית "${name}" נשמרה בהצלחה תחת משפחת "${category}"!`);
        resetForm();
        hidePanel(dom.sectionUploadForm);
        
        // טעינה מחדש ורינדור של הגלריה
        await loadObservations();
        
    } catch (error) {
        console.error("שגיאה בשמירת התצפית:", error);
        alert(`שגיאה בשמירה: ${error.message || error}`);
    } finally {
        // הסתרת מודל הטעינה
        dom.modalUploading.classList.add('hidden');
        dom.btnSubmitObservation.disabled = false;
    }
}

function resetForm() {
    dom.formAddObservation.reset();
    resetImagePreview();
}

// --- טעינת נתונים (ענן / מקומי) ---
async function loadObservations() {
    dom.galleryLoading.classList.remove('hidden');
    dom.galleryContainer.innerHTML = "";
    dom.emptyStateSection.classList.add('hidden');
    
    try {
        if (supabaseClient) {
            // טעינה מ-Supabase
            const { data, error } = await supabaseClient
                .from('observations')
                .select('*')
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            observations = data || [];
        } else {
            // טעינה מקומית במצב דמו
            const local = localStorage.getItem('bugdex_local_observations');
            if (local) {
                observations = JSON.parse(local);
            } else {
                // שימוש בדמו ראשוני
                observations = [...INITIAL_DEMO_OBSERVATIONS];
                localStorage.setItem('bugdex_local_observations', JSON.stringify(observations));
            }
        }
        
        // עדכון הפילטרים ורינדור הגלריה
        buildCategoryFilters();
        renderGallery();
        
    } catch (error) {
        console.error("שגיאה בטעינת התצפיות:", error);
        // חזרה זמנית למצב דמו מקומי במקרה של שגיאת תקשורת/הרשאות
        alert(`לא ניתן היה לטעון נתונים מהענן: ${error.message || error}. מציג נתונים מקומיים במקום.`);
        initDemoMode();
        loadObservations();
    } finally {
        dom.galleryLoading.classList.add('hidden');
    }
}

// --- בנייה ועדכון של פילטר הקטגוריות ---
function buildCategoryFilters() {
    // יצירת רשימה ייחודית של קטגוריות (תיקיות)
    const categories = new Set();
    observations.forEach(obs => {
        if (obs.category) categories.add(obs.category.trim());
    });
    
    // ניקוי אלמנטים ישנים (חוץ מהכפתור "הכל")
    dom.categoryFiltersContainer.innerHTML = `<button class="filter-tab ${activeCategoryFilter === 'all' ? 'active' : ''}" data-category="all">הכל</button>`;
    
    // הוספת datalist לטופס
    const datalist = document.getElementById('categories-list');
    datalist.innerHTML = "";
    
    // הוספת הכפתורים לפילטר והאופציות ל-datalist
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `filter-tab ${activeCategoryFilter === cat ? 'active' : ''}`;
        btn.setAttribute('data-category', cat);
        btn.innerText = cat;
        
        // מאזין לחיצה לסינון
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            activeCategoryFilter = cat;
            renderGallery();
        });
        
        dom.categoryFiltersContainer.appendChild(btn);
        
        // הוספת אופציה בטופס
        const opt = document.createElement('option');
        opt.value = cat;
        datalist.appendChild(opt);
    });
    
    // מאזין לחיצה לכפתור "הכל"
    const btnAll = dom.categoryFiltersContainer.querySelector('[data-category="all"]');
    btnAll.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        btnAll.classList.add('active');
        activeCategoryFilter = "all";
        renderGallery();
    });
}

// --- רינדור הגלריה (חלוקה לתיקיות) ---
function renderGallery() {
    dom.galleryContainer.innerHTML = "";
    
    // 1. סינון ראשוני של התצפיות לפי חיפוש ופילטר קטגוריה פעיל
    let filtered = observations.filter(obs => {
        // סינון קטגוריה
        if (activeCategoryFilter !== "all" && obs.category !== activeCategoryFilter) {
            return false;
        }
        
        // סינון חיפוש
        if (searchQuery) {
            const nameMatch = obs.name && obs.name.toLowerCase().includes(searchQuery);
            const locationMatch = obs.location && obs.location.toLowerCase().includes(searchQuery);
            const notesMatch = obs.notes && obs.notes.toLowerCase().includes(searchQuery);
            const categoryMatch = obs.category && obs.category.toLowerCase().includes(searchQuery);
            return nameMatch || locationMatch || notesMatch || categoryMatch;
        }
        
        return true;
    });
    
    // עדכון ספירה וסטטיסטיקה
    const totalCount = filtered.length;
    const foldersCount = new Set(filtered.map(obs => obs.category)).size;
    dom.galleryStats.innerText = `נמצאו ${totalCount} תצפיות ב-${foldersCount} משפחות`;
    
    if (totalCount === 0) {
        dom.emptyStateSection.classList.remove('hidden');
        return;
    } else {
        dom.emptyStateSection.classList.add('hidden');
    }
    
    // 2. קיבוץ התצפיות לתיקיות (לפי קטגוריה)
    const grouped = {};
    filtered.forEach(obs => {
        const cat = obs.category || "אחר";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(obs);
    });
    
    // מיון שמות התיקיות
    const sortedCategories = Object.keys(grouped).sort();
    
    // 3. יצירת התיקיות ב-DOM
    sortedCategories.forEach((catName, folderIndex) => {
        const folderObservations = grouped[catName];
        const folderId = `folder-${folderIndex}`;
        
        // בדיקה אם התיקייה הייתה מכווצת בעבר (שמור בזיכרון המקומי למניעת קפיצות UI)
        const isCollapsed = localStorage.getItem(`bugdex_collapsed_${catName}`) === "true";
        
        const folderContainer = document.createElement('div');
        folderContainer.className = `folder-container ${isCollapsed ? 'collapsed' : ''}`;
        folderContainer.id = folderId;
        
        // כותרת התיקייה
        const folderHeader = document.createElement('div');
        folderHeader.className = "folder-header";
        folderHeader.innerHTML = `
            <div class="folder-title-block">
                <i data-lucide="folder" class="folder-icon"></i>
                <span class="folder-name">${catName}</span>
                <span class="folder-badge-count">${folderObservations.length} תצפיות</span>
            </div>
            <i data-lucide="chevron-down" class="folder-toggle-icon"></i>
        `;
        
        // לחיצה על כותרת תיקייה לפתיחה/כיווץ
        folderHeader.addEventListener('click', () => {
            folderContainer.classList.toggle('collapsed');
            const nowCollapsed = folderContainer.classList.contains('collapsed');
            localStorage.setItem(`bugdex_collapsed_${catName}`, nowCollapsed);
        });
        
        // תוכן התיקייה (גריד של חרקים)
        const folderContent = document.createElement('div');
        folderContent.className = "folder-content";
        
        const folderGrid = document.createElement('div');
        folderGrid.className = "folder-grid";
        
        // רינדור כרטיסיית חרק
        folderObservations.forEach((obs) => {
            const card = document.createElement('div');
            card.className = "bug-card";
            
            card.innerHTML = `
                <div class="bug-card-media">
                    <img src="${obs.image_url}" alt="${obs.name}" class="bug-card-img" loading="lazy">
                </div>
                <div class="bug-card-details">
                    <h4 class="bug-card-title">${obs.name}</h4>
                    <div class="bug-card-location-row">
                        <i data-lucide="map-pin"></i>
                        <span class="bug-card-location-text">${obs.location}</span>
                    </div>
                </div>
            `;
            
            // לחיצה על כרטיסייה לפתיחת לייטבוקס
            card.addEventListener('click', () => {
                openLightboxModal(obs);
            });
            
            folderGrid.appendChild(card);
        });
        
        folderContent.appendChild(folderGrid);
        folderContainer.appendChild(folderHeader);
        folderContainer.appendChild(folderContent);
        
        dom.galleryContainer.appendChild(folderContainer);
    });
    
    // יצירת אייקונים של Lucide לכל הגלריה מחדש
    lucide.createIcons();
}

// --- לוגיקת הלייטבוקס (Lightbox Detail View) ---
function openLightboxModal(observation) {
    currentSelectedObservation = observation;
    
    dom.lightboxImg.src = observation.image_url;
    dom.lightboxBadgeCategory.innerText = observation.category;
    dom.lightboxBugName.innerText = observation.name;
    
    // עיצוב תאריך
    const date = new Date(observation.created_at);
    const formattedDate = isNaN(date) ? "תאריך לא ידוע" : date.toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    dom.lightboxDate.innerText = `תאריך תיעוד: ${formattedDate}`;
    
    dom.lightboxLocation.innerText = observation.location;
    dom.lightboxNotes.innerText = observation.notes ? observation.notes : "אין הערות נוספות לתצפית זו.";
    
    dom.modalLightbox.classList.remove('hidden');
    lucide.createIcons();
}

function closeLightboxModal() {
    dom.modalLightbox.classList.add('hidden');
    currentSelectedObservation = null;
}

// --- מחיקת תצפית (ענן / מקומי) ---
async function handleDeleteObservation() {
    if (!currentSelectedObservation) return;
    
    const obsName = currentSelectedObservation.name;
    if (!confirm(`האם אתה בטוח שברצונך למחוק את התצפית "${obsName}" לצמיתות?`)) {
        return;
    }
    
    dom.btnDeleteObservation.disabled = true;
    const originalBtnText = dom.btnDeleteObservation.innerHTML;
    dom.btnDeleteObservation.innerHTML = "מוחק...";
    
    try {
        if (supabaseClient) {
            // === מחיקה מ-Supabase ===
            
            // 1. (אופציונלי אך מומלץ) מחיקת הקובץ הפיזי מה-Storage
            // נחלץ את שם הקובץ מה-URL הציבורי
            const imgUrl = currentSelectedObservation.image_url;
            
            // ה-URL נראה בדרך כלל כך: .../storage/v1/object/public/insects/Category/filename.jpg
            if (imgUrl.includes('/storage/v1/object/public/insects/')) {
                const relativePath = imgUrl.split('/storage/v1/object/public/insects/')[1];
                if (relativePath) {
                    // מחיקת הקובץ
                    const decodedPath = decodeURIComponent(relativePath);
                    const { error: storageDeleteError } = await supabaseClient.storage
                        .from('insects')
                        .remove([decodedPath]);
                        
                    if (storageDeleteError) {
                        console.warn("שגיאה במחיקת התמונה מהאחסון (אך נמשיך במחיקת הרשומה):", storageDeleteError);
                    }
                }
            }
            
            // 2. מחיקת השורה בטבלה
            const { error: dbDeleteError } = await supabaseClient
                .from('observations')
                .delete()
                .eq('id', currentSelectedObservation.id);
                
            if (dbDeleteError) throw dbDeleteError;
            
        } else {
            // === מחיקה מקומית (מצב דמו) ===
            const localObs = JSON.parse(localStorage.getItem('bugdex_local_observations') || "[]");
            const filtered = localObs.filter(obs => obs.id !== currentSelectedObservation.id);
            localStorage.setItem('bugdex_local_observations', JSON.stringify(filtered));
        }
        
        closeLightboxModal();
        alert(`התצפית "${obsName}" נמחקה בהצלחה!`);
        await loadObservations();
        
    } catch (error) {
        console.error("שגיאה במחיקת התצפית:", error);
        alert(`שגיאה במחיקה: ${error.message || error}`);
    } finally {
        dom.btnDeleteObservation.disabled = false;
        dom.btnDeleteObservation.innerHTML = originalBtnText;
    }
}
