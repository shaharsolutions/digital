document.addEventListener('DOMContentLoaded', () => {
  const LIMOR_PHONE_INTL = '972542329605';

  // Set default min date on date inputs
  const checkInInput = document.getElementById('checkInDate');
  const checkOutInput = document.getElementById('checkOutDate');
  const todayStr = new Date().toISOString().split('T')[0];

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
    });
  }

  // Format YYYY-MM-DD to DD/MM/YYYY
  function formatHebrewDate(isoDate) {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // WhatsApp Booking Form Handler
  const bookingForm = document.getElementById('whatsappBookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const ownerName = document.getElementById('ownerName')?.value.trim() || '';
      const dogName = document.getElementById('dogName')?.value.trim() || '';
      const checkIn = formatHebrewDate(checkInInput?.value || '');
      const checkOut = formatHebrewDate(checkOutInput?.value || '');
      const dogNotes = document.getElementById('dogNotes')?.value.trim() || '';

      const details = [];
      if (ownerName) details.push(`שם: ${ownerName}`);
      if (dogName) details.push(`שם הכלב/ה וגזע: ${dogName}`);
      if (checkIn && checkOut) {
        details.push(`תאריכים: ${checkIn} עד ${checkOut}`);
      } else if (checkIn) {
        details.push(`מתאריך: ${checkIn}`);
      }
      if (dogNotes) details.push(`פרטים נוספים: ${dogNotes}`);

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

  // Original Flyer Lightbox Modal
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
