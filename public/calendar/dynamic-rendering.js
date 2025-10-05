// public/calendar/dynamic-rendering.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Variáveis Globais do Módulo ---
    let allAppointments = [];
    let techCoverageData = [];
    let currentTechnician = '';
    let currentWeekStart = getStartOfWeek(new Date());

    const SLOT_HEIGHT_PX = 60;
    const MIN_HOUR = 7;

    // --- Funções Auxiliares ---
    function getStartOfWeek(date) { /* ...código... */ }
    function formatDateToYYYYMMDD(date) { /* ...código... */ }
    function parseSheetDate(dateStr) { /* ...código... */ }
    function getTimeHHMM(date) { /* ...código... */ }

    // --- NOVA FUNÇÃO DE CACHE ---
    async function getTravelTimesForDay(originZip, waypoints, dateKey) {
        const cacheKey = `travelTimes_${dateKey}_${currentTechnician}`;
        
        // 1. Tenta buscar do cache primeiro
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
            console.log(`Cache HIT for ${cacheKey}`);
            return JSON.parse(cachedData);
        }

        console.log(`Cache MISS for ${cacheKey}. Fetching from API...`);
        // 2. Se não estiver no cache, busca da API
        try {
            const response = await fetch('/api/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originZip, waypoints, isReversed: true })
            });
            const result = await response.json();

            if (result.success && result.routeData.routes[0]?.legs) {
                const travelTimes = result.routeData.routes[0].legs.map(leg => leg.duration.value / 60); // em minutos
                // 3. Salva o resultado no cache antes de retornar
                sessionStorage.setItem(cacheKey, JSON.stringify(travelTimes));
                return travelTimes;
            }
            return []; // Retorna array vazio em caso de falha na API do Google
        } catch (error) {
            console.error("Error fetching travel time:", error);
            return []; // Retorna array vazio em caso de erro de rede
        }
    }

    // --- Lógica Principal de Renderização (usando o cache) ---
    async function renderDynamicAppointments() {
        const schedulerBody = document.getElementById('scheduler-body');
        if (!schedulerBody || !currentTechnician) return;

        schedulerBody.querySelectorAll('.appointment-block[data-id]').forEach(el => el.remove());

        const techInfo = techCoverageData.find(t => t.nome === currentTechnician);
        if (!techInfo || !techInfo.zip_code) { return; }
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

        for (const dateKey in appointmentsByDay) {
            const dayAppointments = appointmentsByDay[dateKey].sort((a, b) => parseSheetDate(a.appointmentDate) - parseSheetDate(b.appointmentDate));
            if (dayAppointments.length === 0) continue;

            const waypoints = dayAppointments.map(appt => ({ zipCode: appt.zipCode }));
            
            // Chama a nova função que usa cache
            const travelTimes = await getTravelTimesForDay(techOriginZip, waypoints, dateKey);
            
            dayAppointments.forEach((appt, index) => {
                // O restante da lógica de renderização do bloco permanece exatamente a mesma
                const travelTime = travelTimes[index] || 0;
                // ... (código para calcular altura, posição e criar o elemento do bloco)
            });
        }
    }

    // --- Listeners para os eventos personalizados ---
    async function initializeAndLoadData() { /* ...código da função... */ }
    
    document.addEventListener('schedulerReady', initializeAndLoadData);
    document.addEventListener('technicianChanged', (e) => { /* ...código da função... */ });
    document.addEventListener('weekChanged', (e) => { /* ...código da função... */ });
    document.addEventListener('reloadData', initializeAndLoadData);
});
