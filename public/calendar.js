// public/calendar.js

document.addEventListener('DOMContentLoaded', async () => {
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const selectedTechDisplay = document.getElementById('selected-tech-display');
    const loadingOverlay = document.getElementById('loading-overlay');
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const techConfigSelect = document.getElementById('tech-config-select');
    const availabilityFormContainer = document.getElementById('availability-form-container');
    const saveAvailabilityBtn = document.getElementById('save-availability-btn');
    const showedAppointmentsTableBody = document.getElementById('showed-appointments-table-body');

    // Modal de Edição de Agendamento
    const editModal = document.getElementById('edit-appointment-modal');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalVerificationSelect = document.getElementById('modal-verification');
    const modalApptId = document.getElementById('modal-appt-id');
    const modalDate = document.getElementById('modal-date');
    const modalServiceValue = document.getElementById('modal-service-value');
    const modalTips = document.getElementById('modal-tips');
    const modalOriginalTechnician = document.getElementById('modal-original-technician');
    const modalPetShowed = document.getElementById('modal-pet-showed');
    const modalPercentage = document.getElementById('modal-percentage');
    const modalPaymentMethod = document.getElementById('modal-payment-method');
    const modalCloseXBtn = document.getElementById('modal-close-x-btn');

    // Modal de Bloco de Tempo
    const addTimeBlockBtn = document.getElementById('add-time-block-btn');
    const timeBlockModal = document.getElementById('time-block-modal');
    const blockSaveBtn = document.getElementById('block-save-btn');
    const blockCancelBtn = document.getElementById('block-cancel-btn');

    let allAppointments = [];
    let allTechnicians = [];
    let techAvailabilityBlocks = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let isSaving = {};

    const SCHEDULE_DURATION_HOURS = 2;
    const SLOT_HEIGHT_PX = 60;

    const TIME_SLOTS = Array.from({ length: 11 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const VISIBLE_DAY_INDICES = [0, 1, 2, 3, 4, 5, 6];
    const VERIFICATION_OPTIONS = ["Scheduled", "Showed", "Canceled"];
    
    const petOptions = Array.from({ length: 10 }, (_, i) => i + 1);
    const percentageOptions = ["20%", "25%"];
    const paymentOptions = ["Check", "American Express", "Apple Pay", "Discover", "Master Card", "Visa", "Zelle", "Cash", "Invoice"];
    
    // --- Funções Auxiliares ---
    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }

    function formatDateToYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}/${month}/${day}`;
    }
    
    function parseSheetDate(dateStr) {
        if (!dateStr || dateStr.length < 16) return null;
        const [datePart, timePart] = dateStr.split(' ');
        const [year, month, day] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute); 
    }
    
    function getTimeHHMM(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        return dateTimeStr.replace(/\//g, '-').replace(' ', 'T'); 
    }

    // --- Funções do Modal de Edição de Agendamento ---
    function openEditModal(appt) {
        modalApptId.value = appt.id;
        modalOriginalTechnician.value = appt.technician;
        modalPetShowed.value = appt.petShowed || '';
        modalPercentage.value = appt.percentage || '';
        modalPaymentMethod.value = appt.paymentMethod || '';
        modalDate.value = formatDateTimeForInput(appt.appointmentDate);
        modalServiceValue.value = appt.serviceShowed || '';
        modalTips.value = appt.tips || '';
        modalVerificationSelect.innerHTML = VERIFICATION_OPTIONS.map(opt => 
            `<option value="${opt}" ${appt.verification === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');
        editModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    function closeEditModal() {
        if (editModal) editModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }

    function handleEditAppointmentClick(event) {
        const block = event.currentTarget;
        const apptId = block.dataset.id;
        const localAppt = allAppointments.find(a => String(a.id) === apptId);
        if (localAppt) openEditModal(localAppt);
    }
    
    async function handleSaveAppointment(event) {
        event.stopPropagation();
        modalSaveBtn.textContent = 'Salvando...';
        modalSaveBtn.disabled = true;

        const dataToUpdate = {
            rowIndex: parseInt(modalApptId.value, 10),
            appointmentDate: modalDate.value,
            verification: modalVerificationSelect.value,
            serviceShowed: modalServiceValue.value,
            tips: modalTips.value,
            technician: modalOriginalTechnician.value,
            petShowed: modalPetShowed.value || '',
            percentage: modalPercentage.value || '',
            paymentMethod: modalPaymentMethod.value || '',
        };

        try {
            const response = await fetch('/api/update-appointment-showed-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToUpdate),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            const localAppt = allAppointments.find(a => String(a.id) === modalApptId.value);
            if(localAppt) {
                localAppt.appointmentDate = dataToUpdate.appointmentDate.replace('T', ' ').replace(/-/g, '/');
                localAppt.verification = dataToUpdate.verification;
                localAppt.serviceShowed = dataToUpdate.serviceShowed;
                localAppt.tips = dataToUpdate.tips;
            }

            modalSaveBtn.textContent = 'Salvo!';
            setTimeout(() => {
                closeEditModal();
                modalSaveBtn.textContent = 'Save Changes';
                modalSaveBtn.disabled = false;
                renderScheduler();
            }, 1000);

        } catch (error) {
            console.error('Erro na API ao salvar:', error);
            modalSaveBtn.textContent = 'Erro!';
            modalSaveBtn.style.backgroundColor = 'hsl(0 84.2% 60.2%)';
            setTimeout(() => {
                modalSaveBtn.textContent = 'Save Changes';
                modalSaveBtn.disabled = false;
                modalSaveBtn.style.backgroundColor = '';
            }, 2500);
        }
    }

    // --- Funções do Modal de Bloco de Tempo ---
    function openTimeBlockModal() {
        if (!selectedTechnician) {
            alert('Please select a technician first.');
            return;
        }
        document.getElementById('time-block-form').reset();
        timeBlockModal.classList.remove('hidden');
    }

    function closeTimeBlockModal() {
        timeBlockModal.classList.add('hidden');
    }

    async function handleSaveTimeBlock() {
        const dateValue = document.getElementById('block-date').value;
        const startHourValue = document.getElementById('block-start-hour').value;
        const endHourValue = document.getElementById('block-end-hour').value;

        if (!dateValue || !startHourValue || !endHourValue) {
            alert('Date, Start Time, and End Time are required.');
            return;
        }

        const data = {
            technicianName: selectedTechnician,
            date: dateValue.replace(/-/g, '/'),
            startHour: startHourValue,
            endHour: endHourValue,
            notes: document.getElementById('block-notes').value,
        };

        try {
            const response = await fetch('/api/manage-technician-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            await fetchAvailabilityForSelectedTech();
            renderScheduler();
            closeTimeBlockModal();
            alert('Time block saved!');

        } catch (error) {
            console.error('Error saving time block:', error);
            alert(`Error: ${error.message}`);
        }
    }
    
    // --- Lógica Principal de Renderização ---
    function updateWeekDisplay() {
        const endOfWeek = new Date(currentWeekStart);
        endOfWeek.setDate(currentWeekStart.getDate() + 6);
        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = '';
        const columnMap = {};
        
        VISIBLE_DAY_INDICES.forEach((dayIndex, colIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            const dateKey = formatDateToYYYYMMDD(date);
            columnMap[dateKey] = colIndex + 2;
            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-l border-border';
            header.style.gridColumn = columnMap[dateKey];
            header.textContent = `${DAY_NAMES[dayIndex]} ${date.getDate()}`;
            schedulerHeader.appendChild(header);
        });
        
        TIME_SLOTS.forEach((time, rowIndex) => {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            timeDiv.style.gridRow = rowIndex + 1;
            schedulerBody.appendChild(timeDiv);
            VISIBLE_DAY_INDICES.forEach(dayIndex => {
                const date = new Date(currentWeekStart);
                date.setDate(currentWeekStart.getDate() + dayIndex);
                const dateKey = formatDateToYYYYMMDD(date);
                const emptySlot = document.createElement('div');
                emptySlot.className = 'time-slot border-t border-r border-border hover:bg-muted/10';
                emptySlot.style.gridRow = rowIndex + 1;
                emptySlot.style.gridColumn = columnMap[dateKey];
                schedulerBody.appendChild(emptySlot);
            });
        });
        
        renderAppointments(columnMap);
        renderTimeBlocks(columnMap);
        renderShowedAppointmentsTable();
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
        updateWeekDisplay();
    }
    
    function renderAppointments(columnMap) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        const appointmentsToRender = allAppointments.filter(appt => appt.technician === selectedTechnician);

        appointmentsToRender.forEach(appt => {
            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate || apptDate < currentWeekStart || apptDate >= weekEnd) return;
            const dateKey = formatDateToYYYYMMDD(apptDate);
            const colIndex = columnMap[dateKey];
            if (!colIndex) return;

            const topOffset = (apptDate.getHours() - 8) * SLOT_HEIGHT_PX + apptDate.getMinutes(); 
            const block = document.createElement('div');
            let bgColor = 'bg-custom-primary';
            if (appt.verification === 'Canceled') bgColor = 'bg-cherry-red';
            else if (appt.verification === 'Showed') bgColor = 'bg-green-600';
            
            block.className = `appointment-block ${bgColor} text-white rounded-md shadow-soft cursor-pointer transition-colors hover:shadow-lg`;
            block.dataset.id = appt.id;
            block.style.gridColumnStart = colIndex;
            block.style.top = `${topOffset}px`;

            const endTime = new Date(apptDate.getTime() + SCHEDULE_DURATION_HOURS * 60 * 60 * 1000);
            block.innerHTML = `<div data-view-content>
                <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(endTime)}</p>
                <p class="text-sm font-bold truncate">${appt.customers}</p>
                <p class="text-xs font-medium text-white/80">${appt.verification}</p>
                <p class="text-xs font-medium text-white/80">Service: $${appt.serviceShowed || '0.00'}</p>
                <p class="text-xs font-medium text-white/80">Tips: $${appt.tips || '0.00'}</p>
            </div>`;
            
            schedulerBody.appendChild(block);
            block.addEventListener('click', handleEditAppointmentClick);
        });
    }

    function renderTimeBlocks(columnMap) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);

        techAvailabilityBlocks.forEach(block => {
            if (!block || typeof block.date !== 'string' || block.date.trim() === '') {
                return;
            }
            
            const blockDate = new Date(block.date.replace(/\//g, '-') + 'T00:00:00');
            if (isNaN(blockDate.getTime())) return; // Ignora datas inválidas

            if (blockDate < currentWeekStart || blockDate >= weekEnd) return;

            const dateKey = formatDateToYYYYMMDD(blockDate);
            const colIndex = columnMap[dateKey];
            if (!colIndex) return;

            const [startH, startM] = block.startHour.split(':').map(Number);
            const [endH, endM] = block.endHour.split(':').map(Number);
            
            const topOffset = ((startH - 8) * SLOT_HEIGHT_PX) + (startM / 60 * SLOT_HEIGHT_PX);
            const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            const height = (durationMinutes / 60) * SLOT_HEIGHT_PX;

            const blockEl = document.createElement('div');
            blockEl.className = 'absolute w-full p-2 box-border rounded-md';
            blockEl.style.gridColumnStart = colIndex;
            blockEl.style.top = `${topOffset}px`;
            blockEl.style.height = `${height}px`;
            blockEl.style.backgroundColor = 'rgba(107, 114, 128, 0.7)';
            blockEl.style.zIndex = '5';
            blockEl.innerHTML = `
                <p class="text-xs font-semibold text-white truncate">${block.notes || 'Blocked'}</p>
                <p class="text-xs text-white/80">${block.startHour} - ${block.endHour}</p>
            `;
            schedulerBody.appendChild(blockEl);
        });
    }

    function renderShowedAppointmentsTable() {
        if (!showedAppointmentsTableBody) return;
        showedAppointmentsTableBody.innerHTML = '';
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);

        const appointmentsForWeek = allAppointments
            .filter(appt => {
                const apptDate = parseSheetDate(appt.appointmentDate);
                return appt.technician === selectedTechnician && apptDate >= currentWeekStart && apptDate < weekEnd;
            })
            .sort((a, b) => parseSheetDate(a.appointmentDate) - parseSheetDate(b.appointmentDate));

        if (appointmentsForWeek.length === 0) {
            showedAppointmentsTableBody.innerHTML = '<tr><td colspan="10" class="p-4 text-center text-muted-foreground">No appointments for this technician in the selected week.</td></tr>';
            return;
        }

        appointmentsForWeek.forEach(appointment => {
            const row = document.createElement('tr');
            row.className = 'border-b border-border hover:bg-muted/50';
            row.dataset.rowId = appointment.id;
            row.innerHTML = `
                <td class="p-4"><input type="datetime-local" value="${formatDateTimeForInput(appointment.appointmentDate)}" style="width: 160px;" class="bg-transparent border border-border rounded-md px-2" data-key="appointmentDate"></td>
                <td class="p-4">${appointment.customers.length > 18 ? appointment.customers.substring(0, 15) + '...' : appointment.customers}</td>
                <td class="p-4 code-cell">${appointment.code}</td>
                <td class="p-4"><input type="text" value="${appointment.technician}" class="bg-transparent border border-border rounded-md px-2" data-key="technician" disabled></td>
                <td class="p-4">
                    <select style="width: 60px;" class="bg-transparent border border-border rounded-md px-2" data-key="petShowed">
                        <option value="">Pets</option>
                        ${petOptions.map(num => `<option value="${num}" ${appointment.petShowed == String(num) ? 'selected' : ''}>${num}</option>`).join('')}
                    </select>
                </td>
                <td class="p-4"><input type="text" value="${appointment.serviceShowed || ''}" style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="serviceShowed"></td>
                <td class="p-4"><input type="text" value="${appointment.tips || ''}" style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" placeholder="$0.00" data-key="tips"></td>
                <td class="p-4">
                    <select style="width: 80px;" class="bg-transparent border border-border rounded-md px-2" data-key="percentage">
                        <option value="">%</option>
                        ${percentageOptions.map(option => `<option value="${option}" ${appointment.percentage === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
                <td class="p-4">
                    <select style="width: 120px;" class="bg-transparent border border-border rounded-md px-2" data-key="paymentMethod">
                        <option value="">Select...</option>
                        ${paymentOptions.map(option => `<option value="${option}" ${appointment.paymentMethod === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
                <td class="p-4">
                    <select style="width: 100px;" class="bg-transparent border border-border rounded-md px-2" data-key="verification">
                        <option value="">Select...</option>
                        ${VERIFICATION_OPTIONS.map(option => `<option value="${option}" ${appointment.verification === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </td>
            `;
            showedAppointmentsTableBody.appendChild(row);
        });
    }

    // --- Carregamento de Dados ---
    async function fetchAvailabilityForSelectedTech() {
        if (!selectedTechnician) {
            techAvailabilityBlocks = [];
            return;
        }
        try {
            const response = await fetch(`/api/manage-technician-availability?technicianName=${encodeURIComponent(selectedTechnician)}`);
            if (!response.ok) throw new Error('Could not fetch availability.');
            const data = await response.json();
            techAvailabilityBlocks = data.availability || [];
        } catch (error) {
            console.error('Error fetching availability:', error);
            techAvailabilityBlocks = [];
        }
    }

    async function loadInitialData() {
        try {
            const [techDataResponse, appointmentsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments')
            ]);
            if (!techDataResponse.ok || !appointmentsResponse.ok) throw new Error('Failed to load initial data.');
            const techData = await techDataResponse.json();
            const apptsData = await appointmentsResponse.json();
            allTechnicians = techData.technicians || [];
            allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            
            populateTechSelects();
            await fetchAvailabilityForSelectedTech();
            renderScheduler(); 
        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
        }
    }
    
    function populateTechSelects() {
        techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
        allTechnicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech;
            option.textContent = tech;
            techSelectDropdown.appendChild(option.cloneNode(true));
            if (techConfigSelect) techConfigSelect.appendChild(option.cloneNode(true));
        });
    }
    
    async function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        selectedTechDisplay.textContent = selectedTechnician || 'No Technician Selected';
        await fetchAvailabilityForSelectedTech();
        renderScheduler();
    }
    
    // --- Event Listeners ---
    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderScheduler();
    });
    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderScheduler();
    });
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal); 
    modalCloseXBtn.addEventListener('click', closeEditModal);

    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    blockSaveBtn.addEventListener('click', handleSaveTimeBlock);
    blockCancelBtn.addEventListener('click', closeTimeBlockModal);
    
    if (showedAppointmentsTableBody) {
        showedAppointmentsTableBody.addEventListener('change', async (event) => {
            const target = event.target;
            if (target.matches('input, select')) {
                const row = target.closest('tr');
                const apptId = row.dataset.rowId;

                if (isSaving[apptId]) return;
                
                isSaving[apptId] = true;
                row.classList.add('is-saving');

                const dataToUpdate = {
                    rowIndex: parseInt(apptId, 10),
                    appointmentDate: row.querySelector('[data-key="appointmentDate"]').value,
                    technician: row.querySelector('[data-key="technician"]').value,
                    petShowed: row.querySelector('[data-key="petShowed"]').value,
                    serviceShowed: row.querySelector('[data-key="serviceShowed"]').value,
                    tips: row.querySelector('[data-key="tips"]').value,
                    percentage: row.querySelector('[data-key="percentage"]').value,
                    paymentMethod: row.querySelector('[data-key="paymentMethod"]').value,
                    verification: row.querySelector('[data-key="verification"]').value,
                };
                
                try {
                    const response = await fetch('/api/update-appointment-showed-data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dataToUpdate),
                    });
                    const result = await response.json();
                    if (!result.success) throw new Error(result.message);
                    
                    const localAppt = allAppointments.find(a => String(a.id) === String(apptId));
                    if(localAppt) Object.assign(localAppt, dataToUpdate, {
                        appointmentDate: dataToUpdate.appointmentDate.replace('T', ' ').replace(/-/g, '/')
                    });

                    renderScheduler();
                    row.classList.add('is-success');
                } catch (error) {
                    console.error('Error saving from table:', error);
                    row.classList.add('is-error');
                } finally {
                    setTimeout(() => {
                        row.classList.remove('is-saving', 'is-success', 'is-error');
                        isSaving[apptId] = false;
                    }, 2000);
                }
            }
        });
    }

    loadInitialData();
});
