// public/appointment/dashboard-cards.js

async function fetchAndRenderDashboardData() {
    // Helper para formatar data
    function formatDateToMMDDYYYY(dateObj) {
        const year = dateObj.getFullYear();
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObj.getDate().toString().padStart(2, '0');
        return `${month}/${day}/${year}`;
    }

    // Helper para definir cor e texto
    function setTextAndColor(elementId, text, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
            element.classList.remove('text-green-600', 'text-red-600', 'text-gray-500');
            element.className = 'text-sm font-medium';
            if (value > 0) element.classList.add('text-green-600');
            else if (value < 0) element.classList.add('text-red-600');
            else element.classList.add('text-gray-500');
        }
    }

    try {
        const dataResponse = await fetch('/api/get-dashboard-data');
        if (!dataResponse.ok) throw new Error('Erro ao carregar dados do painel.');
        const data = await dataResponse.json();
        const { appointments } = data;

        const todayAppointmentsCountEl = document.getElementById('todayAppointmentsCount');
        if (!todayAppointmentsCountEl) return;

        // Calcular e atualizar métricas
        const today = formatDateToMMDDYYYY(new Date());
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayFormatted = formatDateToMMDDYYYY(yesterday);

        const todayAppointments = appointments.filter(a => a.date === today);
        const yesterdayAppointments = appointments.filter(a => a.date === yesterdayFormatted);
        const difference = todayAppointments.length - yesterdayAppointments.length;
        
        todayAppointmentsCountEl.textContent = todayAppointments.length;
        setTextAndColor('appointmentDifference', `${difference >= 0 ? '+' : ''}${difference} from yesterday`, difference);

        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const previousDate = new Date();
        previousDate.setMonth(previousDate.getMonth() - 1);
        const previousMonth = previousDate.getMonth() + 1;
        const previousYear = previousDate.getFullYear();

        const thisMonthAppointments = appointments.filter(a => {
            const parts = a.date.split('/');
            return parseInt(parts[0], 10) === currentMonth && parseInt(parts[2], 10) === currentYear;
        });
        const lastMonthAppointments = appointments.filter(a => {
            const parts = a.date.split('/');
            return parseInt(parts[0], 10) === previousMonth && parseInt(parts[2], 10) === previousYear;
        });

        let customersPercentageValue = 0;
        if (lastMonthAppointments.length > 0) {
            customersPercentageValue = ((thisMonthAppointments.length - lastMonthAppointments.length) / lastMonthAppointments.length) * 100;
        } else if (thisMonthAppointments.length > 0) {
            customersPercentageValue = 100;
        }
        document.getElementById('customersThisMonthCount').textContent = thisMonthAppointments.length;
        setTextAndColor('customersThisMonthPercentage', `${customersPercentageValue >= 0 ? '+' : ''}${Math.round(customersPercentageValue)}% this month`, customersPercentageValue);
        
        const thisMonthPetsCount = thisMonthAppointments.reduce((sum, a) => sum + (parseInt(a.pets) || 0), 0);
        const lastMonthPetsCount = lastMonthAppointments.reduce((sum, a) => sum + (parseInt(a.pets) || 0), 0);
        
        let petsPercentageValue = 0;
        if (lastMonthPetsCount > 0) {
            petsPercentageValue = ((thisMonthPetsCount - lastMonthPetsCount) / lastMonthPetsCount) * 100;
        } else if (thisMonthPetsCount > 0) {
            petsPercentageValue = 100;
        }
        document.getElementById('petsThisMonthCount').textContent = thisMonthPetsCount;
        setTextAndColor('petsThisMonthPercentage', `${petsPercentageValue >= 0 ? '+' : ''}${Math.round(petsPercentageValue)}% this month`, petsPercentageValue);

        const closerCounts = thisMonthAppointments.reduce((acc, a) => {
            if (a.closer1) acc[a.closer1] = (acc[a.closer1] || 0) + 1;
            if (a.closer2) acc[a.closer2] = (acc[a.closer2] || 0) + 1;
            return acc;
        }, {});
        let bestSeller = Object.keys(closerCounts).reduce((a, b) => closerCounts[a] > closerCounts[b] ? a : b, '--');
        if (bestSeller !== '--') {
            const nameParts = bestSeller.split(' ');
            if (nameParts.length > 1) {
                bestSeller = `${nameParts[0]} ${nameParts[1].charAt(0)}.`;
            }
        }
        document.getElementById('bestSellerName').textContent = bestSeller;

    } catch (error) {
        console.error('Erro ao buscar dados do painel:', error);
    }
}

document.addEventListener('DOMContentLoaded', fetchAndRenderDashboardData);
