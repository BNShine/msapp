document.addEventListener('DOMContentLoaded', async () => {
    // --- ELEMENT SELECTORS ---
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const loadingOverlay = document.getElementById('loading-overlay');
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
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
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
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

    // Corrigido: A função precisa ser declarada para ser encontrada
    function handleEditAppointmentClick(event) {
        const block = event.currentTarget;
        const apptId = block.dataset.id;
        const localAppt = allAppointments.find(a => String(a.id) === apptId);
        if (localAppt) {
            openEditModal(localAppt);
        } else {
            console.error('Appointment data not found for ID:', apptId);
            alert('Error: Could not find appointment details.');
        }
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
        const optionsHtml = technicians.sort().map(tech => `<option value="${tech}">${tech}</option>`).join('');
        if (techSelectDropdown) {
            techSelectDropdown.innerHTML = `<option value="">Select Technician</option>${optionsHtml}`;
        }
        if (selectedTechnician && technicians.includes(selectedTechnician)) {
            techSelectDropdown.value = selectedTechnician;
        }
    }

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        VISIBLE_DAY_INDICES.forEach(dayIndex => {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + dayIndex - 1); // Correção para alinhar com os dias da semana
            schedulerHeader.innerHTML += `<div class="day-column-header p-2 font-semibold border-r border-border">${DAY_NAMES[dayIndex]} (${date.getDate()}/${date.getMonth() + 1})</div>`;
        });

        schedulerBody.innerHTML = '';
        TIME_SLOTS.forEach((time, rowIndex) => {
            const hour = parseInt(time.split(':')[0], 10);
            schedulerBody.innerHTML += `<div class="time-slot timeline-header p-2 text-sm font-medium border-b border-border">${time}</div>`;
            VISIBLE_DAY_INDICES.forEach(dayIndex => {
                schedulerBody.innerHTML += `<div class="time-slot border-t border-r border-border ${hour >= NIGHT_SHIFT_HOUR ? 'night-shift' : ''}" style="grid-row: ${rowIndex + 1}; grid-column: ${dayIndex + 1};"></div>`;
            });
        });
        
        renderAppointments();
        
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 5);
        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;

        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
    }
    
    function renderAppointments() {
        if (!selectedTechnician) return;
        
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        const codeFilterTerm = searchCode.value.toLowerCase().trim();

        allAppointments
            .filter(appt => {
                if (appt.technician !== selectedTechnician) return false;
                const apptDate = parseSheetDate(appt.appointmentDate);
                if (!apptDate || apptDate < currentWeekStart || apptDate >= weekEnd) return false;
                if (codeFilterTerm && (!appt.code || !appt.code.toLowerCase().includes(codeFilterTerm))) return false;
                return VISIBLE_DAY_INDICES.includes(apptDate.getDay());
            })
            .forEach(appt => {
                const apptDate = parseSheetDate(appt.appointmentDate);
                if (!apptDate) return;

                const startHour = apptDate.getHours();
                if (startHour < TIME_SLOTS_START_HOUR || startHour >= TIME_SLOTS_END_HOUR) return;

                const topOffset = ((startHour - TIME_SLOTS_START_HOUR) * 60 + apptDate.getMinutes()) / 60 * SLOT_HEIGHT_PX;
                
                let bgColor = 'bg-custom-primary';
                if (appt.verification === 'Canceled') bgColor = 'bg-cherry-red';
                else if (appt.verification === 'Showed') bgColor = 'bg-green-600';
                
                const block = document.createElement('div');
                block.className = `appointment-block ${bgColor} text-white rounded-md shadow-md border cursor-pointer`;
                block.dataset.id = appt.id;
                block.style.top = `${topOffset}px`;
                block.style.gridColumn = apptDate.getDay(); // JS getDay() Mon is 1, so this works with grid-column
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

    // --- DATA FETCHING & INITIALIZATION ---
    async function loadInitialData(isReload = false) {
        if (!isReload) {
            loadingOverlay.classList.remove('hidden');
        }
        try {
            const [techResponse, apptResponse] = await Promise.all([
                 fetch('/api/get-dashboard-data', { cache: 'no-store' }), 
                 fetch('/api/get-technician-appointments', { cache: 'no-store' }) 
            ]);
            if (!techResponse.ok || !apptResponse.ok) throw new Error('Failed to load data from the server.');
            const techData = await techResponse.json();
            const apptData = await apptResponse.json();
            allTechnicians = techData.technicians || [];
            allAppointments = apptData.appointments || [];
            populateTechSelects(allTechnicians); 
            renderScheduler();
        } catch (error) {
            console.error('Error on loadInitialData:', error);
            loadingOverlay.querySelector('p').textContent = `ERROR: ${error.message}`;
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
    techSelectDropdown.addEventListener('change', (e) => {
        selectedTechnician = e.target.value;
        renderScheduler();
    });
    searchCode.addEventListener('input', renderScheduler);
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal); 
    modalCloseXBtn.addEventListener('click', closeEditModal);
    
    // --- INITIALIZATION ---
    loadInitialData();
}); // CORREÇÃO: Adicionado o fecha parênteses e chaves que estava faltando.
