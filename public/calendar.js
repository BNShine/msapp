// public/calendar.js

document.addEventListener('DOMContentLoaded', async () => {
    const techCheckboxes = document.getElementById('tech-checkboxes');
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    const techConfigSelect = document.getElementById('tech-config-select');
    const availabilityFormContainer = document.getElementById('availability-form-container');
    const saveAvailabilityBtn = document.getElementById('save-availability-btn');

    let allAppointments = [];
    let allTechnicians = [];
    let visibleTechnicians = [];
    let currentWeekStart = getStartOfWeek(new Date()); 
    
    let techAvailability = {}; 
    const SCHEDULE_DURATION_HOURS = 2; 

    const TIME_SLOTS = Array.from({ length: 11 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`);
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // --- Helper Functions ---

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
        
        // 2. Validação da Máscara de Disponibilidade Semanal
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

            // Usa o array 'technicians' do endpoint de dashboard
            allTechnicians = techData.technicians || [];
            allAppointments = apptsData.appointments || [];

            initializeAvailability(); 
            
            const cachedVisibleTechs = localStorage.getItem('visibleTechnicians');
            visibleTechnicians = cachedVisibleTechs 
                ? JSON.parse(cachedVisibleTechs).filter(t => allTechnicians.includes(t)) // Filtra techs removidos
                : allTechnicians;

            populateTechSelects();
            renderScheduler();

        } catch (error) {
            console.error('Error loading initial data:', error);
            alert('Falha ao carregar dados iniciais. Verifique a API.');
        }
    }
    
    function populateTechSelects() {
        // Popula o seletor de configuração
        techConfigSelect.innerHTML = '<option value="">Select Technician</option>';
        allTechnicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech;
            option.textContent = tech;
            techConfigSelect.appendChild(option);
        });

        // Configura o painel lateral de checkboxes
        techCheckboxes.innerHTML = allTechnicians.map(tech => `
            <div class="flex items-center space-x-2">
                <input type="checkbox" id="tech-${tech}" value="${tech}" ${visibleTechnicians.includes(tech) ? 'checked' : ''} class="tech-filter-checkbox">
                <label for="tech-${tech}" class="text-sm cursor-pointer">${tech}</label>
            </div>
        `).join('');
        
        // Adiciona listener para os checkboxes
        techCheckboxes.querySelectorAll('.tech-filter-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleTechFilterChange);
        });
        
        techConfigSelect.addEventListener('change', handleTechConfigSelectChange);
    }
    
    function handleTechFilterChange(event) {
        const techName = event.target.value;
        if (event.target.checked) {
            if (!visibleTechnicians.includes(techName)) {
                visibleTechnicians.push(techName);
            }
        } else {
            visibleTechnicians = visibleTechnicians.filter(t => t !== techName);
        }
        localStorage.setItem('visibleTechnicians', JSON.stringify(visibleTechnicians));
        renderScheduler();
    }
    
    // --- UI Logic: Scheduler Rendering ---

    function renderScheduler() {
        // Renderiza Cabeçalhos de Tempo e Colunas
        schedulerHeader.innerHTML = '<div class="timeline-header p-2 font-semibold">Time</div>';
        schedulerBody.innerHTML = '';
        
        const currentDays = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i);
            currentDays.push(date);
        }

        // Determina os dias visíveis (Mon a Sat)
        const visibleDays = currentDays.filter(d => d.getDay() >= 1 && d.getDay() <= 6);
        const visibleCols = visibleTechnicians.length * visibleDays.length;
        
        // Atualiza a variável CSS para a grade
        schedulerHeader.style.setProperty('--num-techs', visibleCols || 1);
        schedulerBody.style.setProperty('--num-techs', visibleCols || 1);
        
        const columnMap = {};
        
        // Renderiza os cabeçalhos das colunas (Data + Técnico)
        visibleDays.forEach((date, dayIndex) => {
             visibleTechnicians.forEach((tech, techIndex) => {
                const globalColIndex = (dayIndex * visibleTechnicians.length) + techIndex + 2; // +2 porque a coluna 1 é o Time
                columnMap[`${formatDateToYYYYMMDD(date)}|${tech}`] = globalColIndex;
                
                const header = document.createElement('div');
                header.className = 'tech-column-header p-2 font-semibold border-l border-border';
                header.style.gridColumn = globalColIndex;
                header.textContent = `${getDayOfWeek(date)} ${date.getDate()} - ${tech.split(' ')[0]}`; // Nome + Dia
                schedulerHeader.appendChild(header);
            });
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

            // Slots vazios para os técnicos
            visibleDays.forEach(date => {
                const dateKey = formatDateToYYYYMMDD(date);
                 visibleTechnicians.forEach(tech => {
                    const globalColIndex = columnMap[`${dateKey}|${tech}`];
                    const emptySlot = document.createElement('div');
                    emptySlot.className = 'time-slot border-t border-r border-border hover:bg-muted/10';
                    emptySlot.dataset.tech = tech;
                    emptySlot.dataset.time = time;
                    emptySlot.dataset.datekey = dateKey; // Adiciona a data
                    emptySlot.style.gridRow = rowIndex + 1;
                    emptySlot.style.gridColumn = globalColIndex;
                    schedulerBody.appendChild(emptySlot);
                });
            });
        });
        
        renderAppointments(columnMap);
        updateWeekDisplay();
    }
    
    function renderAppointments(columnMap) {
        
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);
        
        allAppointments.forEach(appt => {
            if (!visibleTechnicians.includes(appt.technician)) return;

            const apptDate = parseSheetDate(appt.appointmentDate);
            if (!apptDate) return;

            // Filtra agendamentos para a semana atual
            if (apptDate < currentWeekStart || apptDate >= weekEnd) return;
            
            const dateKey = formatDateToYYYYMMDD(apptDate);
            const key = `${dateKey}|${appt.technician}`;

            const colIndex = columnMap[key];
            if (!colIndex) return; // Se a coluna não estiver visível
            
            const startHour = apptDate.getHours();
            const startMinutes = apptDate.getMinutes();
            
            const rowStart = (startHour - 8) + 1;
            const topOffset = (startHour - 8) * 60 + startMinutes;
            
            if (rowStart < 1 || rowStart > TIME_SLOTS.length || startHour < 8 || startHour >= 18) return;


            const block = document.createElement('div');
            // Altera a cor de fundo com base no Verification
            let bgColor = 'bg-brand-primary';
            if (appt.verification === 'Canceled') {
                bgColor = 'bg-destructive';
            } else if (appt.verification === 'Showed') {
                bgColor = 'bg-green-600';
            }

            block.className = `appointment-block ${bgColor} text-white rounded-md p-2 shadow-soft cursor-move absolute transition-colors hover:bg-brand-primary-hover`;
            block.dataset.id = appt.id;
            block.dataset.technician = appt.technician;
            block.dataset.date = appt.appointmentDate; 
            block.draggable = true;
            
            block.style.gridColumn = colIndex; 
            block.style.top = `${topOffset}px`;

            block.innerHTML = `
                <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(new Date(apptDate.getTime() + SCHEDULE_DURATION_HOURS * 60 * 60 * 1000))}</p>
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
        
        if (!draggedAppointment) return;

        const target = e.target.closest('.time-slot'); // Apenas aceita drop em slots vazios
        if (!target) {
             draggedAppointment.element.style.display = 'block';
             return;
        }
        
        const newTech = target.dataset.tech;
        const targetDateKey = target.dataset.datekey; 

        if (!visibleTechnicians.includes(newTech) || !targetDateKey) {
             draggedAppointment.element.style.display = 'block';
             return;
        }

        // 2. Calcula a nova data/hora
        const rect = target.getBoundingClientRect();
        const dropY = e.clientY - rect.top; // Posição Y relativa ao topo do SLOT
        
        const minuteUnit = 15; // 15 minutos de snap
        const snapOffsetMinutes = Math.round(dropY / (60 / minuteUnit)) * minuteUnit; // offset em minutos (0, 15, 30, 45, 60)
        
        const slotHour = parseTime(target.dataset.time) / 60; // 8, 9, 10, ...
        
        const newHour = slotHour + Math.floor(snapOffsetMinutes / 60);
        const newMinute = (snapOffsetMinutes % 60);

        const newDate = parseSheetDate(`${targetDateKey} 00:00`); // Cria data baseada na data do slot
        newDate.setHours(newHour, newMinute, 0, 0);

        // 3. Validação Crucial: Bloqueio de 2 Horas e Disponibilidade
        const appointmentsExcludingSelf = allAppointments.filter(appt => appt.id !== draggedAppointment.id);

        if (!isValidAppointmentTime(newTech, newDate, appointmentsExcludingSelf)) {
            alert('Conflito: Este horário se sobrepõe a um agendamento de 2h existente ou está fora da disponibilidade do técnico.');
            
            // Volta para a posição original
            draggedAppointment.element.style.display = 'block';
            return;
        }
        
        // 4. Atualiza a UI (Posição)
        const snapOffsetTop = (newHour - 8) * 60 + newMinute;

        draggedAppointment.element.style.top = `${snapOffsetTop}px`;
        draggedAppointment.element.style.gridColumn = columnMap[key];
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
    
    // --- UI Logic: Availability Configuration (Referência Imagem 2) ---

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
        
        // Opções de tempo para seleção (começando em 8:00 até 18:00)
        const timeOptionsStart = TIME_SLOTS.map(t => `<option value="${t}">${t}</option>`).join('');
        const timeOptionsEnd = TIME_SLOTS.slice(1).map(t => `<option value="${t}">${t}</option>`).join('');

        availabilityFormContainer.innerHTML = days.map(day => {
            const config = techConfig[day] || { start: '09:00', end: '17:00', active: (day !== 'Sun') };
            const isDisabled = day === 'Sun' || !config.active;
            
            // Seleção correta das opções para o dia
            const startOptionsHtml = TIME_SLOTS.map(t => 
                `<option value="${t}" ${config.start === t ? 'selected' : ''}>${t}</option>`
            ).join('');
            
            const endOptionsHtml = TIME_SLOTS.slice(1).map(t => 
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
        
        // Adiciona listeners para os campos
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
        
        // Re-renderiza o formulário para atualizar o estado desabilitado/ativo
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

    // --- Initialization ---
    loadInitialData();
});
