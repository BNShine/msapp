// public/calendar.js

document.addEventListener('DOMContentLoaded', async () => {
    // Novos elementos e elementos renomeados
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const selectedTechDisplay = document.getElementById('selected-tech-display');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // Elementos da grade
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    
    // Elementos de configuração de disponibilidade
    const techConfigSelect = document.getElementById('tech-config-select');
    const availabilityFormContainer = document.getElementById('availability-form-container');
    const saveAvailabilityBtn = document.getElementById('save-availability-btn');

    let allAppointments = []; // Todos os agendamentos brutos
    let allTechnicians = [];
    let selectedTechnician = ''; // O técnico atualmente selecionado
    let currentWeekStart = getStartOfWeek(new Date()); 
    
    let techAvailability = {}; 
    const SCHEDULE_DURATION_HOURS = 2; 

    // Horários de 8h às 18h (11 slots de 1 hora)
    const TIME_SLOTS = Array.from({ length: 11 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // Colunas visíveis: Mon (1) a Sat (6)
    const VISIBLE_DAY_INDICES = [1, 2, 3, 4, 5, 6]; 

    // --- Helper Functions (Mantidas as essenciais) ---

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
        // As datas vêm no formato YYYY/MM/DD HH:MM
        const [datePart, timePart] = dateStr.split(' ');
        const [year, month, day] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute); 
    }
    
    function getDayOfWeek(date) {
        return DAY_NAMES[date.getDay()];
    }

    function getTimeHHMM(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    function parseTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // A lógica de validação agora usa o 'selectedTechnician'
    function isValidAppointmentTime(technician, date, appointmentsToConsider) {
        const startTime = date.getTime();
        const endTime = startTime + (SCHEDULE_DURATION_HOURS * 60 * 60 * 1000);

        // 1. Validação de Bloqueio de Agendamentos Existentes
        const conflictingAppts = appointmentsToConsider.filter(appt => {
            if (appt.technician !== technician) return false;

            const existingStart = parseSheetDate(appt.appointmentDate);
            if (!existingStart) return false;

            const existingEnd = new Date(existingStart.getTime() + (SCHEDULE_DURATION_HOURS * 60 * 60 * 1000));
            
            const overlap = (startTime < existingEnd.getTime() && endTime > existingStart.getTime());
            return overlap;
        });

        if (conflictingAppts.length > 0) {
            console.warn(`Conflito com o agendamento: ${conflictingAppts[0].customers}`);
            return false;
        }
        
        // 2. Validação da Máscara de Disponibilidade Semanal (Opcional, mas mantido)
        const day = getDayOfWeek(date);
        const techConfig = techAvailability[technician];
        
        if (!techConfig || !techConfig[day] || !techConfig[day].active) {
             return date.getDay() >= 1 && date.getDay() <= 6; 
        }

        const availStart = parseTime(techConfig[day].start);
        const availEnd = parseTime(techConfig[day].end);
        
        const currentMinuteOfDay = date.getHours() * 60 + date.getMinutes();
        
        if (currentMinuteOfDay < availStart || currentMinuteOfDay + (SCHEDULE_DURATION_HOURS * 60) > availEnd) {
            console.warn(`Fora do horário de trabalho configurado para ${technician} em ${day}`);
            return false;
        }
        
        return true;
    }

    // --- UI Logic: Initial Data Load and Setup ---

    async function loadInitialData() {
        try {
            // Busca a lista de técnicos e os agendamentos em paralelo
            const [techDataResponse, appointmentsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-technician-appointments')
            ]);

            const techData = await techDataResponse.json();
            const apptsData = await appointmentsResponse.json();

            // Usa o array 'technicians' para o dropdown
            allTechnicians = techData.technicians || [];
            allAppointments = apptsData.appointments || [];

            // Inicializa a configuração de disponibilidade
            initializeAvailability(); 
            
            // Popula os seletores de técnico
            populateTechSelects();
            
            // Renderiza o calendário vazio inicialmente
            renderScheduler(); 

        } catch (error) {
            console.error('Error loading initial data:', error);
            alert('Falha ao carregar dados iniciais. Verifique a API.');
        }
    }
    
    function populateTechSelects() {
        // Popula o dropdown de seleção do calendário
        techSelectDropdown.innerHTML = '<option value="">Select Technician...</option>';
        allTechnicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech;
            option.textContent = tech;
            techSelectDropdown.appendChild(option);
        });
        
        // Popula o dropdown de configuração (reutiliza os dados)
        techConfigSelect.innerHTML = '<option value="">Select Technician</option>' + 
            allTechnicians.map(tech => `<option value="${tech}">${tech}</option>`).join('');

        // Adiciona listener para a seleção de técnico
        techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    }
    
    function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        if (selectedTechnician) {
            selectedTechDisplay.textContent = selectedTechnician;
            loadingOverlay.classList.add('hidden');
        } else {
            selectedTechDisplay.textContent = 'No Technician Selected';
            loadingOverlay.classList.remove('hidden');
        }
        renderScheduler();
    }
    
    // --- UI Logic: Scheduler Rendering (Ajustada) ---

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = '';
        
        // Colunas: Mon (1) a Sat (6)
        const numCols = VISIBLE_DAY_INDICES.length; 
        
        // Renderiza os cabeçalhos das colunas (Dia da Semana + Data)
        const columnMap = {};
        VISIBLE_DAY_INDICES.forEach((dayIndex, colIndex) => {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + dayIndex);
            
            const dayName = getDayOfWeek(date);
            const dateKey = formatDateToYYYYMMDD(date);
            
            columnMap[dateKey] = colIndex + 2; // Colunas de dados começam em 2
            
            const header = document.createElement('div');
            header.className = 'day-column-header p-2 font-semibold border-l border-border';
            header.style.gridColumn = columnMap[dateKey];
            header.textContent = `${dayName} ${date.getDate()} - ${selectedTechnician.split(' ')[0] || ''}`; 
            schedulerHeader.appendChild(header);
        });
        
        // Preenche a grade com slots de tempo
        TIME_SLOTS.forEach((time, rowIndex) => {
            // Linha do tempo
            const timeDiv = document.createElement('div');
            timeDiv.className = 'time-slot timeline-header p-2 text-xs font-medium border-t border-border flex items-center justify-center';
            timeDiv.textContent = time;
            timeDiv.style.gridRow = rowIndex + 1;
            timeDiv.style.gridColumn = 1;
            schedulerBody.appendChild(timeDiv);

            // Slots vazios para os dias da semana
            VISIBLE_DAY_INDICES.forEach(dayIndex => {
                const date = new Date(currentWeekStart);
                date.setDate(currentWeekStart.getDate() + dayIndex);
                const dateKey = formatDateToYYYYMMDD(date);

                const globalColIndex = columnMap[dateKey];
                const emptySlot = document.createElement('div');
                emptySlot.className = 'time-slot border-t border-r border-border hover:bg-muted/10';
                emptySlot.dataset.tech = selectedTechnician; // Marca o slot com o técnico selecionado
                emptySlot.dataset.time = time;
                emptySlot.dataset.datekey = dateKey; 
                emptySlot.style.gridRow = rowIndex + 1;
                emptySlot.style.gridColumn = globalColIndex;
                schedulerBody.appendChild(emptySlot);
            });
        });
        
        // Renderiza os agendamentos (blocos)
        renderAppointments(columnMap);
        
        // Se nenhum técnico estiver selecionado, exibe a overlay
        if (!selectedTechnician) {
            loadingOverlay.classList.remove('hidden');
        }
        
        updateWeekDisplay();
    }
    
    function renderAppointments(columnMap) {
        if (!selectedTechnician) return;
        
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        
        const filteredAppointments = allAppointments.filter(appt => 
            appt.technician === selectedTechnician
        );
        
        filteredAppointments.forEach(appt => {

            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate) return;

            // Filtra agendamentos para a semana atual
            if (apptDate < currentWeekStart || apptDate >= weekEnd) return;
            
            const dateKey = formatDateToYYYYMMDD(apptDate);
            
            // A coluna é determinada apenas pela DATA
            const colIndex = columnMap[dateKey];
            if (!colIndex) return; 
            
            const startHour = apptDate.getHours();
            const startMinutes = apptDate.getMinutes();
            
            const rowStart = (startHour - 8) + 1;
            const topOffset = (startHour - 8) * 60 + startMinutes;
            
            // Faixa de tempo (8h-18h)
            if (rowStart < 1 || rowStart > TIME_SLOTS.length || startHour < 8 || startHour >= 18) return;


            const block = document.createElement('div');
            // Altera a cor de fundo com base no Verification
            let bgColor = 'bg-brand-primary';
            if (appt.verification === 'Canceled') {
                bgColor = 'bg-destructive'; // Cor destrutiva (vermelho)
            } else if (appt.verification === 'Showed') {
                bgColor = 'bg-green-600'; // Cor verde forte (ajustado para classe utilitária)
            } else {
                 bgColor = 'bg-[#ff5a96]'; // Cor primária (rosa forte - do login.html)
            }

            block.className = `appointment-block ${bgColor} text-white rounded-md p-2 shadow-soft cursor-move absolute transition-colors hover:bg-brand-primary-hover`;
            block.dataset.id = appt.id;
            block.dataset.technician = appt.technician;
            block.dataset.date = appt.appointmentDate; 
            block.draggable = true;
            
            // Usa a coluna do dia (colIndex)
            block.style.gridColumn = colIndex; 
            block.style.top = `${topOffset}px`;

            const endTime = new Date(apptDate.getTime() + SCHEDULE_DURATION_HOURS * 60 * 60 * 1000);

            block.innerHTML = `
                <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(endTime)}</p>
                <p class="text-sm font-bold truncate">${appt.customers}</p>
                <p class="text-xs font-medium text-white/80">${appt.verification}</p>
            `;
            
            schedulerBody.appendChild(block);
            
            addDragAndDropListeners(block);
        });
    }

    function updateWeekDisplay() {
        const endOfWeek = new Date(currentWeekStart);
        endOfWeek.setDate(currentWeekStart.getDate() + 6);
        
        const startMonth = currentWeekStart.toLocaleString('en-US', { month: 'short' });
        const startDay = currentWeekStart.getDate().toString().padStart(2, '0');
        const endMonth = endOfWeek.toLocaleString('en-US', { month: 'short' });
        const endDay = endOfWeek.getDate().toString().padStart(2, '0');
        const year = currentWeekStart.getFullYear();
        
        currentWeekDisplay.textContent = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
    
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderScheduler();
    });

    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderScheduler();
    });

    // --- Drag and Drop Logic ---
    let draggedAppointment = null;
    
    function addDragAndDropListeners(element) {
        element.addEventListener('dragstart', (e) => {
            draggedAppointment = {
                element: element,
                id: element.dataset.id,
                technician: element.dataset.technician,
                originalDate: element.dataset.date,
                originalTop: element.style.top,
                originalColumn: element.style.gridColumn,
            };
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => element.style.display = 'none', 0);
        });

        element.addEventListener('dragend', (e) => {
            e.target.style.display = 'block';
            draggedAppointment = null;
        });
    }

    schedulerBody.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    schedulerBody.addEventListener('drop', (e) => {
        e.preventDefault();
        
        if (!draggedAppointment || !selectedTechnician) {
             draggedAppointment.element.style.display = 'block';
             return;
        }

        const target = e.target.closest('.time-slot'); 
        if (!target) {
             draggedAppointment.element.style.display = 'block';
             return;
        }
        
        // O técnico de destino é sempre o selecionado no dropdown, pois as colunas são dias
        const newTech = selectedTechnician; 
        const targetDateKey = target.dataset.datekey; 

        if (!targetDateKey) {
             draggedAppointment.element.style.display = 'block';
             return;
        }

        // 2. Calcula a nova data/hora (Ajustado o cálculo de snap)
        const rect = target.getBoundingClientRect();
        const dropY = e.clientY - rect.top; 
        
        const minuteUnit = 15; 
        const snapIncrement = (60 / minuteUnit); // 4 (para 15 em 15 min em slot de 60px)
        const snappedMinutes = Math.round(dropY / snapIncrement) * minuteUnit;
        
        const slotHour = parseTime(target.dataset.time) / 60; 
        
        const newHour = slotHour + Math.floor(snappedMinutes / 60);
        const newMinute = (snappedMinutes % 60);

        const newDate = parseSheetDate(`${targetDateKey} 00:00`); 
        newDate.setHours(newHour, newMinute, 0, 0);

        // 3. Validação Crucial: Bloqueio de 2 Horas e Disponibilidade
        const appointmentsExcludingSelf = allAppointments.filter(appt => appt.id !== draggedAppointment.id);

        if (!isValidAppointmentTime(newTech, newDate, appointmentsExcludingSelf)) {
            alert('Conflito: Este horário se sobrepõe a um agendamento de 2h existente ou está fora da disponibilidade do técnico.');
            
            draggedAppointment.element.style.display = 'block';
            return;
        }
        
        // 4. Atualiza a UI (Posição)
        const snapOffsetTop = (newHour - 8) * 60 + newMinute; // Posição em relação ao topo do Body (8h)
        const targetCol = target.style.gridColumn;

        draggedAppointment.element.style.top = `${snapOffsetTop}px`;
        draggedAppointment.element.style.gridColumn = targetCol;
        draggedAppointment.element.style.display = 'block';
        
        // 5. Atualiza a Data no Array Local e Envia para o Backend
        const newDateSheetFormat = formatDateToYYYYMMDD(newDate) + ' ' + getTimeHHMM(newDate);
        
        const localAppt = allAppointments.find(a => String(a.id) === draggedAppointment.id);
        if (localAppt) {
            localAppt.technician = newTech;
            localAppt.appointmentDate = newDateSheetFormat;
            
            // TODO: Chamar API de update
            console.log(`[API CALL SIMULADA] ID: ${localAppt.id} movido para Tech: ${newTech}, Horário: ${newDateSheetFormat}`);
             renderScheduler();
        }
    });
    
    // --- UI Logic: Availability Configuration (Opcional, mas mantido) ---

    function initializeAvailability() {
        const savedConfig = localStorage.getItem('techAvailability');
        if (savedConfig) {
            techAvailability = JSON.parse(savedConfig);
        }
    }
    
    function renderAvailabilityForm(technician) {
        if (!technician) {
            availabilityFormContainer.innerHTML = '<p class="text-muted-foreground">Please select a technician.</p>';
            return;
        }
        
        const techConfig = techAvailability[technician] || {};
        const days = DAY_NAMES;
        
        const timeOptionsStart = TIME_SLOTS;
        const timeOptionsEnd = TIME_SLOTS.slice(1);

        availabilityFormContainer.innerHTML = days.map(day => {
            const config = techConfig[day] || { start: '09:00', end: '17:00', active: (day !== 'Sun') };
            const isDisabled = day === 'Sun' || !config.active;
            
            const startOptionsHtml = timeOptionsStart.map(t => 
                `<option value="${t}" ${config.start === t ? 'selected' : ''}>${t}</option>`
            ).join('');
            
            const endOptionsHtml = timeOptionsEnd.map(t => 
                `<option value="${t}" ${config.end === t ? 'selected' : ''}>${t}</option>`
            ).join('');


            return `
                <div class="flex items-center gap-4 p-4 border rounded-lg ${config.active ? 'border-brand-primary/20 bg-muted/50' : 'bg-muted/10'}">
                    <input type="checkbox" id="${day}-active" data-day="${day}" class="availability-checkbox" ${config.active ? 'checked' : ''} ${day === 'Sun' ? 'disabled' : ''}>
                    <label for="${day}-active" class="flex-1 font-semibold">${day}</label>
                    <select data-day="${day}" data-field="start" class="w-32 p-2 border rounded-md" ${isDisabled ? 'disabled' : ''}>
                        ${startOptionsHtml}
                    </select>
                    <span>to</span>
                    <select data-day="${day}" data-field="end" class="w-32 p-2 border rounded-md" ${isDisabled ? 'disabled' : ''}>
                        ${endOptionsHtml}
                    </select>
                </div>
            `;
        }).join('');
        
        availabilityFormContainer.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', handleAvailabilityChange);
        });
        availabilityFormContainer.querySelectorAll('.availability-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleAvailabilityChange);
        });
    }

    function handleTechConfigSelectChange(e) {
        const technician = e.target.value;
        renderAvailabilityForm(technician);
    }
    
    function handleAvailabilityChange(e) {
        const technician = techConfigSelect.value;
        if (!technician) return;
        
        const day = e.target.dataset.day;
        const field = e.target.dataset.field;
        const isCheckbox = e.target.type === 'checkbox';
        
        if (!techAvailability[technician]) {
            techAvailability[technician] = {};
        }
        if (!techAvailability[technician][day]) {
            techAvailability[technician][day] = { start: '09:00', end: '17:00', active: (day !== 'Sun') };
        }
        
        if (isCheckbox) {
            techAvailability[technician][day].active = e.target.checked;
        } else {
            techAvailability[technician][day][field] = e.target.value;
        }
        
        renderAvailabilityForm(technician);
    }

    saveAvailabilityBtn.addEventListener('click', () => {
        if (!techConfigSelect.value) {
            alert('Please select a technician before saving.');
            return;
        }
        localStorage.setItem('techAvailability', JSON.stringify(techAvailability));
        alert('Availability saved successfully!');
        renderScheduler(); 
    });

    techConfigSelect.addEventListener('change', handleTechConfigSelectChange);

    // --- Initialization ---
    loadInitialData();
});
