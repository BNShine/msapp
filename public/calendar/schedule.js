// public/calendar/schedule.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. Seletores de Elementos (Atualizados para o novo HTML) ---
    const techSelectDropdown = document.getElementById('tech-select-dropdown');
    const schedulerHeader = document.getElementById('scheduler-header');
    const schedulerBody = document.getElementById('scheduler-body');
    const currentWeekDisplay = document.getElementById('current-week-display');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const todayBtn = document.getElementById('today-btn');
    // Os modais e os seus seletores internos permanecem os mesmos, pois não foram alterados no HTML
    const editModal = document.getElementById('edit-appointment-modal');

    // --- 2. Variáveis Globais e Constantes ---
    let allAppointments = [];
    let allTechnicians = [];
    let selectedTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());

    const HOUR_HEIGHT_PX = 60; // Altura de 1 hora na grelha (2 slots de 30px)
    const START_HOUR = 7;
    const END_HOUR = 21;

    // --- 3. Funções Auxiliares (Datas, etc.) ---

    function getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    }

    function parseSheetDate(dateStr) {
        if (!dateStr) return null;
        const [datePart, timePart] = dateStr.split(' ');
        if (!datePart || !timePart) return null;
        const [month, day, year] = datePart.split('/').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;
        return new Date(year, month - 1, day, hour, minute);
    }

    // --- 4. Lógica Principal de Renderização (Totalmente Refatorada) ---

    function renderScheduler() {
        schedulerHeader.innerHTML = '<div class="grid-col-1"></div>'; // Espaço para a coluna de tempo
        schedulerBody.innerHTML = '';
        updateWeekDisplay();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Renderiza os cabeçalhos dos dias
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);
            
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNumber = date.getDate();

            // Destaca o dia atual
            if (date.getTime() === today.getTime()) {
                dayHeader.innerHTML = `<span class="font-semibold">${dayName}</span> <span class="today">${dayNumber}</span>`;
            } else {
                dayHeader.innerHTML = `<span class="font-semibold">${dayName}</span> <span>${dayNumber}</span>`;
            }
            
            schedulerHeader.appendChild(dayHeader);
        }
        
        // Renderiza as linhas de horário e as colunas dos dias
        for (let hour = START_HOUR; hour < END_HOUR; hour++) {
            // Adiciona a etiqueta de tempo (ex: 8 AM)
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            timeLabel.textContent = `${hour === 12 ? 12 : hour % 12}${hour < 12 ? 'AM' : 'PM'}`;
            timeLabel.style.gridRow = (hour - START_HOUR) * 2 + 1;
            schedulerBody.appendChild(timeLabel);

            // Adiciona a linha horizontal para a hora cheia
            const hourLine = document.createElement('div');
            hourLine.className = 'hour-line';
            hourLine.style.gridRow = (hour - START_HOUR) * 2 + 1;
            schedulerBody.appendChild(hourLine);
        }

        // Cria as colunas dos dias onde os agendamentos serão inseridos
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(date.getDate() + i);
            
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            dayColumn.style.gridColumn = i + 2;
            dayColumn.style.gridRow = `1 / span ${(END_HOUR - START_HOUR) * 2}`;
            dayColumn.dataset.date = date.toISOString().split('T')[0]; // ex: 2025-10-05
            schedulerBody.appendChild(dayColumn);
        }
        
        renderAppointments();
    }

    function renderAppointments() {
        const appointmentsToRender = allAppointments.filter(appt => appt.technician === selectedTechnician);

        appointmentsToRender.forEach(appt => {
            const startDate = parseSheetDate(appt.appointmentDate);
            if (!startDate) return;

            const dateKey = startDate.toISOString().split('T')[0];
            const dayColumn = schedulerBody.querySelector(`[data-date="${dateKey}"]`);

            if (!dayColumn) return; // Se o agendamento não pertence a esta semana

            const endDate = new Date(startDate.getTime() + (appt.duration || 120) * 60000); // Usa duração ou assume 120 min

            const startMinutes = (startDate.getHours() - START_HOUR) * 60 + startDate.getMinutes();
            const endMinutes = (endDate.getHours() - START_HOUR) * 60 + endDate.getMinutes();
            
            // Calcula a posição e altura em pixels (1px por minuto)
            const top = startMinutes * (HOUR_HEIGHT_PX / 60);
            const height = (endMinutes - startMinutes) * (HOUR_HEIGHT_PX / 60);

            const card = document.createElement('div');
            card.className = 'appointment-card';
            card.style.top = `${top}px`;
            card.style.height = `${height - 2}px`; // -2 para uma pequena margem

            // Define a cor da borda com base no status
            const statusClass = `status-${(appt.verification || 'scheduled').toLowerCase()}`;
            card.classList.add(statusClass);

            card.innerHTML = `
                <p class="card-title">${appt.customers}</p>
                <p class="card-time">${getTimeHHMM(startDate)} - ${getTimeHHMM(endDate)}</p>
                <p class="card-details">Pets: ${appt.pets || 'N/A'}</p>
            `;

            // Adiciona evento de clique para abrir o modal
            card.addEventListener('click', () => {
                // Implementar a lógica para abrir o modal de edição
                // openEditModal(appt); // Reativar quando o modal for redesenhado
            });

            dayColumn.appendChild(card);
        });
    }

    function updateWeekDisplay() {
        const endOfWeek = new Date(currentWeekStart);
        endOfWeek.setDate(currentWeekStart.getDate() + 6);
        
        const startMonth = currentWeekStart.toLocaleDateString('en-US', { month: 'short' });
        const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' });

        if (startMonth === endMonth) {
            currentWeekDisplay.textContent = `${startMonth} ${currentWeekStart.getDate()} - ${endOfWeek.getDate()}, ${currentWeekStart.getFullYear()}`;
        } else {
            currentWeekDisplay.textContent = `${startMonth} ${currentWeekStart.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${currentWeekStart.getFullYear()}`;
        }
    }

    // --- 8. Inicialização e Event Listeners ---

    async function loadInitialData() {
        try {
            // ... (lógica de carregamento de dados existente)
            
            // Simulação de dados para teste do novo layout
            allTechnicians = ["Arianne Graciano", "John Doe"];
            allAppointments = [
                { id: 1, customers: "Jincy Daniel", pets: 1, verification: "Scheduled", appointmentDate: "10/01/2025 09:00", duration: 120, technician: "Arianne Graciano" },
                { id: 2, customers: "Steven Britt", pets: 2, verification: "Confirmed", appointmentDate: "10/02/2025 11:00", duration: 90, technician: "Arianne Graciano" },
                { id: 3, customers: "Kelly Riva", pets: 1, verification: "Showed", appointmentDate: "10/03/2025 14:00", duration: 60, technician: "Arianne Graciano" },
                { id: 4, customers: "Salvatore Betti", pets: 3, verification: "Canceled", appointmentDate: "10/04/2025 08:30", duration: 150, technician: "Arianne Graciano" },
            ];

            populateTechSelects();
            renderScheduler();

        } catch (error) {
            console.error('CRITICAL ERROR during loadInitialData:', error);
            if (techSelectDropdown) {
                techSelectDropdown.innerHTML = `<option value="">Error!</option>`;
            }
        }
    }

    function populateTechSelects() {
        if (!techSelectDropdown) return;

        if (allTechnicians && allTechnicians.length > 0) {
            techSelectDropdown.innerHTML = ''; // Limpa "Loading..."
            allTechnicians.forEach(tech => {
                const option = document.createElement('option');
                option.value = tech;
                option.textContent = tech;
                techSelectDropdown.appendChild(option);
            });
            // Seleciona o primeiro técnico por defeito para visualização
            selectedTechnician = allTechnicians[0];
            techSelectDropdown.value = selectedTechnician;

        } else {
            techSelectDropdown.innerHTML = '<option value="">No technicians found.</option>';
        }
    }

    function handleTechSelectionChange(event) {
        selectedTechnician = event.target.value;
        renderScheduler(); // Re-renderiza o calendário com o novo técnico
        // Notifica outros módulos da mudança
        document.dispatchEvent(new CustomEvent('technicianChanged', { detail: { technician: selectedTechnician, weekStart: currentWeekStart } }));
    }

    // Event Listeners para a nova barra de ferramentas
    techSelectDropdown.addEventListener('change', handleTechSelectionChange);
    
    prevWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        renderScheduler();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });
    
    nextWeekBtn.addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        renderScheduler();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });

    todayBtn.addEventListener('click', () => {
        currentWeekStart = getStartOfWeek(new Date());
        renderScheduler();
        document.dispatchEvent(new CustomEvent('weekChanged', { detail: { weekStart: currentWeekStart } }));
    });
    
    // Inicialização
    loadInitialData();
});
