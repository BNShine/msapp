// public/customers.js (Corrigido e Implementado para o Customer Dashboard)

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('customers-table-body');
    const totalAppointmentsCount = document.getElementById('totalAppointmentsCount');
    const totalPetsCount = document.getElementById('totalPetsCount');
    const searchInput = document.getElementById('search-input');
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const franchiseFilter = document.getElementById('franchise-filter');
    const closerFilter = document.getElementById('closer-filter');
    const monthFilter = document.getElementById('month-filter');
    const yearFilter = document.getElementById('year-filter');
    const reminderFilter = document.getElementById('reminder-filter');
    const displayDataBtn = document.getElementById('display-data-btn');

    let allCustomersData = [];
    let allFranchises = [];
    let allEmployees = [];
    let allLists = {};

    // --- Helper Functions ---

    // Função auxiliar para popular dropdowns
    function populateDropdowns(selectElement, items, defaultText) {
        selectElement.innerHTML = `<option value="">${defaultText}</option>`;
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
    
    function formatDateToDisplay(dateStr) {
        // Converte YYYY/MM/DD HH:MM para DD/MM/YYYY HH:MM (ou apenas data se for YYYY/MM/DD)
        if (!dateStr) return '';
        const parts = dateStr.split(' ');
        const dateParts = parts[0].split('/');
        if (dateParts.length === 3) {
            // YYYY/MM/DD -> DD/MM/YYYY
            return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}${parts.length > 1 ? ' ' + parts[1] : ''}`;
        }
        return dateStr;
    }

    function parseSheetDate(dateStr) {
        // Converte YYYY/MM/DD para objeto Date (apenas data)
        if (!dateStr) return null;
        const [datePart] = dateStr.split(' ');
        const parts = datePart.split('/').map(Number); // [YYYY, MM, DD]
        if (parts.length === 3) {
            // Month is 0-indexed in Date constructor (parts[1] - 1)
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return null;
    }

    // --- Core Logic ---

    function renderTable(data) {
        tableBody.innerHTML = '';
        
        let totalAppointments = 0;
        let totalPets = 0;

        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="10" class="p-4 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>';
        } else {
            data.forEach((customer) => {
                totalAppointments++;
                totalPets += (parseInt(customer.pets) || 0);

                const row = document.createElement('tr');
                row.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');
                
                // Truncate name
                const customerName = customer.customers || '';
                const truncatedCustomers = customerName.length > 25 
                    ? customerName.substring(0, 22) + '...'
                    : customerName;
                
                // Color for Reminder Date
                const reminderClass = customer.reminderDate && customer.reminderDate.toLowerCase() === 'send-reminder' ? 'text-red-600 font-bold' : 'text-foreground';

                row.innerHTML = `
                    <td class="p-4">${customer.code || ''}</td>
                    <td class="p-4 font-medium">${truncatedCustomers}</td>
                    <td class="p-4">${customer.pets || '0'}</td>
                    <td class="p-4">${customer.closer1 || ''}</td>
                    <td class="p-4">${customer.closer2 || ''}</td>
                    <td class="p-4">${customer.phone || ''}</td>
                    <td class="p-4">${formatDateToDisplay(customer.appointmentDate)}</td>
                    <td class="p-4">${customer.serviceValue || ''}</td>
                    <td class="p-4">${customer.franchise || ''}</td>
                    <td class="p-4 ${reminderClass}">${customer.reminderDate ? formatDateToDisplay(customer.reminderDate) : 'N/A'}</td>
                `;
                tableBody.appendChild(row);
            });
        }
        
        totalAppointmentsCount.textContent = totalAppointments;
        totalPetsCount.textContent = totalPets;
    }

    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const selectedStartDate = startDateFilter.value ? parseSheetDate(startDateFilter.value.replace(/-/g, '/')) : null;
        const selectedEndDate = endDateFilter.value ? parseSheetDate(endDateFilter.value.replace(/-/g, '/')) : null;
        const selectedFranchise = franchiseFilter.value.toLowerCase();
        const selectedCloser = closerFilter.value.toLowerCase();
        const selectedMonth = monthFilter.value;
        const selectedYear = yearFilter.value;
        const selectedReminder = reminderFilter.value;
        
        const filteredData = allCustomersData.filter(customer => {
            
            // Search filter
            const matchesSearch = !searchTerm ||
                                  (customer.customers && customer.customers.toLowerCase().includes(searchTerm)) ||
                                  (customer.phone && customer.phone.toLowerCase().includes(searchTerm)) ||
                                  (customer.city && customer.city.toLowerCase().includes(searchTerm));

            // Date Range Filter (using only the date part YYYY/MM/DD)
            const apptDate = parseSheetDate(customer.appointmentDate);
            const matchesDateRange = (!selectedStartDate || (apptDate && apptDate >= selectedStartDate)) &&
                                     (!selectedEndDate || (apptDate && apptDate <= selectedEndDate));
            
            // Dropdown filters
            const matchesFranchise = !selectedFranchise || 
                                     (customer.franchise && customer.franchise.toLowerCase() === selectedFranchise);
            
            const matchesCloser = !selectedCloser || 
                                  (customer.closer1 && customer.closer1.toLowerCase() === selectedCloser) ||
                                  (customer.closer2 && customer.closer2.toLowerCase() === selectedCloser);

            const matchesMonth = !selectedMonth || (customer.month && customer.month.toString() === selectedMonth);
            const matchesYear = !selectedYear || (customer.year && customer.year.toString() === selectedYear);
            
            // Reminder Filter
            const matchesReminder = !selectedReminder || (customer.reminderDate && customer.reminderDate.toLowerCase() === 'send-reminder');

            return matchesSearch && matchesDateRange && matchesFranchise && matchesCloser && matchesMonth && matchesYear && matchesReminder;
        });

        renderTable(filteredData);
    }
    
    // --- Data Fetching and Initialization ---

    async function initPage() {
        tableBody.innerHTML = '<tr><td colspan="10" class="p-4 text-center">Loading customer data...</td></tr>';
        
        try {
            const [customersResponse, dashboardResponse, listsResponse] = await Promise.all([
                fetch('/api/get-customers-data', { cache: 'no-store' }),
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-lists')
            ]);
            
            // --- CORREÇÃO: Tratamento de erros detalhado ---
            if (!customersResponse.ok) {
                 const errorText = await customersResponse.text();
                 let errorDetails = errorText.substring(0, 50) + '...';
                 try {
                      const errorJson = JSON.parse(errorText);
                      errorDetails = errorJson.error || errorJson.message || errorDetails;
                 } catch (e) {}
                 throw new Error(`Failed to load customer data (Status: ${customersResponse.status}). Details: ${errorDetails}`);
            }
            if (!dashboardResponse.ok) {
                 const errorText = await dashboardResponse.text();
                 let errorDetails = errorText.substring(0, 50) + '...';
                 try {
                      const errorJson = JSON.parse(errorText);
                      errorDetails = errorJson.error || errorJson.message || errorDetails;
                 } catch (e) {}
                 throw new Error(`Failed to load dashboard data (Status: ${dashboardResponse.status}). Details: ${errorDetails}`);
            }
            if (!listsResponse.ok) {
                 const errorText = await listsResponse.text();
                 let errorDetails = errorText.substring(0, 50) + '...';
                 try {
                      const errorJson = JSON.parse(errorText);
                      errorDetails = errorJson.error || errorJson.message || errorDetails;
                 } catch (e) {}
                 throw new Error(`Failed to load dynamic lists (Status: ${listsResponse.status}). Details: ${errorDetails}`);
            }
            // --- Fim CORREÇÃO ---

            const customersData = await customersResponse.json();
            const dashboardData = await dashboardResponse.json();
            const listsData = await listsResponse.json();
            
            allCustomersData = customersData.customers || [];
            allFranchises = dashboardData.franchises || [];
            allEmployees = dashboardData.employees || [];
            allLists = listsData;

            // Populate filters
            populateDropdowns(franchiseFilter, allFranchises.sort(), 'All Franchises');
            populateDropdowns(closerFilter, allEmployees.sort(), 'All Closers');
            populateDropdowns(monthFilter, allLists.months, 'All Months');
            populateDropdowns(yearFilter, allLists.years, 'All Years');
            
            // Initial render
            renderTable(allCustomersData);

        } catch (error) {
            console.error('Error fetching data:', error);
            const errorMessage = `Erro ao carregar dados: ${error.message}. Verifique a API e as permissões.`;
            tableBody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-red-600">${errorMessage}</td></tr>`;
            totalAppointmentsCount.textContent = '0';
            totalPetsCount.textContent = '0';
        }
    }

    // --- Event Listeners ---
    displayDataBtn.addEventListener('click', (e) => { e.preventDefault(); applyFilters(); });
    searchInput.addEventListener('input', applyFilters);
    startDateFilter.addEventListener('change', applyFilters);
    endDateFilter.addEventListener('change', applyFilters);
    franchiseFilter.addEventListener('change', applyFilters);
    closerFilter.addEventListener('change', applyFilters);
    monthFilter.addEventListener('change', applyFilters);
    yearFilter.addEventListener('change', applyFilters);
    reminderFilter.addEventListener('change', applyFilters);


    initPage();
});
