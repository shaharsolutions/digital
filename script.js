// --- Scroll Animations (Intersection Observer) ---
document.addEventListener('DOMContentLoaded', () => {
    
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzb5tXc9NbbvUmoAA3THBWhaPX8CugXhgNO20T7SAYJEqfmxx90z4BtLf2A8_rWWKc7/exec';
    
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach(el => observer.observe(el));

    // --- Accordion Logic ---
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const isActive = item.classList.contains('active');
            
            // Close all items
            document.querySelectorAll('.accordion-item').forEach(i => {
                i.classList.remove('active');
                const btn = i.querySelector('.accordion-header');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            });

            // If it wasn't active before, open it
            if (!isActive) {
                item.classList.add('active');
                header.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // --- Scroll Down Arrow Logic ---
    const scrollArrow = document.querySelector('.scroll-down-arrow');
    if (scrollArrow) {
        scrollArrow.addEventListener('click', () => {
             // Scroll to the next section (Pain Section)
             const nextSection = document.getElementById('pain');
             if (nextSection) {
                 nextSection.scrollIntoView({ behavior: 'smooth' });
             } else {
                 window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
             }
        });
    }

    // --- Form Submission Logic ---
    const form = document.querySelector('#leadForm');
    if (form) {
        const submitBtn = document.querySelector('#submitBtn');
        const btnText = submitBtn.querySelector('.btn-text');
        const loader = submitBtn.querySelector('.loader');
        const formMessage = document.querySelector('#formMessage');

        form.addEventListener('submit', e => {
            e.preventDefault();
            
            // Basic Validation
            const fullName = form.fullName.value.trim();
            const phone = form.phone.value.trim();
            
            if (!fullName || !phone) {
                showMessage('נא למלא שם וטלפון תקינים', 'error');
                return;
            }

            // Show loading state
            submitBtn.disabled = true;
            btnText.classList.add('hidden');
            loader.classList.remove('hidden');
            formMessage.textContent = '';

            // Prepare data
            const formData = new FormData(form);
            
            fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            })
            .then(response => {
                showMessage('תודה! הפרטים נשלחו בהצלחה. נחזור אליך בהקדם.', 'success');
                form.reset();
                openSegmentModal();
            })
            .catch(error => {
                console.error('Error!', error.message);
                showMessage('אופס! משהו השתבש. אנא נסה שנית או צור קשר בטלפון.', 'error');
            })
            .finally(() => {
                submitBtn.disabled = false;
                btnText.classList.remove('hidden');
                loader.classList.add('hidden');
            });
        });
    }

    // --- Digital Diagnosis Questionnaire Logic ---
    const diagForm = document.querySelector('#diagnosisForm');
    if (diagForm) {
        const diagSteps = diagForm.querySelectorAll('.diagnosis-step');
        const progressFill = diagForm.querySelector('.progress-bar-fill');
        const stepIndicator = diagForm.querySelector('.step-indicator');
        const prevBtn = diagForm.querySelector('.diag-prev-btn');
        const nextBtn = diagForm.querySelector('.diag-next-btn');
        const submitDiagBtn = diagForm.querySelector('.diag-submit-btn');
        const diagMessage = diagForm.querySelector('#diagMessage');
        const diagSuccess = document.querySelector('#diagSuccess');
        
        let diagCurrentStep = 1;
        const diagTotalSteps = 6;
        
        function updateDiagProgress() {
            // Update Progress Bar
            const percent = (diagCurrentStep / diagTotalSteps) * 100;
            progressFill.style.width = `${percent}%`;
            
            // Update Step Text
            stepIndicator.textContent = `שלב ${diagCurrentStep} מתוך ${diagTotalSteps}`;
            
            // Update steps visibility
            diagSteps.forEach(step => {
                step.classList.remove('active');
                if (parseInt(step.dataset.step) === diagCurrentStep) {
                    step.classList.add('active');
                }
            });
            
            // Update navigation buttons
            if (diagCurrentStep === 1) {
                prevBtn.classList.add('hidden');
            } else {
                prevBtn.classList.remove('hidden');
            }
            
            if (diagCurrentStep === diagTotalSteps) {
                nextBtn.classList.add('hidden');
                submitDiagBtn.classList.remove('hidden');
            } else {
                nextBtn.classList.remove('hidden');
                submitDiagBtn.classList.add('hidden');
            }
            
            // Clear inline messages on step change
            diagMessage.textContent = '';
            diagMessage.className = 'form-message hidden';
        }
        
        // Next & Back controls
        nextBtn.addEventListener('click', () => {
            if (diagCurrentStep < diagTotalSteps) {
                diagCurrentStep++;
                updateDiagProgress();
            }
        });
        
        prevBtn.addEventListener('click', () => {
            if (diagCurrentStep > 1) {
                diagCurrentStep--;
                updateDiagProgress();
            }
        });
        
        // Chips interaction
        const chips = diagForm.querySelectorAll('.chip-btn');
        chips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                const group = chip.closest('.chip-group');
                const groupType = group.dataset.type;
                
                if (groupType === 'single') {
                    // Single selection: unselect others, select this one
                    group.querySelectorAll('.chip-btn').forEach(btn => btn.classList.remove('selected'));
                    chip.classList.add('selected');
                    
                    // Update hidden input
                    const hiddenInput = group.nextElementSibling;
                    if (hiddenInput && hiddenInput.type === 'hidden') {
                        hiddenInput.value = chip.dataset.value;
                    }
                } else if (groupType === 'multiple') {
                    // Multiple selection: toggle this selection
                    chip.classList.toggle('selected');
                    
                    // Update hidden input with comma separated values
                    const selectedChips = Array.from(group.querySelectorAll('.chip-btn.selected'))
                        .map(btn => btn.dataset.value);
                    
                    const hiddenInput = group.nextElementSibling;
                    if (hiddenInput && hiddenInput.type === 'hidden') {
                        hiddenInput.value = selectedChips.join(', ');
                    }
                }
            });
        });
        
        // Submit Handler
        diagForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Final Step Validation
            const fullName = diagForm.fullName.value.trim();
            const phone = diagForm.phone.value.trim();
            
            if (!fullName || !phone) {
                diagMessage.textContent = 'נא למלא שם מלא וטלפון תקינים ליצירת קשר';
                diagMessage.className = 'form-message error';
                return;
            }
            
            // Show loading state
            submitDiagBtn.disabled = true;
            const diagBtnText = submitDiagBtn.querySelector('.btn-text');
            const diagLoader = submitDiagBtn.querySelector('.loader');
            
            diagBtnText.classList.add('hidden');
            diagLoader.classList.remove('hidden');
            diagMessage.className = 'form-message hidden';
            
            // Prepare FormData
            const formData = new FormData(diagForm);
            formData.append('formType', 'אבחון דיגיטלי');
            
            // Build a formatted summary of the Q&A for the 'improvement' field (e.g. to automatically show in the email)
            const timeWaster = diagForm.timeWaster.value.trim() || "לא צוין";
            const infoManagement = diagForm.infoManagement.value.trim() || "לא צוין";
            const painPoints = diagForm.painPoints.value.trim() || "לא צוין";
            const desiredFeatures = diagForm.desiredFeatures.value.trim() || "לא צוין";
            const priority = diagForm.priority.value.trim() || "לא צוין";
            
            const formattedImprovement = `<b>[אבחון דיגיטלי לעסק]</b><br>
<hr style="border: 0; border-top: 1px solid #ccc; margin: 10px 0;"><br>
<b>איזה תהליך בעסק הכי גוזל זמן או יוצר בלאגן?</b><br>
${timeWaster}<br><br>
<b>איפה מנהלים את המידע היום?</b><br>
${infoManagement}<br><br>
<b>מה הכי מפריע בתהליך הזה?</b><br>
${painPoints}<br><br>
<b>מה היית רוצה שמערכת פשוטה תעשה עבורך?</b><br>
${desiredFeatures}<br><br>
<b>כמה חשוב לפתור את זה בתקופה הקרובה?</b><br>
${priority}`;

            formData.append('improvement', formattedImprovement);
            
            // Submit using fetch
            fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            })
            .then(() => {
                // Success
                diagForm.classList.add('hidden');
                diagSuccess.classList.remove('hidden');
                diagForm.reset();
                
                // Clear chips selected state
                chips.forEach(c => c.classList.remove('selected'));
                diagForm.querySelectorAll('input[type="hidden"]').forEach(h => h.value = '');
                openSegmentModal();
            })
            .catch(error => {
                console.error('Diagnosis submission error:', error);
                diagMessage.textContent = 'אופס! משהו השתבש בשליחה. אנא נסו שוב או פנו בטלפון.';
                diagMessage.className = 'form-message error';
            })
            .finally(() => {
                submitDiagBtn.disabled = false;
                diagBtnText.classList.remove('hidden');
                diagLoader.classList.add('hidden');
            });
        });
    }

    function showMessage(text, type) {
        formMessage.textContent = text;
        formMessage.className = 'form-message ' + type;
        
        // Clear success message after a few seconds
        if (type === 'success') {
            setTimeout(() => {
                formMessage.textContent = '';
                formMessage.className = 'form-message';
            }, 5000);
        }
    }
    // --- Segmented Lead Confirmation Modal Logic ---
    const TELEGRAM_CHANNEL_URL = 'https://t.me/shaharsolutions';
    const modal = document.querySelector('#lead-segment-modal');
    
    function openSegmentModal() {
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    function closeSegmentModal() {
        if (modal) {
            modal.classList.remove('active');
        }
    }
    
    if (modal) {
        const closeBtn = modal.querySelector('#close-modal-btn');
        const telegramBtn = modal.querySelector('#modal-btn-telegram');
        const messageBtn = modal.querySelector('#modal-btn-message');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeSegmentModal);
        }
        
        // Close on overlay background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeSegmentModal();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSegmentModal();
            }
        });
        
        if (telegramBtn) {
            telegramBtn.addEventListener('click', () => {
                // Track GA Event
                if (typeof gtag === 'function') {
                    gtag('event', 'lead_group_telegram', {
                        'event_category': 'lead_segmentation',
                        'event_label': 'Telegram Channel'
                    });
                }
                
                // Open telegram link in a new window
                window.open(TELEGRAM_CHANNEL_URL, '_blank');
                
                closeSegmentModal();
            });
        }
        
        if (messageBtn) {
            messageBtn.addEventListener('click', () => {
                // Track GA Event
                if (typeof gtag === 'function') {
                    gtag('event', 'lead_group_message_today', {
                        'event_category': 'lead_segmentation',
                        'event_label': 'Message Today'
                    });
                }
                
                closeSegmentModal();
            });
        }
    }

    // --- Projects Toggle Logic ---
    const toggleProjectsBtn = document.getElementById('toggle-projects-btn');
    if (toggleProjectsBtn) {
        const collapsedProjects = document.querySelectorAll('.project-card.project-collapsed');
        toggleProjectsBtn.addEventListener('click', () => {
            const isExpanded = toggleProjectsBtn.getAttribute('aria-expanded') === 'true';
            
            collapsedProjects.forEach(project => {
                project.classList.toggle('project-collapsed');
            });
            
            if (isExpanded) {
                toggleProjectsBtn.setAttribute('aria-expanded', 'false');
                toggleProjectsBtn.textContent = 'הצג פרויקטים נוספים';
                // Scroll back to the projects section header
                const projectsSection = document.getElementById('projects');
                if (projectsSection) {
                    projectsSection.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                toggleProjectsBtn.setAttribute('aria-expanded', 'true');
                toggleProjectsBtn.textContent = 'הצג פחות';
            }
        });
    }
});
