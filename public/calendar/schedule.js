// public/calendar/schedule.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. Seletores de Elementos ---
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const selectedTechDisplay = document.getElementById('selected-tech-display');
    const loadingOverlay = document.getElementById('loading-overlay');
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const todayBtn = document.getElementById('today-btn');
    const addTimeBlockBtn = document.getElementById('add-time-block-btn');
    const miniCalendarContainer = document.getElementById('mini-calendar-container');

    // Modais e seus botões
    const editModal = document.getElementById('edit-appointment-modal');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const timeBlockModal = document.getElementById('time-block-modal');
    const blockSaveBtn = document.getElementById('block-save-btn');
    const blockCancelBtn = document.getElementById('block-cancel-btn');
    const editTimeBlockModal = document.getElementById('edit-time-block-modal');
    const editBlockSaveBtn = document.getElementById('edit-block-save-btn');
    const editBlockCancelBtn = document.getElementById('edit-block-cancel-btn');
    const editBlockDeleteBtn = document.getElementById('edit-block-delete-btn');
    const editBlockRowNumberInput = document.getElementById('edit-block-row-number');
    const editBlockDateInput = document.getElementById('edit-block-date');
    const editBlockStartInput = document.getElementById('edit-block-start-hour');
    const editBlockEndInput = document.getElementById('edit-block-end-hour');
    const editBlockNotesInput = document.getElementById('edit-block-notes');

    // --- 2. Variáveis Globais e Constantes ---
    let allAppointments = [];
    let allTechnicians = [];
    let techCoverageData = [];
    let techAvailabilityBlocks = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());
    let miniCalDate = new Date();

    const SLOT_HEIGHT_PX = 60; // Representa 60 minutos de altura
    const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${(7 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MIN_HOUR = 7;
    const MAX_HOUR = 21;

    // --- 3. Funções Auxiliares ---

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
        if (!dateStr) return null;
        const [datePart, timePart] = dateStr.split(' ');
        if (!datePart || !timePart) return null;
        const dateParts = datePart.split('/');
        if (dateParts.length !== 3) return null;
        const [month, day, year] = dateParts.map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;
        return new Date(year, month - 1, day, hour, minute);
    }

    function getTimeHHMM(date) {
        if (!date) return '';
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    function formatDateTimeForInput(dateTimeStr) {
        if (!dateTimeStr) return '';
        const date = parseSheetDate(dateTimeStr);
        if (!date) return '';
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}`;
    }
    
    async function getTravelTime(originZip, destinationZip) {
        if (!originZip || !destinationZip || originZip === destinationZip) return 0;
        try {
            // Reutiliza a API de otimização para um cálculo simples de A para B
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originZip,
                    waypoints: [{ zipCode: destinationZip }],
                    isReversed: true // Não otimiza, apenas calcula a rota direta
                })
            });
            const result = await response.json();
            if (result.success && result.routeData.routes[0]?.legs?.length > 0) {
                // A duração vem em segundos, convertemos para minutos
                return result.routeData.routes[0].legs[0].duration.value / 60;
            }
            return 0; // Retorna 0 se não encontrar rota
        } catch (error) {
            console.error("Error fetching travel time:", error);
            return 0; // Retorna 0 em caso de erro de rede
        }
    }


    // --- 4. Lógica do Mini Calendário ---

    function renderMiniCalendar() {
        // ... (código do mini-calendário permanece o mesmo)
    }

    // --- 5. Funções de Manipulação dos Modais ---

    function openEditModal(appt) {
        const { id, appointmentDate, verification } = appt;
        document.getElementById('modal-appt-id').value = id;
        document.getElementById('modal-date').value = formatDateTimeForInput(appointmentDate);
        const verificationSelect = document.getElementById('modal-verification');
        
        const statusOptions = ["Scheduled", "Confirmed", "Showed", "Canceled"];
        verificationSelect.innerHTML = statusOptions.map(opt =>
            `<option value="${opt}" ${verification === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');
        
        editModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }

    // ... (restante das funções de abrir/fechar modais permanecem as mesmas)

    // --- 6. Funções de Manipulação de Dados (API Calls) ---
    
    async function handleSaveAppointment() {
        // ... (código para salvar agendamento permanece o mesmo)
    }

    // ... (restante das funções de salvar/atualizar/deletar time blocks permanecem as mesmas)
    
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

    // --- 7. Funções de Renderização (COM A NOVA LÓGICA) ---

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = ''; 

        TIME_SLOTS.forEach((time, rowIndex) => {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            timeDiv.style.gridRow = `${rowIndex + 1} / span 1`;
            schedulerBody.appendChild(timeDiv);
        });
        
        DAY_NAMES.forEach((dayName, dayIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            const dateKey = formatDateToYYYYMMDD(date);
            const column = dayIndex + 2;

            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-l border-border';
            header.style.gridColumn = column;
            header.textContent = `${dayName} ${date.getDate()}`;
            schedulerHeader.appendChild(header);

            const dayContainer = document.createElement('div');
            dayContainer.className = 'relative border-r border-border';
            dayContainer.style.gridColumn = column;
            dayContainer.style.gridRow = `1 / span ${TIME_SLOTS.length}`;
            dayContainer.dataset.dateKey = dateKey;
            
            TIME_SLOTS.forEach((_, rowIndex) => {
                 const line = document.createElement('div');
                 line.className = 'absolute w-full border-t border-border/50';
                 line.style.height = '1px';
                 line.style.top = `${(rowIndex + 1) * SLOT_HEIGHT_PX}px`;
                 dayContainer.appendChild(line);
            });

            schedulerBody.appendChild(dayContainer);
        });

        renderAppointmentsDynamically();
        renderTimeBlocks();
        updateWeekDisplay();
        loadingOverlay.classList.toggle('hidden', !!selectedTechnician);
    }

    async function renderAppointmentsDynamically() {
        if (!selectedTechnician) return;

        const techInfo = techCoverageData.find(t => t.nome === selectedTechnician);
        if (!techInfo) {
            console.warn(`Informações de cobertura não encontradas para o técnico: ${selectedTechnician}`);
            return;
        }
        const techOriginZip = techInfo.zip_code;

        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);

        const appointmentsToRender = allAppointments.filter(appt => 
            appt.technician === selectedTechnician &&
            parseSheetDate(appt.appointmentDate) >= currentWeekStart &&
            parseSheetDate(appt.appointmentDate) < weekEnd
        );

        const appointmentsByDay = appointmentsToRender.reduce((acc, appt) => {
            const dateKey = formatDateToYYYYMMDD(parseSheetDate(appt.appointmentDate));
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(appt);
            return acc;
        }, {});

        for (const dateKey in appointmentsByDay) {
            const dayAppointments = appointmentsByDay[dateKey].sort((a, b) => parseSheetDate(a.appointmentDate) - parseSheetDate(b.appointmentDate));
            
            let previousZip = techOriginZip;

            for (const appt of dayAppointments) {
                const apptDate = parseSheetDate(appt.appointmentDate);
                const dayContainer = schedulerBody.querySelector(`[data-date-key="${dateKey}"]`);
                if (!dayContainer) continue;

                const travelTime = await getTravelTime(previousZip, appt.zipCode);

                const serviceDuration = (parseInt(appt.pets, 10) || 1) * 60;
                const margin = parseInt(appt.margin, 10) || 30;
                const totalBlockDuration = travelTime + serviceDuration + margin;

                const blockHeight = (totalBlockDuration / 60) * SLOT_HEIGHT_PX;
                
                const blockStartMoment = new Date(apptDate.getTime() - (travelTime * 60000));
                const topOffset = ((blockStartMoment.getHours() - MIN_HOUR) * 60 + blockStartMoment.getMinutes()) / 60 * SLOT_HEIGHT_PX;

                const block = document.createElement('div');
                let bgColor = 'bg-custom-primary';
                let textColor = 'text-white';

                if (appt.verification === 'Canceled') bgColor = 'bg-cherry-red';
                else if (appt.verification === 'Showed') bgColor = 'bg-green-600';
                else if (appt.verification === 'Confirmed') {
                    bgColor = 'bg-yellow-confirmed';
                    textColor = 'text-black';
                }

                block.className = `appointment-block ${bgColor} ${textColor} rounded-md shadow-soft cursor-pointer transition-colors hover:shadow-lg`;
                block.dataset.id = appt.id;
                block.style.top = `${topOffset}px`;
                block.style.height = `${blockHeight}px`;
                block.style.width = '100%'; // Ocupa a largura da coluna

                const serviceEndTime = new Date(apptDate.getTime() + (serviceDuration + margin) * 60000);

                block.innerHTML = `
                    <div>
                        <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(serviceEndTime)}</p>
                        <p class="text-sm font-bold truncate">${appt.customers}</p>
                        <p class="text-xs font-medium opacity-80">${appt.verification}</p>
                        <p class="text-xs font-medium opacity-80">Travel: ${Math.round(travelTime)} min</p>
                    </div>
                `;
                
                block.addEventListener('click', () => openEditModal(appt));
                dayContainer.appendChild(block);
                
                previousZip = appt.zipCode;
            }
        }
    }
    
    function renderTimeBlocks() {
        // ... (código para renderizar time blocks permanece o mesmo)
    }

    function updateWeekDisplay() {
        const endOfWeek = new Date(currentWeekStart);
        endOfWeek.setDate(currentWeekStart.getDate() + 6);
        currentWeekDisplay.textContent = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
    }

    // --- 8. Inicialização e Event Listeners ---

    async function loadInitialData() {
        try {
            const [techDataResponse, appointmentsResponse, coverageResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments'),
                fetch('/api/get-tech-coverage')
            ]);
            
            if (!techDataResponse.ok || !appointmentsResponse.ok || !coverageResponse.ok) {
                throw new Error(`Failed to load initial data.`);
            }
            
            const techData = await techDataResponse.json();
            const apptsData = await appointmentsResponse.json();
            techCoverageData = await coverageResponse.json();

            allTechnicians = techData.technicians || [];
            allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
            
            populateTechSelects();
            renderScheduler();
            renderMiniCalendar();

        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
        }
    }

    function populateTechSelects() {
        if (!techSelectDropdown) return;
        if (allTechnicians && allTechnicians.length > 0) {
            techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
            allTechnicians.forEach(tech => {
                const option = document.createElement('option');
                option.value = tech;
                option.textContent = tech;
                techSelectDropdown.appendChild(option);
            });
        } else {
            techSelectDropdown.innerHTML = '<option value="">No technicians found.</option>';
        }
    }

    async function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        if (selectedTechnician) {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">${selectedTechnician}</p> <p class="text-sm text-muted-foreground">Schedule and details below.</p>`;
        } else {
            selectedTechDisplay.innerHTML = `<p class="font-bold text-brand-primary">No Technician Selected</p><p class="text-sm text-muted-foreground">Select a technician from the top bar to view their schedule.</p>`;
        }
        await fetchAvailabilityForSelectedTech();
        renderScheduler();
        document.dispatchEvent(new CustomEvent('technicianChanged', { detail: { technician: selectedTechnician, weekStart: currentWeekStart } }));
    }

    // --- Adicionando todos os Event Listeners ---
    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderScheduler();
        renderMiniCalendar();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });
    
    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderScheduler();
        renderMiniCalendar();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });
    
    todayBtn.addEventListener('click', () => {
        currentWeekStart = getStartOfWeek(new Date());
        miniCalDate = new Date();
        renderScheduler();
        renderMiniCalendar();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });
    
    modalSaveBtn.addEventListener('click', handleSaveAppointment);
    modalCancelBtn.addEventListener('click', closeEditModal);
    addTimeBlockBtn.addEventListener('click', openTimeBlockModal);
    blockSaveBtn.addEventListener('click', handleSaveTimeBlock);
    blockCancelBtn.addEventListener('click', closeTimeBlockModal);
    editBlockSaveBtn.addEventListener('click', handleUpdateTimeBlock);
    editBlockDeleteBtn.addEventListener('click', handleDeleteTimeBlock);
    editBlockCancelBtn.addEventListener('click', closeEditTimeBlockModal);

    document.addEventListener('appointmentUpdated', async () => {
        const appointmentsResponse = await fetch('/api/get-technician-appointments');
        const apptsData = await appointmentsResponse.json();
        allAppointments = (apptsData.appointments || []).filter(appt => appt.appointmentDate && parseSheetDate(appt.appointmentDate));
        renderScheduler();
    });

    loadInitialData();
});
