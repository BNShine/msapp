// public/dashboard.js

// Helper function to format a date object to YYYY/MM/DD string
function formatDateToYYYYMMDD(dateObj) {
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
}

// Helper function to set text content and color based on value
function setTextAndColor(elementId, text, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
        element.classList.remove('text-green-600', 'text-red-600', 'text-gray-500');
        element.className = 'text-sm font-medium';
        if (value > 0) {
            element.classList.add('text-green-600');
        } else if (value < 0) {
            element.classList.add('text-red-600');
        } else {
            element.classList.add('text-gray-500');
        }
    }
}

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

// Main function to fetch and update all dashboard data
async function fetchAndRenderDashboardData() {
    try {
        const [dataResponse, listsResponse] = await Promise.all([
            fetch('/api/get-dashboard-data'),
            fetch('/api/get-lists')
        ]);

        if (!dataResponse.ok) {
            throw new Error('Erro ao carregar dados do painel.');
        }
        if (!listsResponse.ok) {
             throw new Error('Erro ao carregar dados das listas dinâmicas.');
        }

        const data = await dataResponse.json();
        const lists = await listsResponse.json();

        const { appointments, employees, franchises } = data;

        // Populate dropdowns dynamically
        const closer1Select = document.getElementById('closer1');
        const closer2Select = document.getElementById('closer2');
        const franchiseSelect = document.getElementById('franchise');
        const petsSelect = document.getElementById('pets');
        const sourceSelect = document.getElementById('source');
        const weekSelect = document.getElementById('week');
        const monthSelect = document.getElementById('month');
        const yearSelect = document.getElementById('year');

        populateDropdowns(closer1Select, employees);
        populateDropdowns(closer2Select, employees);
        populateDropdowns(franchiseSelect, franchises);
        populateDropdowns(petsSelect, lists.pets);
        populateDropdowns(sourceSelect, lists.sources);
        populateDropdowns(weekSelect, lists.weeks);
        populateDropdowns(monthSelect, lists.months);
        populateDropdowns(yearSelect, lists.years);

        // Calculate and update metrics
        const today = formatDateToYYYYMMDD(new Date());
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayFormatted = formatDateToYYYYMMDD(yesterday);

        const todayAppointments = appointments.filter(appointment => appointment.date === today);
        const yesterdayAppointments = appointments.filter(appointment => appointment.date === yesterdayFormatted);
        const difference = todayAppointments.length - yesterdayAppointments.length;
        let differenceText;
        if (difference > 0) {
            differenceText = `+${difference} from yesterday`;
        } else if (difference < 0) {
            differenceText = `${difference} from yesterday`;
        } else {
            differenceText = `No change from yesterday`;
        }
        document.getElementById('todayAppointmentsCount').textContent = todayAppointments.length;
        setTextAndColor('appointmentDifference', differenceText, difference);

        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const previousDate = new Date();
        previousDate.setMonth(previousDate.getMonth() - 1);
        const previousMonth = previousDate.getMonth() + 1;
        const previousYear = previousDate.getFullYear();

        const thisMonthAppointments = appointments.filter(appointment => {
            const parts = appointment.date.split('/');
            const appointmentYear = parseInt(parts[0], 10);
            const appointmentMonth = parseInt(parts[1], 10);
            return appointmentMonth === currentMonth && appointmentYear === currentYear;
        });

        const lastMonthAppointments = appointments.filter(appointment => {
            const parts = appointment.date.split('/');
            const appointmentYear = parseInt(parts[0], 10);
            const appointmentMonth = parseInt(parts[1], 10);
            return appointmentMonth === previousMonth && appointmentYear === previousYear;
        });

        let customersPercentageText;
        let customersPercentageValue;
        if (lastMonthAppointments.length === 0) {
            if (thisMonthAppointments.length > 0) {
                customersPercentageText = "New this month";
                customersPercentageValue = 1;
            } else {
                customersPercentageText = "No change this month";
                customersPercentageValue = 0;
            }
        } else {
            const percentageChange = ((thisMonthAppointments.length - lastMonthAppointments.length) / lastMonthAppointments.length) * 100;
            const sign = percentageChange >= 0 ? '+' : '';
            customersPercentageText = `${sign}${Math.round(percentageChange)}% this month`;
            customersPercentageValue = percentageChange;
        }
        document.getElementById('customersThisMonthCount').textContent = thisMonthAppointments.length;
        setTextAndColor('customersThisMonthPercentage', customersPercentageText, customersPercentageValue);

        let thisMonthPetsCount = 0;
        let lastMonthPetsCount = 0;
        thisMonthAppointments.forEach(appointment => thisMonthPetsCount += (parseInt(appointment.pets) || 0));
        lastMonthAppointments.forEach(appointment => lastMonthPetsCount += (parseInt(appointment.pets) || 0));

        let petsPercentageText;
        let petsPercentageValue;
        if (lastMonthPetsCount === 0) {
            if (thisMonthPetsCount > 0) {
                petsPercentageText = "New this month";
                petsPercentageValue = 1;
            } else {
                petsPercentageText = "No change this month";
                petsPercentageValue = 0;
            }
        } else {
            const percentageChange = ((thisMonthPetsCount - lastMonthPetsCount) / lastMonthPetsCount) * 100;
            const sign = percentageChange >= 0 ? '+' : '';
            petsPercentageText = `${sign}${Math.round(percentageChange)}% this month`;
            petsPercentageValue = percentageChange;
        }
        document.getElementById('petsThisMonthCount').textContent = thisMonthPetsCount;
        setTextAndColor('petsThisMonthPercentage', petsPercentageText, petsPercentageValue);

        const thisMonthClosers = [];
        thisMonthAppointments.forEach(appointment => {
            if (appointment.closer1) thisMonthClosers.push(appointment.closer1);
            if (appointment.closer2) thisMonthClosers.push(appointment.closer2);
        });

        const counts = {};
        thisMonthClosers.forEach(closer => {
            counts[closer] = (counts[closer] || 0) + 1;
        });

        let bestSeller = '--';
        let maxCount = 0;
        for (const closer in counts) {
            if (counts[closer] > maxCount) {
                maxCount = counts[closer];
                bestSeller = closer;
            }
        }
        if (bestSeller !== '--') {
            const nameParts = bestSeller.split(' ');
            if (nameParts.length > 1) {
                bestSeller = `${nameParts[0]} ${nameParts[1].charAt(0)}.`;
            } else {
                bestSeller = nameParts[0];
            }
        }
        document.getElementById('bestSellerName').textContent = bestSeller;

        // Set default form values
        const currentDate = new Date().toISOString().slice(0, 10);
        document.getElementById('data').value = currentDate;
        document.getElementById('month').value = currentMonth;
        document.getElementById('year').value = currentYear;

    } catch (error) {
        console.error('Erro ao buscar dados do painel:', error);
        // Fallback para exibir erros
        document.getElementById('todayAppointmentsCount').textContent = 'error';
        setTextAndColor('appointmentDifference', 'Error loading data', -1);
        document.getElementById('customersThisMonthCount').textContent = 'error';
        setTextAndColor('customersThisMonthPercentage', 'Error loading data', -1);
        document.getElementById('petsThisMonthCount').textContent = 'error';
        setTextAndColor('petsThisMonthPercentage', 'Error loading data', -1);
        document.getElementById('bestSellerName').textContent = 'error';
    }
}

