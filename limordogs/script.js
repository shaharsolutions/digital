document.addEventListener('DOMContentLoaded', () => {
  const LIMOR_PHONE_INTL = '972542329605';
  const STORAGE_PACK_KEY = 'limor_dogs_packing_v1';

  const HEBREW_MONTHS = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  const HEBREW_DAYS_FULL = [
    'יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי',
    'יום חמישי', 'יום שישי', 'יום שבת'
  ];

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

  // 2. Date Helper Functions (Local timezone safe)
  function toISODate(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseISODate(isoStr) {
    if (!isoStr) return null;
    const [y, m, d] = isoStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function formatHebrewDate(isoDate) {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function getHebrewDayName(isoDate) {
    const d = parseISODate(isoDate);
    if (!d) return '';
    return HEBREW_DAYS_FULL[d.getDay()];
  }

  function addDaysISO(isoDate, daysToAdd) {
    const d = parseISODate(isoDate);
    if (!d) return '';
    d.setDate(d.getDate() + daysToAdd);
    return toISODate(d);
  }

  // 3. Custom Watercolor Hebrew Date Range Picker
  const datePickerWrapper = document.getElementById('datePickerWrapper');
  const checkInInput = document.getElementById('checkInDate');
  const checkOutInput = document.getElementById('checkOutDate');
  const checkInTrigger = document.getElementById('checkInTrigger');
  const checkOutTrigger = document.getElementById('checkOutTrigger');
  const checkInDisplay = document.getElementById('checkInDisplay');
  const checkOutDisplay = document.getElementById('checkOutDisplay');
  const checkInSub = document.getElementById('checkInSub');
  const checkOutSub = document.getElementById('checkOutSub');

  const calPopover = document.getElementById('hebrewCalendarPopover');
  const calTabCheckIn = document.getElementById('calTabCheckIn');
  const calTabCheckOut = document.getElementById('calTabCheckOut');
  const calTabCheckInVal = document.getElementById('calTabCheckInVal');
  const calTabCheckOutVal = document.getElementById('calTabCheckOutVal');
  const calPrevMonthBtn = document.getElementById('calPrevMonthBtn');
  const calNextMonthBtn = document.getElementById('calNextMonthBtn');
  const calMonthYearTitle = document.getElementById('calMonthYearTitle');
  const calDaysGrid = document.getElementById('calDaysGrid');
  const calClearBtn = document.getElementById('calClearBtn');
  const calDoneBtn = document.getElementById('calDoneBtn');
  const calFooterStatus = document.getElementById('calFooterStatus');

  const nightsSummaryPill = document.getElementById('nightsSummaryPill');
  const nightsCountText = document.getElementById('nightsCountText');
  const nightsRangeText = document.getElementById('nightsRangeText');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = toISODate(today);

  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); // 0-11
  let activeCalMode = 'checkin'; // 'checkin' | 'checkout'
  let hoverISO = '';

  function calculateNights() {
    const inVal = checkInInput?.value || '';
    const outVal = checkOutInput?.value || '';
    if (!inVal || !outVal) {
      if (nightsSummaryPill) nightsSummaryPill.hidden = true;
      return 0;
    }
    const start = parseISODate(inVal);
    const end = parseISODate(outVal);
    if (!start || !end) return 0;

    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      if (nightsSummaryPill && nightsCountText) {
        nightsSummaryPill.hidden = false;
        nightsCountText.textContent =
          diffDays === 0 ? 'שהיית יום' : diffDays === 1 ? 'לילה אחד' : `${diffDays} לילות`;
      }
      if (nightsRangeText) {
        nightsRangeText.textContent = `${formatHebrewDate(inVal)} – ${formatHebrewDate(outVal)}`;
      }
      return diffDays;
    } else {
      if (nightsSummaryPill) nightsSummaryPill.hidden = true;
      return 0;
    }
  }

  function updateDateUI() {
    const inVal = checkInInput?.value || '';
    const outVal = checkOutInput?.value || '';

    // Update Trigger 1 (Check-In)
    if (inVal) {
      checkInDisplay.textContent = formatHebrewDate(inVal);
      checkInSub.textContent = `${getHebrewDayName(inVal)} • כניסה`;
      checkInTrigger?.classList.add('has-value');
      if (calTabCheckInVal) calTabCheckInVal.textContent = formatHebrewDate(inVal);
    } else {
      checkInDisplay.textContent = 'בחרו תאריך כניסה';
      checkInSub.textContent = 'לחיצה לבחירה ביומן';
      checkInTrigger?.classList.remove('has-value');
      if (calTabCheckInVal) calTabCheckInVal.textContent = 'טרם נבחר';
    }

    // Update Trigger 2 (Check-Out)
    if (outVal) {
      checkOutDisplay.textContent = formatHebrewDate(outVal);
      checkOutSub.textContent = `${getHebrewDayName(outVal)} • יציאה`;
      checkOutTrigger?.classList.add('has-value');
      if (calTabCheckOutVal) calTabCheckOutVal.textContent = formatHebrewDate(outVal);
    } else {
      checkOutDisplay.textContent = 'בחרו תאריך יציאה';
      checkOutSub.textContent = 'לחיצה לבחירה ביומן';
      checkOutTrigger?.classList.remove('has-value');
      if (calTabCheckOutVal) calTabCheckOutVal.textContent = 'טרם נבחר';
    }

    // Update Tabs & Footer Status
    calTabCheckIn?.classList.toggle('active', activeCalMode === 'checkin');
    calTabCheckOut?.classList.toggle('active', activeCalMode === 'checkout');

    const isOpen = calPopover && !calPopover.hidden;
    checkInTrigger?.classList.toggle('is-active', isOpen && activeCalMode === 'checkin');
    checkOutTrigger?.classList.toggle('is-active', isOpen && activeCalMode === 'checkout');
    checkInTrigger?.setAttribute('aria-expanded', isOpen && activeCalMode === 'checkin' ? 'true' : 'false');
    checkOutTrigger?.setAttribute('aria-expanded', isOpen && activeCalMode === 'checkout' ? 'true' : 'false');

    const nights = calculateNights();
    if (calFooterStatus) {
      if (inVal && outVal) {
        calFooterStatus.textContent =
          nights === 0 ? 'שהיית יום אחד' : nights === 1 ? 'לילה אחד נבחר' : `${nights} לילות נבחרו`;
      } else if (inVal && activeCalMode === 'checkout') {
        calFooterStatus.textContent = 'כעת בחרו תאריך יציאה';
      } else {
        calFooterStatus.textContent = 'בחרו תאריך כניסה';
      }
    }
  }

  function renderCalendarGrid() {
    if (!calDaysGrid || !calMonthYearTitle) return;

    calMonthYearTitle.textContent = `${HEBREW_MONTHS[viewMonth]} ${viewYear}`;

    // Disable previous month button if viewing current month
    if (calPrevMonthBtn) {
      const isCurrentOrPastMonth =
        viewYear < today.getFullYear() ||
        (viewYear === today.getFullYear() && viewMonth <= today.getMonth());
      calPrevMonthBtn.disabled = isCurrentOrPastMonth;
    }

    calDaysGrid.innerHTML = '';

    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const inVal = checkInInput?.value || '';
    const outVal = checkOutInput?.value || '';
    const effectiveEnd = outVal || (activeCalMode === 'checkout' && hoverISO > inVal ? hoverISO : '');

    // Empty leading slots
    for (let i = 0; i < startWeekday; i++) {
      const emptyCell = document.createElement('span');
      emptyCell.className = 'cal-day is-empty';
      calDaysGrid.appendChild(emptyCell);
    }

    // Actual days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(viewYear, viewMonth, day);
      const cellISO = toISODate(cellDate);
      const isPast = cellISO < todayISO;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.textContent = String(day);
      btn.setAttribute('data-iso', cellISO);
      btn.setAttribute('aria-label', `${day} ב${HEBREW_MONTHS[viewMonth]} ${viewYear}`);

      if (isPast) {
        btn.disabled = true;
        btn.classList.add('is-disabled');
      }

      if (cellISO === todayISO) {
        btn.classList.add('is-today');
      }

      if (inVal && cellISO === inVal) {
        btn.classList.add('is-start');
      }
      if (outVal && cellISO === outVal) {
        btn.classList.add('is-end');
      }
      if (inVal && effectiveEnd && cellISO > inVal && cellISO < effectiveEnd) {
        btn.classList.add('in-range');
      }
      if (!outVal && activeCalMode === 'checkout' && hoverISO && cellISO === hoverISO && hoverISO > inVal) {
        btn.classList.add('is-end');
      }

      btn.addEventListener('click', () => handleDaySelection(cellISO));
      btn.addEventListener('mouseenter', () => {
        if (activeCalMode === 'checkout' && inVal && !outVal && cellISO >= inVal) {
          hoverISO = cellISO;
          updateRangeHoverClasses();
        }
      });

      calDaysGrid.appendChild(btn);
    }
  }

  function updateRangeHoverClasses() {
    const inVal = checkInInput?.value || '';
    const outVal = checkOutInput?.value || '';
    if (!inVal || outVal || !calDaysGrid) return;

    const buttons = calDaysGrid.querySelectorAll('.cal-day[data-iso]');
    buttons.forEach((btn) => {
      const iso = btn.getAttribute('data-iso') || '';
      btn.classList.toggle('in-range', Boolean(hoverISO && iso > inVal && iso < hoverISO));
      btn.classList.toggle('is-end', Boolean(hoverISO && iso === hoverISO && hoverISO > inVal));
    });
  }

  function handleDaySelection(selectedISO) {
    if (!checkInInput || !checkOutInput) return;

    if (activeCalMode === 'checkin') {
      checkInInput.value = selectedISO;
      if (checkOutInput.value && checkOutInput.value < selectedISO) {
        checkOutInput.value = '';
      }
      activeCalMode = 'checkout';
      hoverISO = '';
      updateDateUI();
      renderCalendarGrid();
    } else {
      // checkout mode
      if (!checkInInput.value || selectedISO < checkInInput.value) {
        checkInInput.value = selectedISO;
        checkOutInput.value = '';
        activeCalMode = 'checkout';
      } else {
        checkOutInput.value = selectedISO;
      }
      hoverISO = '';
      updateDateUI();
      renderCalendarGrid();
    }
  }

  function openCalendar(mode) {
    if (!calPopover) return;
    activeCalMode = mode;

    // Focus calendar view on selected date's month if available
    const targetISO = mode === 'checkout' ? (checkOutInput?.value || checkInInput?.value) : checkInInput?.value;
    const targetDate = parseISODate(targetISO);
    if (targetDate) {
      viewYear = targetDate.getFullYear();
      viewMonth = targetDate.getMonth();
    }

    calPopover.hidden = false;
    updateDateUI();
    renderCalendarGrid();
  }

  function closeCalendar() {
    if (!calPopover) return;
    calPopover.hidden = true;
    hoverISO = '';
    updateDateUI();
  }

  checkInTrigger?.addEventListener('click', () => {
    const isAlreadyOpenInMode = calPopover && !calPopover.hidden && activeCalMode === 'checkin';
    if (isAlreadyOpenInMode) {
      closeCalendar();
    } else {
      openCalendar('checkin');
    }
  });

  checkOutTrigger?.addEventListener('click', () => {
    const isAlreadyOpenInMode = calPopover && !calPopover.hidden && activeCalMode === 'checkout';
    if (isAlreadyOpenInMode) {
      closeCalendar();
    } else {
      openCalendar('checkout');
    }
  });

  calTabCheckIn?.addEventListener('click', () => {
    activeCalMode = 'checkin';
    updateDateUI();
    renderCalendarGrid();
  });

  calTabCheckOut?.addEventListener('click', () => {
    activeCalMode = 'checkout';
    updateDateUI();
    renderCalendarGrid();
  });

  calPrevMonthBtn?.addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    renderCalendarGrid();
  });

  calNextMonthBtn?.addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    renderCalendarGrid();
  });

  calClearBtn?.addEventListener('click', () => {
    if (checkInInput) checkInInput.value = '';
    if (checkOutInput) checkOutInput.value = '';
    activeCalMode = 'checkin';
    hoverISO = '';
    updateDateUI();
    renderCalendarGrid();
  });

  calDoneBtn?.addEventListener('click', closeCalendar);

  // Quick Presets (Upcoming Weekend, 3 Nights, 7 Nights)
  document.querySelectorAll('.cal-preset-chip[data-preset]').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (!checkInInput || !checkOutInput) return;
      const preset = chip.getAttribute('data-preset');

      if (preset === 'weekend') {
        // Find upcoming Friday (day 5)
        const d = new Date(today);
        const dayOfWeek = d.getDay();
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
        d.setDate(d.getDate() + daysUntilFriday);
        const friISO = toISODate(d);
        const sunISO = addDaysISO(friISO, 2);
        checkInInput.value = friISO;
        checkOutInput.value = sunISO;
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
      } else if (preset === '3nights' || preset === '7nights') {
        const nightsCount = preset === '3nights' ? 3 : 7;
        const baseISO = checkInInput.value || addDaysISO(todayISO, 1);
        checkInInput.value = baseISO;
        checkOutInput.value = addDaysISO(baseISO, nightsCount);
        const baseDate = parseISODate(baseISO);
        if (baseDate) {
          viewYear = baseDate.getFullYear();
          viewMonth = baseDate.getMonth();
        }
      }

      activeCalMode = 'checkout';
      updateDateUI();
      renderCalendarGrid();
    });
  });

  // Close popover when clicking outside
  document.addEventListener('click', (e) => {
    if (calPopover && !calPopover.hidden && datePickerWrapper && !datePickerWrapper.contains(e.target)) {
      closeCalendar();
    }
  });

  // 4. Quick Select Dog Size Chips (Single select)
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

  // 5. Operational Pre-Qualification Trait Chips (Multi-select)
  const traitChips = document.querySelectorAll('.trait-chip[data-trait]');
  traitChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const isPressed = chip.classList.toggle('active');
      chip.setAttribute('aria-pressed', isPressed ? 'true' : 'false');
      const label = chip.getAttribute('data-trait') || '';
      chip.textContent = `${isPressed ? '✓' : '+'} ${label}`;
    });
  });

  // 6. Smart WhatsApp Booking Form Handler (No surrogate emojis to avoid wa.me corruption)
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

  // 7. Interactive Packing Checklist with LocalStorage Persistence
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

  // 8. Quick Page Share / Copy Button
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

  // 9. Original Flyer Lightbox Modal
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
    if (e.key === 'Escape') {
      if (calPopover && !calPopover.hidden) {
        closeCalendar();
      }
      if (flyerModal && !flyerModal.hidden) {
        closeModal();
      }
    }
  });
});
