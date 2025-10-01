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
            tableBody.innerHTML = '<tr><td colspan="12" class="p-4 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>';
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
    
    // Function to populate filter dropdowns
    function populateFilters(data) {
        const franchises = new Set();
        const closers = new Set();
        const months = new Set();
        const years = new Set();
        data.forEach(item => {
            if (item.franchise) franchises.add(item.franchise);
            if (item.closer1) closers.add(item.closer1);
            if (item.closer2) closers.add(item.closer2);
            if (item.month) months.add(item.month);
            if (item.year) years.add(item.year);
        });

        populateDropdowns(franchiseFilter, [...franchises].sort());
        populateDropdowns(closerFilter, [...closers].sort());
        populateDropdowns(monthFilter, [...months].sort((a,b) => a-b));
        populateDropdowns(yearFilter, [...years].sort((a,b) => a-b));
    }

    // Main function to fetch and initialize the dashboard
    async function initDashboard() {
        try {
            const response = await fetch('/api/get-customers-data');
            if (!response.ok) {
                throw new Error('Failed to load customer data.');
            }
            const data = await response.json();
            allCustomersData = data.customers;
            
            renderTable(allCustomersData);
            populateFilters(allCustomersData);

        } catch (error) {
            console.error('Error fetching customer data:', error);
            tableBody.innerHTML = '<tr><td colspan="12" class="p-4 text-center text-red-600">Erro ao carregar dados. Tente novamente.</td></tr>';
        }
    }

    // Add event listeners for filters
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
