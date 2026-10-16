document.addEventListener('DOMContentLoaded', () => {
  const LIMOR_PHONE_INTL = '972542329605';
  const STORAGE_PACK_KEY = 'limor_dogs_packing_v1';

  // 1. Capture UTM / Google Ads parameters for attribution & conversion tracking
  const urlParams = new URLSearchParams(window.location.search);
  const utmSource = urlParams.get('utm_source') || (urlParams.get('gclid') ? 'google_ads' : '');

  function trackConversionEvent(actionName) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', actionName, {
          event_category: 'lead',
          event_label: utmSource || 'organic'
        });
      } else if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({
          event: actionName,
          lead_source: utmSource || 'organic'
        });
      }
    } catch (_) {
      // Ignore tracking errors
    }
  }

  document.querySelectorAll('[data-track]').forEach((el) => {
    el.addEventListener('click', () => {
      const action = el.getAttribute('data-track');
      if (action) trackConversionEvent(action);
    });
  });

  // 2. Date Inputs & Automatic Nights Calculation
  const checkInInput = document.getElementById('checkInDate');
  const checkOutInput = document.getElementById('checkOutDate');
  const nightsSummaryPill = document.getElementById('nightsSummaryPill');
  const nightsCountText = document.getElementById('nightsCountText');
  const todayStr = new Date().toISOString().split('T')[0];

  function calculateNights() {
    if (!checkInInput?.value || !checkOutInput?.value) {
      if (nightsSummaryPill) nightsSummaryPill.hidden = true;
      return 0;
    }
    const start = new Date(checkInInput.value);
    const end = new Date(checkOutInput.value);
    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      if (nightsSummaryPill && nightsCountText) {
        nightsSummaryPill.hidden = false;
        nightsCountText.textContent = diffDays === 1 ? 'לילה אחד' : `${diffDays} לילות`;
      }
      return diffDays;
    } else if (diffDays === 0) {
      if (nightsSummaryPill && nightsCountText) {
        nightsSummaryPill.hidden = false;
        nightsCountText.textContent = 'שהיית יום';
      }
      return 0;
    } else {
      if (nightsSummaryPill) nightsSummaryPill.hidden = true;
      return 0;
    }
  }

  if (checkInInput && checkOutInput) {
    checkInInput.min = todayStr;
    checkOutInput.min = todayStr;

    checkInInput.addEventListener('change', () => {
      if (checkInInput.value) {
        checkOutInput.min = checkInInput.value;
        if (checkOutInput.value && checkOutInput.value < checkInInput.value) {
          checkOutInput.value = checkInInput.value;
        }
      }
      calculateNights();
    });

    checkOutInput.addEventListener('change', calculateNights);
  }

  // 3. Quick Select Dog Size Chips (Single select)
  let selectedDogSize = '';
  const sizeChips = document.querySelectorAll('.select-chip[data-size]');
  sizeChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = chip.getAttribute('data-size') || '';
      if (selectedDogSize === val) {
        selectedDogSize = '';
        chip.classList.remove('active');
      } else {
        selectedDogSize = val;
        sizeChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
      }
    });
  });

  // 4. Operational Pre-Qualification Trait Chips (Multi-select)
  const traitChips = document.querySelectorAll('.trait-chip[data-trait]');
  traitChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const isPressed = chip.classList.toggle('active');
      chip.setAttribute('aria-pressed', isPressed ? 'true' : 'false');
      const label = chip.getAttribute('data-trait') || '';
      chip.textContent = `${isPressed ? '✓' : '+'} ${label}`;
    });
  });

  // Format YYYY-MM-DD to DD/MM/YYYY
  function formatHebrewDate(isoDate) {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // 5. Smart WhatsApp Booking Form Handler (No surrogate emojis to avoid wa.me corruption)
  const bookingForm = document.getElementById('whatsappBookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const ownerName = document.getElementById('ownerName')?.value.trim() || '';
      const dogName = document.getElementById('dogName')?.value.trim() || '';
      const checkIn = formatHebrewDate(checkInInput?.value || '');
      const checkOut = formatHebrewDate(checkOutInput?.value || '');
      const nights = calculateNights();
      const dogNotes = document.getElementById('dogNotes')?.value.trim() || '';

      const activeTraits = Array.from(document.querySelectorAll('.trait-chip.active'))
        .map((c) => c.getAttribute('data-trait'))
        .filter(Boolean);

      const details = [];
      if (ownerName) details.push(`שם: ${ownerName}`);
      if (dogName) details.push(`שם הכלב/ה וגזע: ${dogName}`);
      if (selectedDogSize) details.push(`גודל: ${selectedDogSize}`);
      if (checkIn && checkOut) {
        const nightsLabel = nights > 0 ? ` (${nights === 1 ? 'לילה אחד' : `${nights} לילות`})` : '';
        details.push(`תאריכים: ${checkIn} עד ${checkOut}${nightsLabel}`);
      } else if (checkIn) {
        details.push(`מתאריך: ${checkIn}`);
      }
      if (activeTraits.length > 0 && (ownerName || dogName || checkIn || selectedDogSize || dogNotes)) {
        details.push(`מאפיינים: ${activeTraits.join(', ')}`);
      }
      if (dogNotes) details.push(`דגשים נוספים: ${dogNotes}`);

      let messageText = '';
      if (details.length > 0) {
        messageText = [
          'היי לימור, הגעתי דרך דף הנחיתה של פנסיון כלבים ביתי ואשמח לבדוק זמינות לנופש:',
          ...details,
          'תודה רבה!'
        ].join('\n');
      } else {
        messageText = 'היי לימור, הגעתי דרך דף הנחיתה של פנסיון כלבים ביתי ואשמח לקבל פרטים ולבדוק זמינות לנופש. תודה רבה!';
      }

      const encodedText = encodeURIComponent(messageText);
      const whatsappUrl = `https://wa.me/${LIMOR_PHONE_INTL}?text=${encodedText}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    });
  }

  // 6. Interactive Packing Checklist with LocalStorage Persistence
  const packingContainer = document.getElementById('packingChecklist');
  const checklistProgress = document.getElementById('checklistProgress');

  if (packingContainer) {
    const checkboxes = packingContainer.querySelectorAll('input[type="checkbox"][data-pack-item]');
    let savedState = {};

    try {
      savedState = JSON.parse(localStorage.getItem(STORAGE_PACK_KEY) || '{}');
    } catch (_) {
      savedState = {};
    }

    function updatePackingProgress() {
      const total = checkboxes.length;
      let checkedCount = 0;
      const nextState = {};

      checkboxes.forEach((cb) => {
        const key = cb.getAttribute('data-pack-item');
        if (cb.checked) {
          checkedCount++;
          if (key) nextState[key] = true;
        }
      });

      if (checklistProgress) {
        checklistProgress.textContent =
          checkedCount === total ? `${checkedCount}/${total} הכל מוכן!` : `${checkedCount}/${total} מוכן`;
      }

      try {
        localStorage.setItem(STORAGE_PACK_KEY, JSON.stringify(nextState));
      } catch (_) {
        // Ignore storage errors
      }
    }

    checkboxes.forEach((cb) => {
      const key = cb.getAttribute('data-pack-item');
      if (key && savedState[key]) {
        cb.checked = true;
      }
      cb.addEventListener('change', updatePackingProgress);
    });

    updatePackingProgress();
  }

  // 7. Quick Page Share / Copy Button
  const sharePageBtn = document.getElementById('sharePageBtn');
  const sharePageBtnText = document.getElementById('sharePageBtnText');

  if (sharePageBtn) {
    sharePageBtn.addEventListener('click', async () => {
      const shareData = {
        title: 'פנסיון כלבים ביתי בראש העין – לימור שירה',
        text: 'פנסיון כלבים ביתי ללא כלובים בראש העין עם 3 טיולים בטבע ביום – לימור שירה (054-2329605)',
        url: window.location.href
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (_) {
          // Fallback to clipboard copy if user cancels or fails
        }
      }

      try {
        await navigator.clipboard.writeText(window.location.href);
        if (sharePageBtnText) {
          const orig = sharePageBtnText.textContent;
          sharePageBtnText.textContent = 'הקישור הועתק!';
          setTimeout(() => {
            sharePageBtnText.textContent = orig;
          }, 2200);
        }
      } catch (_) {
        // Ignore clipboard errors
      }
    });
  }

  // 8. Original Flyer Lightbox Modal
  const flyerModal = document.getElementById('flyerModal');
  const openModalBtn = document.getElementById('openFlyerModalBtn');
  const closeModalBtn = document.getElementById('closeFlyerModalBtn');

  function openModal() {
    if (!flyerModal) return;
    flyerModal.hidden = false;
    document.body.style.overflow = 'hidden';
    closeModalBtn?.focus();
  }

  function closeModal() {
    if (!flyerModal) return;
    flyerModal.hidden = true;
    document.body.style.overflow = '';
    openModalBtn?.focus();
  }

  openModalBtn?.addEventListener('click', openModal);
  closeModalBtn?.addEventListener('click', closeModal);

  flyerModal?.addEventListener('click', (e) => {
    if (e.target === flyerModal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && flyerModal && !flyerModal.hidden) {
      closeModal();
    }
  });
});
