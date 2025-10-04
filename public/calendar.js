// public/calendar.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- ELEMENT SELECTORS ---
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const loadingOverlay = document.getElementById('loading-overlay');
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const techConfigSelect = document.getElementById('tech-config-select');
    const searchCode = document.getElementById('searchCode');

    // Modal Selectors
    const editModal = document.getElementById('edit-appointment-modal');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalCloseXBtn = document.getElementById('modal-close-x-btn');
    
    // Modal Form Fields
    const modalApptId = document.getElementById('modal-appt-id');
    const modalDate = document.getElementById('modal-date');
    const modalVerificationSelect = document.getElementById('modal-verification');
    const modalServiceValue = document.getElementById('modal-service-value');
    
    // Hidden fields for payload
    const modalOriginalTechnician = document.getElementById('modal-original-technician');
    const modalPetShowed = document.getElementById('modal-pet-showed');
    const modalTips = document.getElementById('modal-tips');
    const modalPercentage = document.getElementById('modal-percentage');
    const modalPaymentMethod = document.getElementById('modal-payment-method');

    // --- GLOBAL STATE & CONFIG ---
    let allAppointments = []; 
    let allTechnicians = [];
    let selectedTechnician = ''; 
    let currentWeekStart = getStartOfWeek(new Date()); 
    
    const SCHEDULE_DURATION_HOURS = 2; 
    const SLOT_HEIGHT_PX = 60; 
    const TIME_SLOTS_START_HOUR = 8;
    const TIME_SLOTS_END_HOUR = 22;
    const NIGHT_SHIFT_HOUR = 18;
    const TIME_SLOTS = Array.from({ length: TIME_SLOTS_END_HOUR - TIME_SLOTS_START_HOUR }, 
        (_, i) => `${(TIME_SLOTS_START_HOUR + i).toString().padStart(2, '0')}:00`
    );

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const VISIBLE_DAY_INDICES = [1, 2, 3, 4, 5, 6]; 
    const VERIFICATION_OPTIONS = ["Scheduled", "Showed", "Canceled"];
    
    // --- HELPER FUNCTIONS ---
    
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -7 : 0); // Adjust to Sunday as start of week
        return new Date(d.setDate(diff));
    }
    
    function parseSheetDate(dateStr) {
        if (!dateStr || !dateStr.includes('/') || !dateStr.includes(':')) return null;
        const [datePart, timePart] = dateStr.split(' ');
        const [year, month, day] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;
        return new Date(year, month - 1, day, hour, minute); 
    }
    
    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        return dateTimeStr.replace(/\//g, '-').replace(' ', 'T'); 
    }
    
    // --- MODAL LOGIC ---
    function openEditModal(appt) {
        if (!appt) return;

        modalApptId.value = appt.id;
        modalOriginalTechnician.value = appt.technician;
        modalPetShowed.value = appt.petShowed || ''; 
        modalTips.value = appt.tips || '';
        modalPercentage.value = appt.percentage || '';
        modalPaymentMethod.value = appt.paymentMethod || '';
        
        modalDate.value = formatDateTimeForInput(appt.appointmentDate);
        modalServiceValue.value = appt.serviceShowed || '';
        
        const currentVerification = appt.verification || "Scheduled";
        modalVerificationSelect.innerHTML = VERIFICATION_OPTIONS.map(opt => 
            `<option value="${opt}" ${opt === currentVerification ? 'selected' : ''}>${opt}</option>`
        ).join('');

        editModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
    
    async function handleSaveAppointment() {
        const dataToSend = {
            rowIndex: parseInt(modalApptId.value, 10),
            appointmentDate: modalDate.value,
            verification: modalVerificationSelect.value,
            serviceShowed: modalServiceValue.value,
            technician: modalOriginalTechnician.value, 
            petShowed: modalPetShowed.value,
            tips: modalTips.value,
            percentage: modalPercentage.value,
            paymentMethod: modalPaymentMethod.value,
        };

        try {
            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend),
            });

            const result = await response.json();

            if (result.success) {
                alert('Appointment updated successfully!');
                await loadInitialData(true);
            } else {
                throw new Error(result.message || 'Unknown error occurred.');
            }
        } catch (error) {
            console.error('Failed to save appointment:', error);
            alert(`Error saving appointment: ${error.message}`);
        } finally {
            closeEditModal();
        }
    }

    // --- RENDER FUNCTIONS ---
    function populateTechSelects(technicians) {
        const createOptions = (techList) => techList.sort().map(tech => `<option value="${tech}">${tech}</option>`).join('');
        
        if (techSelectDropdown) {
            techSelectDropdown.innerHTML = `<option value="">Select Technician</option>${createOptions(technicians)}`;
        }
        if (techConfigSelect) {
            techConfigSelect.innerHTML = `<option value="">Select Technician</option>${createOptions(technicians)}`;
        }
        
        if (selectedTechnician && technicians.includes(selectedTechnician)) {
            techSelectDropdown.value = selectedTechnician;
        }
    }

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        
        VISIBLE_DAY_INDICES.forEach(dayIndex => {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + dayIndex);
            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-r border-border';
            header.textContent = `${DAY_NAMES[dayIndex]} (${date.getDate()}/${date.getMonth() + 1})`;
            schedulerHeader.appendChild(header);
        });

        schedulerBody.innerHTML = '';
        
        TIME_SLOTS.forEach((time, rowIndex) => {
            const hour = parseInt(time.split(':')[0], 10);
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-sm font-medium border-b border-border';
            timeDiv.textContent = time;
            schedulerBody.appendChild(timeDiv);

            VISIBLE_DAY_INDICES.forEach(dayIndex => {
                const emptySlot = document.createElement('div');
                emptySlot.className = 'time-slot border-t border-r border-border hover:bg-muted/10';
                if (hour >= NIGHT_SHIFT_HOUR) emptySlot.classList.add('night-shift');
                emptySlot.style.gridRow = `${rowIndex + 1}`;
                emptySlot.style.gridColumn = `${dayIndex + 1}`;
                schedulerBody.appendChild(emptySlot);
            });
        });
        
        renderAppointments();
        
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 6);
        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;

        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
        if(!selectedTechnician) {
            loadingOverlay.querySelector('p').textContent = 'Select a technician to view schedule.';
        }
    }
    
    function renderAppointments() {
        if (!selectedTechnician) return;
        
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        const codeFilterTerm = searchCode ? searchCode.value.toLowerCase().trim() : '';

        const appointmentsToRender = allAppointments.filter(appt => {
            if (appt.technician !== selectedTechnician) return false;
            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate || apptDate < currentWeekStart || apptDate >= weekEnd) return false;
            if (codeFilterTerm && (!appt.code || !appt.code.toLowerCase().includes(codeFilterTerm))) return false;
            return VISIBLE_DAY_INDICES.includes(apptDate.getDay());
        });

        appointmentsToRender.forEach(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate) return;

            const startHour = apptDate.getHours();
            if (startHour < TIME_SLOTS_START_HOUR || startHour >= TIME_SLOTS_END_HOUR) return;

            const topOffset = ((startHour - TIME_SLOTS_START_HOUR) * 60 + apptDate.getMinutes()) / 60 * SLOT_HEIGHT_PX;
            
            let bgColor = 'bg-custom-primary';
            if (appt.verification === 'Canceled') bgColor = 'bg-cherry-red';
            else if (appt.verification === 'Showed') bgColor = 'bg-green-600';
            
            const block = document.createElement('div');
            block.className = `appointment-block ${bgColor} text-white rounded-md shadow-md border`;
            block.dataset.id = appt.id;
            block.style.top = `${topOffset}px`;
            block.style.gridColumn = apptDate.getDay() + 1;

            block.innerHTML = `
                <div class="text-xs font-semibold overflow-hidden text-ellipsis">${appt.customers || 'N/A'}</div>
                <div class="text-xs mt-1">Code: ${appt.code || 'N/A'}</div>
                <div class="text-xs mt-1 font-medium">${startHour.toString().padStart(2,'0')}:${apptDate.getMinutes().toString().padStart(2,'0')}</div>
                <div class="text-xs mt-1 font-bold">${appt.verification || 'Scheduled'}</div>
            `;
            
            block.addEventListener('click', handleEditAppointmentClick);
            schedulerBody.appendChild(block);
        });
    }

    // --- DATA FETCHING ---
    async function loadInitialData(isReload = false) {
        if (!isReload) {
            loadingOverlay.classList.remove('hidden');
            loadingOverlay.querySelector('p').textContent = 'Loading initial data...';
        }

        try {
            const [techResponse, apptResponse] = await Promise.all([
                 fetch('/api/get-dashboard-data', { cache: 'no-store' }), 
                 fetch('/api/get-technician-appointments', { cache: 'no-store' }) 
            ]);
            
            if (!techResponse.ok || !apptResponse.ok) throw new Error('Failed to load data from the server.');

            const techData = await techResponse.json();
            allTechnicians = techData.technicians || [];

            const apptData = await apptResponse.json();
            allAppointments = apptData.appointments || [];
            
            populateTechSelects(allTechnicians); 
            renderScheduler();
        } catch (error) {
            console.error('Critical Error on loadInitialData:', error);
            loadingOverlay.querySelector('p').textContent = `ERROR: ${error.message}`;
            loadingOverlay.classList.remove('hidden');
        }
    }

    // --- EVENT LISTENERS ---
    prevWeekBtn.addEventListener('click', () => {
         currentWeekStart.setDate(currentWeekStart.getDate() - 7);
         renderScheduler();
    });

    nextWeekBtn.addEventListener('click', () => {
         currentWeekStart.setDate(currentWeekStart.getDate() + 7);
         renderScheduler();
    });

    if (techSelectDropdown) {
        techSelectDropdown.addEventListener('change', (e) => {
            selectedTechnician = e.target.value;
            renderScheduler();
        });
    }
    
    if (searchCode) searchCode.addEventListener('input', renderScheduler);
    if (modalSaveBtn) modalSaveBtn.addEventListener('click', handleSaveAppointment);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeEditModal); 
    if (modalCloseXBtn) modalCloseXBtn.addEventListener('click', closeEditModal);
    
    // --- INITIALIZATION ---
    loadInitialData();
}); // Fim do DOMContentLoaded
