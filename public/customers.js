// public/customers.js

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('customers-table-body');
    const searchInput = document.getElementById('search-input');
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const franchiseFilter = document.getElementById('franchise-filter');
    const closerFilter = document.getElementById('closer-filter');
    const monthFilter = document.getElementById('month-filter');
    const yearFilter = document.getElementById('year-filter');
    const reminderFilter = document.getElementById('reminder-filter');
    const displayDataBtn = document.getElementById('display-data-btn'); // Novo elemento
    const totalAppointmentsCount = document.getElementById('totalAppointmentsCount');
    const totalPetsCount = document.getElementById('totalPetsCount');

    let allCustomersData = [];

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

    // Helper function to format a date string
    function formatDate(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('/');
        return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }

    // Function to render the table rows based on filtered data
    function renderTable(data) {
        tableBody.innerHTML = ''; // Clear the table
        
        if (data.length === 0) {
            // Verifica se a lista de dados está vazia para definir a mensagem
            const message = allCustomersData.length > 0 
                ? 'Nenhum cliente encontrado para os filtros selecionados.' 
                : 'Selecione os filtros e pressione "Exibir" para carregar os dados.';

            tableBody.innerHTML = `<tr><td colspan="12" class="p-4 text-center text-muted-foreground">${message}</td></tr>`;
            totalAppointmentsCount.textContent = 0;
            totalPetsCount.textContent = 0;
            return;
        }

        const today = new Date();
        const totalAppointments = data.length;
        const totalPets = data.reduce((sum, customer) => {
            const pets = parseInt(customer.pets, 10);
            return sum + (isNaN(pets) ? 0 : pets);
        }, 0);

        totalAppointmentsCount.textContent = totalAppointments;
        totalPetsCount.textContent = totalPets;
        
        data.forEach(customer => {
            const row = document.createElement('tr');
            row.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');
            
            const reminderDate = new Date(customer.reminderDate);
            let reminderDisplay = customer.reminderDate;
            let reminderClasses = 'p-4';

            if (reminderDate < today) {
                reminderDisplay = `<span class="text-green-600 font-medium">Enviar</span>`;
                reminderClasses = 'p-4'; 
            }
            
            row.innerHTML = `
                <td class="p-4">${customer.date}</td>
                <td class="p-4">${customer.customers}</td>
                <td class="p-4">${customer.pets}</td>
                <td class="p-4">${customer.closer1}</td>
                <td class="p-4">${customer.closer2}</td>
                <td class="p-4">${customer.phone}</td>
                <td class="p-4">${customer.appointmentDate}</td>
                <td class="p-4">${customer.serviceValue}</td>
                <td class="p-4">${customer.franchise}</td>
                <td class="p-4">${customer.month}</td>
                <td class="p-4">${customer.code}</td>
                <td class="${reminderClasses}">${reminderDisplay}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Function to apply all filters
    function applyFilters() {
        // Se os dados ainda não foram carregados, apenas retorna e exibe a mensagem padrão
        if (allCustomersData.length === 0) {
            renderTable([]); 
            return;
        }
        
        const searchTerm = searchInput.value.toLowerCase();
        const selectedStartDate = startDateFilter.value ? new Date(startDateFilter.value) : null;
        const selectedEndDate = endDateFilter.value ? new Date(endDateFilter.value) : null;
        const selectedFranchise = franchiseFilter.value.toLowerCase();
        const selectedCloser = closerFilter.value.toLowerCase();
        const selectedMonth = monthFilter.value;
        const selectedYear = yearFilter.value;
        const selectedReminder = reminderFilter.value;

        const filteredData = allCustomersData.filter(customer => {
            const customerDate = new Date(customer.date.split('/').reverse().join('-'));

            const matchesDateRange = (!selectedStartDate || customerDate >= selectedStartDate) &&
                                     (!selectedEndDate || customerDate <= selectedEndDate);
            
            const matchesSearch = searchTerm === '' || 
                                  (customer.customers && customer.customers.toLowerCase().includes(searchTerm)) ||
                                  (customer.phone && customer.phone.toLowerCase().includes(searchTerm)) ||
                                  (customer.city && customer.city.toLowerCase().includes(searchTerm));
            
            const matchesFranchise = selectedFranchise === '' || 
                                     (customer.franchise && customer.franchise.toLowerCase() === selectedFranchise);
            
            const matchesCloser = selectedCloser === '' || 
                                  (customer.closer1 && customer.closer1.toLowerCase() === selectedCloser) ||
                                  (customer.closer2 && customer.closer2.toLowerCase() === selectedCloser);
            
            const matchesMonth = selectedMonth === '' || 
                                 (customer.month && customer.month.toString() === selectedMonth);
            
            const matchesYear = selectedYear === '' || 
                                (customer.year && customer.year.toString() === selectedYear);
            
            const today = new Date();
            const reminderDate = new Date(customer.reminderDate);
            const matchesReminder = selectedReminder === '' || (selectedReminder === 'send-reminder' && reminderDate < today);

            return matchesSearch && matchesFranchise && matchesCloser && matchesMonth && matchesYear && matchesReminder && matchesDateRange;
        });

        renderTable(filteredData);
    }
    
    // Function to populate filter dropdowns using dedicated API calls (new logic)
    async function populateFilterDropdowns() {
        try {
            // Busca listas de meses/anos e listas de funcionários/franquias
            const [listsResponse, dashboardResponse] = await Promise.all([
                fetch('/api/get-lists'),
                fetch('/api/get-dashboard-data')
            ]);

            const lists = await listsResponse.json();
            const dashboardData = await dashboardResponse.json();

            // Popula listas estáticas
            populateDropdowns(monthFilter, lists.months);
            populateDropdowns(yearFilter, lists.years);
            
            // Popula listas dinâmicas (Franquias e Closers/Employees)
            franchiseFilter.innerHTML = '<option value=\"\">All Franchises</option>';
            populateDropdowns(franchiseFilter, dashboardData.franchises);
            
            closerFilter.innerHTML = '<option value=\"\">All Closers</option>';
            populateDropdowns(closerFilter, dashboardData.employees); 

        } catch (error) {
            console.error('Error populating filter dropdowns:', error);
        }
    }
    
    // Function to fetch data, apply filters, and render (called by the button)
    async function handleDisplayDataClick() {
        // 1. Desabilita o botão e mostra o estado de carregamento
        displayDataBtn.disabled = true;
        displayDataBtn.textContent = 'Carregando...';

        totalAppointmentsCount.textContent = 0;
        totalPetsCount.textContent = 0;
        tableBody.innerHTML = '<tr><td colspan="12" class="p-4 text-center">Carregando dados da API...</td></tr>';
        
        try {
            // 2. Busca todos os dados do cliente (a chamada de custo, agora sob demanda)
            const response = await fetch('/api/get-customers-data');
            if (!response.ok) {
                 const error = await response.json();
                 throw new Error(error.error || 'Failed to load customer data.');
            }
            const data = await response.json();
            allCustomersData = data.customers;
            
            // 3. Aplica Filtros e Renderiza
            applyFilters(); 
            
        } catch (error) {
            console.error('Error fetching customer data:', error);
            const errorMessage = `Erro ao carregar dados: ${error.message}.`;
            tableBody.innerHTML = `<tr><td colspan="12" class="p-4 text-center text-red-600">${errorMessage}</td></tr>`;
            totalAppointmentsCount.textContent = 0;
            totalPetsCount.textContent = 0;
        } finally {
            // 4. Reabilita o botão e reseta o texto
            displayDataBtn.disabled = false;
            displayDataBtn.textContent = 'Exibir';
        }
    }

    // Main function to initialize the dashboard (new logic)
    async function initDashboard() {
        // 1. Popula os dropdowns de filtro
        await populateFilterDropdowns(); 
        
        // 2. Define o estado inicial: sem dados carregados, solicita ao usuário que clique no botão
        allCustomersData = [];
        totalAppointmentsCount.textContent = 0;
        totalPetsCount.textContent = 0;
        renderTable([]); // Exibe a mensagem de "Pressione Exibir"
    }

    // Adiciona event listeners para os filtros e o novo botão
    if (displayDataBtn) {
        displayDataBtn.addEventListener('click', handleDisplayDataClick);
    }
    searchInput.addEventListener('input', applyFilters);
    startDateFilter.addEventListener('change', applyFilters);
    endDateFilter.addEventListener('change', applyFilters);
    franchiseFilter.addEventListener('change', applyFilters);
    closerFilter.addEventListener('change', applyFilters);
    monthFilter.addEventListener('change', applyFilters);
    yearFilter.addEventListener('change', applyFilters);
    reminderFilter.addEventListener('change', applyFilters);

    initDashboard();
});
