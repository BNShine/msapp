// public/analytics.js

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('analytics-table-body');
    const tableFooter = document.getElementById('analytics-table-footer');
    const monthFilter = document.getElementById('month-filter');
    const yearFilter = document.getElementById('year-filter');
    const goalInput = document.getElementById('goal-input');
    const goalPercentage = document.getElementById('goal-percentage');
    const closerInsightsContainer = document.getElementById('closer-insights-container');
    const franchiseModal = document.getElementById('franchise-modal');
    const modalContent = document.getElementById('modal-content');
    const totalAppointmentsCount = document.getElementById('totalAppointmentsCount');
    const totalPetsCount = document.getElementById('totalPetsCount');

    let allAppointmentsData = [];
    let allEmployees = [];

    // Function to populate dropdowns
    function populateDropdowns(selectElement, items) {
        if (items && Array.isArray(items)) {
            items.forEach(item => {
                if (item) {
                    const option = document.createElement('option');
                    option.value = item;
                    option.textContent = item;
                    selectElement.appendChild(option);
                }
            });
        }
    }

    // Function to update the goal percentage
    function updateGoalPercentage(totalAppointments, goal) {
        if (!goalPercentage) return;
        
        let percentage = 0;
        if (goal > 0) {
            // A variável totalAppointments agora representa Total Pets, conforme a chamada na função applyFilters
            percentage = Math.min(100, (totalAppointments / goal) * 100);
        }
        
        goalPercentage.textContent = `${Math.round(percentage)}%`;
        
        if (percentage >= 100) {
            goalPercentage.classList.remove('text-brand-primary');
            goalPercentage.classList.add('text-green-600');
        } else {
            goalPercentage.classList.remove('text-green-600');
            goalPercentage.classList.add('text-brand-primary');
        }
    }

    // Function to render the table with the calculated data
    function renderTable(data, employees) {
        if (!tableBody || !tableFooter) return;

        tableBody.innerHTML = '';
        
        const closerTotals = {};

        employees.forEach(closer => {
            closerTotals[closer] = {
                closer1: Array(5).fill(0),
                closer2: Array(5).fill(0),
                totalCloser: 0,
                totalInTeam: 0,
                grandTotal: 0
            };
        });

        data.forEach(appointment => {
            const week = parseInt(appointment.week, 10);
            if (week >= 1 && week <= 5) {
                if (appointment.closer1 && closerTotals[appointment.closer1]) {
                    closerTotals[appointment.closer1].closer1[week - 1]++;
                    closerTotals[appointment.closer1].totalCloser++;
                    closerTotals[appointment.closer1].grandTotal++;
                }
                if (appointment.closer2 && closerTotals[appointment.closer2]) {
                    closerTotals[appointment.closer2].closer2[week - 1]++;
                    closerTotals[appointment.closer2].totalInTeam++;
                    closerTotals[appointment.closer2].grandTotal++;
                }
            }
        });

        const sortedEmployees = [...employees].sort();
        let totalCloserAppointments = 0;

        sortedEmployees.forEach(closer => {
            totalCloserAppointments += closerTotals[closer].totalCloser;
        });

        const employeesWithAppointments = sortedEmployees.filter(closer => closerTotals[closer].totalCloser > 0 || closerTotals[closer].totalInTeam > 0);

        if (employeesWithAppointments.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="15" class="p-4 text-center text-muted-foreground">Nenhum closer com agendamentos no período selecionado.</td></tr>';
        } else {
            employeesWithAppointments.forEach(closer => {
                const totals = closerTotals[closer];
                const percentage = totalCloserAppointments > 0 ? (totals.totalCloser / totalCloserAppointments) * 100 : 0;
                const row = document.createElement('tr');
                row.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');
                
                row.innerHTML = `
                    <td class="p-4 font-semibold cursor-pointer" data-closer-name="${closer}">${closer}</td>
                    <td class="p-4 text-center">${totals.closer1[0]}</td>
                    <td class="p-4 text-center">${totals.closer2[0]}</td>
                    <td class="p-4 text-center">${totals.closer1[1]}</td>
                    <td class="p-4 text-center">${totals.closer2[1]}</td>
                    <td class="p-4 text-center">${totals.closer1[2]}</td>
                    <td class="p-4 text-center">${totals.closer2[2]}</td>
                    <td class="p-4 text-center">${totals.closer1[3]}</td>
                    <td class="p-4 text-center">${totals.closer2[3]}</td>
                    <td class="p-4 text-center">${totals.closer1[4]}</td>
                    <td class="p-4 text-center">${totals.closer2[4]}</td>
                    <td class="p-4 text-center font-bold">${totals.totalCloser}</td>
                    <td class="p-4 text-center font-bold">${totals.totalInTeam}</td>
                    <td class="p-4 text-center font-bold">${totals.grandTotal}</td>
                    <td class="p-4 text-center font-bold">${percentage.toFixed(2)}%</td>
                `;
                tableBody.appendChild(row);
            });
        }
        
        const totalCloser = employeesWithAppointments.reduce((sum, closer) => sum + closerTotals[closer].totalCloser, 0);
        
        tableFooter.innerHTML = `
            <tr>
                <td class="p-4 font-bold">Grand Total</td>
                <td colspan="10" class="p-4"></td>
                <td class="p-4 text-center font-bold">${totalCloser}</td>
                <td class="p-4 text-center"></td>
                <td class="p-4 text-center"></td>
                <td class="p-4 text-center"></td>
            </tr>
        `;
        
        // Mantido apenas para a lógica dos cards se necessário, mas o principal está no applyFilters
        // updateGoalPercentage(totalCloserAppointments, parseInt(goalInput.value, 10));
    }
    
    // Function to render the advanced dashboard cards
    function renderAdvancedDashboard(data) {
        if (!closerInsightsContainer) return;
        
        const totalCloserAppointments = data.reduce((sum, closer) => sum + closer.totalCloser, 0);
        
        let htmlContent = '';
        const sortedData = data.filter(c => c.totalCloser > 0 || c.totalInTeam > 0).sort((a, b) => b.totalCloser - a.totalCloser);

        if (sortedData.length > 0) {
            sortedData.forEach(closerStats => {
                const percentage = totalCloserAppointments > 0 ? (closerStats.totalCloser / totalCloserAppointments) * 100 : 0;
                htmlContent += `
                    <div class="p-4 border-b border-border last:border-b-0">
                        <div class="flex items-center justify-between">
                            <h3 class="text-sm font-semibold">${closerStats.closer}</h3>
                            <p class="text-xs font-medium text-brand-primary">${percentage.toFixed(2)}%</p>
                        </div>
                        <div class="flex items-center justify-between text-xs text-muted-foreground mt-1">
                            <span>Closer: ${closerStats.totalCloser}</span>
                            <span>In Team: ${closerStats.totalInTeam}</span>
                        </div>
                    </div>
                `;
            });
        } else {
            htmlContent = '<p class="text-sm text-muted-foreground p-4">Nenhum closer com agendamentos no período selecionado.</p>';
        }

        closerInsightsContainer.innerHTML = htmlContent;
    }

    // Função corrigida para popular o modal
    function populateFranchiseModal(closerName) {
        if (!franchiseModal || !modalContent) return;
        
        // Filtrar agendamentos onde o closer é o Closer (1) ou Closer (2)
        const closerAppointments = allAppointmentsData.filter(app => app.closer1 === closerName || app.closer2 === closerName);
        
        // Contar a frequência de cada franquia para os agendamentos encontrados
        const franchiseCounts = closerAppointments.reduce((acc, app) => {
            const franchise = app.franchise || 'Unknown';
            acc[franchise] = (acc[franchise] || 0) + 1;
            return acc;
        }, {});
    
        let modalInnerContent = `<h3 class="lg:text-xl md:text-md text-sm font-bold mb-4">Agendamentos de ${closerName} por Franquia</h3>`;
        if (Object.keys(franchiseCounts).length > 0) {
            modalInnerContent += '<ul class="list-disc pl-5 space-y-1">';
            for (const franchise in franchiseCounts) {
                if (franchiseCounts[franchise] > 0) {
                    modalInnerContent += `<li>${franchise}: ${franchiseCounts[franchise]} agendamento(s)</li>`;
                }
            }
            modalInnerContent += '</ul>';
        } else {
            modalInnerContent += '<p>Nenhum agendamento encontrado para este closer no período selecionado.</p>';
        }
    
        modalContent.innerHTML = modalInnerContent;
        franchiseModal.classList.remove('hidden');
    }
    
    document.addEventListener('click', (event) => {
        const closerNameCell = event.target.closest('td[data-closer-name]');
        if (closerNameCell) {
            event.preventDefault();
            const closerName = closerNameCell.dataset.closerName;
            populateFranchiseModal(closerName);
        }
    });

    // Function to apply all filters and render all sections
    function applyFilters() {
        const selectedMonth = monthFilter.value;
        const selectedYear = yearFilter.value;

        const filteredData = allAppointmentsData.filter(appointment => {
            const matchesMonth = selectedMonth === '' || (appointment.month && appointment.month.toString() === selectedMonth);
            const matchesYear = selectedYear === '' || (appointment.year && appointment.year.toString() === selectedYear);
            return matchesMonth && matchesYear;
        });

        const totalAppointmentsInPeriod = filteredData.length;
        const totalPetsInPeriod = filteredData.reduce((sum, appointment) => sum + (parseInt(appointment.pets, 10) || 0), 0);
        
        if (totalAppointmentsCount) {
            totalAppointmentsCount.textContent = totalAppointmentsInPeriod;
        }

        if (totalPetsCount) {
            totalPetsCount.textContent = totalPetsInPeriod;
        }

        // Calculate data for the tables and advanced dashboard
        const closerPerformanceData = {};
        allEmployees.forEach(closer => {
            closerPerformanceData[closer] = { totalCloser: 0, totalInTeam: 0 };
        });

        filteredData.forEach(appointment => {
            if (appointment.closer1 && closerPerformanceData[appointment.closer1]) {
                closerPerformanceData[appointment.closer1].totalCloser++;
            }
            if (appointment.closer2 && closerPerformanceData[appointment.closer2]) {
                closerPerformanceData[appointment.closer2].totalInTeam++;
            }
        });

        const performanceData = Object.keys(closerPerformanceData).map(closer => ({
            closer,
            totalCloser: closerPerformanceData[closer].totalCloser,
            totalInTeam: closerPerformanceData[closer].totalInTeam
        }));
        
        renderTable(filteredData, allEmployees);
        renderAdvancedDashboard(performanceData);
        // MODIFICAÇÃO AQUI: Passa totalPetsInPeriod para o cálculo da meta.
        updateGoalPercentage(totalPetsInPeriod, parseInt(goalInput.value, 10)); 
    }

    // Function to populate filter dropdowns with years
    async function populateFilters() {
        const [listsResponse, dashboardResponse] = await Promise.all([
            fetch('/api/get-lists'),
            fetch('/api/get-dashboard-data')
        ]);

        const lists = await listsResponse.json();
        const dashboardData = await dashboardResponse.json();
        
        allEmployees = dashboardData.employees;

        populateDropdowns(monthFilter, lists.months);
        populateDropdowns(yearFilter, lists.years);
    }

    // Main function to fetch data and initialize the dashboard
    async function initDashboard() {
        try {
            const appointmentsResponse = await fetch('/api/get-customers-data');

            if (!appointmentsResponse.ok) {
                const error = await appointmentsResponse.json();
                throw new Error(error.error || 'Failed to load customer data.');
            }

            const appointmentsData = await appointmentsResponse.json();
            allAppointmentsData = appointmentsData.customers;

            await populateFilters();

            applyFilters();
            
        } catch (error) {
            console.error('Error fetching data:', error);
            const errorMessage = `Erro ao carregar dados: ${error.message}. Verifique a sua conexão ou a configuração da API.`;
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="15" class="p-4 text-center text-red-600">${errorMessage}</td></tr>`;
            if (closerInsightsContainer) closerInsightsContainer.innerHTML = `<p class="text-sm text-red-600 p-4">${errorMessage}</p>`;
        }
    }

    // Add event listeners for filters
    if (monthFilter) monthFilter.addEventListener('change', (e) => { e.preventDefault(); applyFilters(); });
    if (yearFilter) yearFilter.addEventListener('change', (e) => { e.preventDefault(); applyFilters(); });
    if (goalInput) goalInput.addEventListener('input', (e) => { e.preventDefault(); applyFilters(); });

    initDashboard();
});
