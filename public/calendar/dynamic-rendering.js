// public/calendar/dynamic-rendering.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis Globais do Módulo ---
    let allAppointments = [];
    let techCoverageData = [];
    let currentTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());

    const SLOT_HEIGHT_PX = 60;
    const MIN_HOUR = 7;

    // --- Funções Auxiliares (independentes do outro script) ---
    function getStartOfWeek(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d; }
    function formatDateToYYYYMMDD(date) { const year = date.getFullYear(); const month = (date.getMonth() + 1).toString().padStart(2, '0'); const day = date.getDate().toString().padStart(2, '0'); return `${year}/${month}/${day}`; }
    function parseSheetDate(dateStr) { if (!dateStr) return null; const [datePart, timePart] = dateStr.split(' '); if (!datePart || !timePart) return null; const dateParts = datePart.split('/'); if (dateParts.length !== 3) return null; const [month, day, year] = dateParts.map(Number); const [hour, minute] = timePart.split(':').map(Number); if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null; return new Date(year, month - 1, day, hour, minute); }
    function getTimeHHMM(date) { if (!date) return ''; return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`; }

    // --- Lógica Principal de Renderização Dinâmica (OTIMIZADA) ---
    async function renderDynamicAppointments() {
        const schedulerBody = document.getElementById('scheduler-body');
        if (!schedulerBody || !currentTechnician) return;

        schedulerBody.querySelectorAll('.appointment-block[data-id]').forEach(el => el.remove());

        const techInfo = techCoverageData.find(t => t.nome === currentTechnician);
        if (!techInfo || !techInfo.zip_code) {
            console.warn(`Dados de cobertura ou CEP de origem não encontrados para: ${currentTechnician}`);
            return;
        }
        const techOriginZip = techInfo.zip_code;

        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 7);

        const appointmentsToRender = allAppointments.filter(appt => 
            appt.technician === currentTechnician &&
            parseSheetDate(appt.appointmentDate) >= currentWeekStart &&
            parseSheetDate(appt.appointmentDate) < weekEnd
        );

        const appointmentsByDay = appointmentsToRender.reduce((acc, appt) => {
            const dateKey = formatDateToYYYYMMDD(parseSheetDate(appt.appointmentDate));
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(appt);
            return acc;
        }, {});

        // Processa cada dia individualmente
        for (const dateKey in appointmentsByDay) {
            const dayAppointments = appointmentsByDay[dateKey].sort((a, b) => parseSheetDate(a.appointmentDate) - parseSheetDate(b.appointmentDate));
            if (dayAppointments.length === 0) continue;

            // 1. Agrupa todos os waypoints para uma única chamada de API
            const waypoints = dayAppointments.map(appt => ({ zipCode: appt.zipCode }));

            let travelTimes = [];
            try {
                const response = await fetch('/api/optimize-route', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        originZip: techOriginZip,
                        waypoints: waypoints,
                        isReversed: true // Importante para manter a ordem cronológica
                    })
                });
                const result = await response.json();
                if (result.success && result.routeData.routes[0]?.legs) {
                    // Extrai o tempo de viagem para cada trecho (em minutos)
                    travelTimes = result.routeData.routes[0].legs.map(leg => leg.duration.value / 60);
                } else {
                    console.warn(`Não foi possível calcular os tempos de viagem para o dia ${dateKey}.`);
                }
            } catch (error) {
                console.error(`Erro na API de rota para o dia ${dateKey}:`, error);
            }
            
            // 2. Renderiza todos os blocos do dia com os tempos já calculados
            dayAppointments.forEach((appt, index) => {
                const apptDate = parseSheetDate(appt.appointmentDate);
                const dayContainer = schedulerBody.querySelector(`[data-date-key="${dateKey}"]`);
                if (!dayContainer) return;

                const travelTime = travelTimes[index] || 0; // Pega o tempo de viagem pré-calculado
                
                const serviceDuration = (parseInt(appt.pets, 10) || 1) * 60;
                const margin = parseInt(appt.margin, 10) || 30;
                const totalBlockDuration = travelTime + serviceDuration + margin;
                const blockHeight = (totalBlockDuration / 60) * SLOT_HEIGHT_PX;
                
                const blockStartMoment = new Date(apptDate.getTime() - (travelTime * 60000));
                const topOffset = ((blockStartMoment.getHours() - MIN_HOUR) * 60 + blockStartMoment.getMinutes()) / 60 * SLOT_HEIGHT_PX;

                const block = document.createElement('div');
                let bgColor = 'bg-custom-primary', textColor = 'text-white';
                if (appt.verification === 'Canceled') bgColor = 'bg-cherry-red';
                else if (appt.verification === 'Showed') bgColor = 'bg-green-600';
                else if (appt.verification === 'Confirmed') { bgColor = 'bg-yellow-confirmed'; textColor = 'text-black'; }

                block.className = `appointment-block ${bgColor} ${textColor} rounded-md shadow-soft cursor-pointer transition-colors hover:shadow-lg`;
                block.dataset.id = appt.id;
                block.style.top = `${topOffset}px`;
                block.style.height = `${blockHeight}px`;
                block.style.width = '100%';

                const serviceEndTime = new Date(apptDate.getTime() + (serviceDuration + margin) * 60000);

                block.innerHTML = `
                    <div>
                        <p class="text-xs font-semibold">${getTimeHHMM(apptDate)} - ${getTimeHHMM(serviceEndTime)}</p>
                        <p class="text-sm font-bold truncate">${appt.customers}</p>
                        <p class="text-xs font-medium opacity-80">${appt.verification}</p>
                        <p class="text-xs font-medium opacity-80">Pets: ${appt.pets || 'N/A'}</p>
                        <p class="text-xs font-medium opacity-80">Travel: ${Math.round(travelTime)} min</p>
                    </div>
                `;
                
                block.addEventListener('click', () => {
                    if (window.openAppointmentModal) window.openAppointmentModal(appt);
                });
                dayContainer.appendChild(block);
            });
        }
    }

    // --- Listeners para os eventos personalizados ---
    async function initializeAndLoadData() {
        try {
            const [appointmentsResponse, coverageResponse] = await Promise.all([
                fetch('/api/get-technician-appointments'),
                fetch('/api/get-tech-coverage')
            ]);
            if (!appointmentsResponse.ok || !coverageResponse.ok) throw new Error("Failed to fetch initial data for rendering.");
            
            allAppointments = (await appointmentsResponse.json()).appointments || [];
            techCoverageData = await coverageResponse.json() || [];
            
            if (currentTechnician) renderDynamicAppointments();
        } catch (error) {
            console.error("Error loading dynamic rendering data:", error);
        }
    }
    
    document.addEventListener('schedulerReady', initializeAndLoadData);
    document.addEventListener('technicianChanged', (e) => { currentTechnician = e.detail.technician; currentWeekStart = e.detail.weekStart; renderDynamicAppointments(); });
    document.addEventListener('weekChanged', (e) => { currentWeekStart = e.detail.weekStart; renderDynamicAppointments(); });
    document.addEventListener('reloadData', initializeAndLoadData);
});