// Function to handle form submission
async function handleFormSubmission(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    const formattedData = {
        type: data.type,
        data: data.data,
        pets: data.pets,
        closer1: data.closer1,
        closer2: data.closer2,
        customers: data.customers,
        phone: data.phone,
        oldNew: data.oldNew,
        appointmentDate: data.appointmentDate,
        serviceValue: data.serviceValue,
        franchise: data.franchise,
        city: data.city,
        source: data.source,
        week: data.week,
        month: data.month,
        year: data.year,
        value: '', 
        code: document.getElementById('codePass').value,
        reminderDate: document.getElementById('reminderDate').value
    };

    try {
        const response = await fetch('/api/register-appointment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formattedData),
        });

        const result = await response.json();

        if (result.success) {
            form.reset();
            fetchAndRenderDashboardData(); // Update all metrics after a successful registration
        }
    } catch (error) {
        console.error('Erro ao registrar agendamento:', error);
    }
}

// Event listener to handle all initial setup and actions
document.addEventListener('DOMContentLoaded', async () => {
    // Initial data fetch and render
    fetchAndRenderDashboardData();

    // Set default form values
    const customersInput = document.getElementById('customers');
    const codePassDisplay = document.getElementById('codePassDisplay');
    const appointmentDateInput = document.getElementById('appointmentDate');
    const reminderDateDisplay = document.getElementById('reminderDateDisplay');

    const codePassInput = document.createElement('input');
    codePassInput.type = 'hidden';
    codePassInput.id = 'codePass';
    codePassInput.name = 'codePass';
    document.getElementById('scheduleForm').appendChild(codePassInput);

    const reminderDateInput = document.createElement('input');
    reminderDateInput.type = 'hidden';
    reminderDateInput.id = 'reminderDate';
    reminderDateInput.name = 'reminderDate';
    document.getElementById('scheduleForm').appendChild(reminderDateInput);

    // Add event listeners
    document.getElementById('scheduleForm').addEventListener('submit', handleFormSubmission);

    appointmentDateInput.addEventListener('input', (event) => {
        const appointmentDateValue = event.target.value;
        if (appointmentDateValue) {
            const appointmentDate = new Date(appointmentDateValue);
            appointmentDate.setMonth(appointmentDate.getMonth() + 5);
            const displayDate = formatDateToYYYYMMDD(appointmentDate);
            reminderDateDisplay.textContent = displayDate;
            const apiDate = appointmentDate.toISOString().split('T')[0];
            reminderDateInput.value = apiDate;
        } else {
            reminderDateDisplay.textContent = '--/--/----';
            reminderDateInput.value = '';
        }
    });

    customersInput.addEventListener('input', () => {
        const value = customersInput.value.trim();
        if (value.length > 0) {
            const randomNumber = Math.floor(Math.random() * 10000);
            const paddedNumber = randomNumber.toString().padStart(4, '0');
            codePassDisplay.textContent = paddedNumber;
            codePassInput.value = paddedNumber;
        } else {
            codePassDisplay.textContent = '--/--/----';
            codePassInput.value = '';
        }
    });
});
