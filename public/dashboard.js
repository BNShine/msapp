// public/dashboard.js

// Helper function to format a date object to MM/DD/YYYY string
function formatDateToYYYYMMDD(dateObj) {
    // MODIFICATION 1: Change to output MM/DD/YYYY
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    return `${month}/${day}/${year}`;
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

// Function to populate dropdowns (FIXED DUPLICATION ISSUE)
function populateDropdowns(selectElement, items) {
    if (!selectElement) return; // Add guard clause
    // Clear dynamically added options (keeping the first option which is typically "Select...")
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

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

// >>> INÍCIO DA NOVA FUNÇÃO PARA CÓDIGO ALFANUMÉRICO (5 CARACTERES, UPPERCASE)
function generateAlphanumericCode(length = 8) {
    // Caracteres alfanuméricos (letras maiúsculas e números)
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
// <<< FIM DA NOVA FUNÇÃO PARA CÓDIGO ALFANUMÉRICO

// *** FUNÇÃO DE BUSCA DO ZIP CODE/CIDADE ***
async function getCityFromZip(zipCode) {
    if (!zipCode || zipCode.length !== 5) return null;
    try {
        const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.places && data.places.length > 0) {
            // Retorna o nome da cidade E o estado (place name, state abbreviation)
            return {
                city: data.places[0]['place name'],
                state: data.places[0]['state abbreviation'],
                latitude: data.places[0]['latitude'],
                longitude: data.places[0]['longitude'],
            };
        }
        return null;
    } catch (error) {
        console.error('Erro ao buscar dados de zip code:', error);
        return null;
    }
}
// *** FIM DA FUNÇÃO DE BUSCA ***


// *** LÓGICA PARA SUGERIR TÉCNICO ***
async function updateSuggestedTechnician(customerState, suggestedTechDisplay) {
    if (!suggestedTechDisplay) return; // Add guard clause
    // Estilos que criam o visual de "input" - aplicados ao SELECT
    const inputStyleClassesForSelect = 'block w-full h-full rounded-xl border-2 border-foreground/80 hover:border-brand-primary transition-colors bg-muted/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground/80';

    // 1. Configura o DIV para o estado de LOADING: adiciona classes de caixa para o texto
    suggestedTechDisplay.className = 'h-12 w-full flex items-center bg-muted/50 px-3 py-2 text-muted-foreground font-medium rounded-xl border-2 border-foreground/80';
    suggestedTechDisplay.innerHTML = 'Procurando...';

    if (!customerState) {
        // Reseta para o estado inicial se o CEP for inválido/incompleto
        suggestedTechDisplay.className = 'h-12 w-full flex items-center bg-muted/50 px-3 py-2 text-muted-foreground font-medium rounded-xl border-2 border-foreground/80';
        suggestedTechDisplay.textContent = '--/--/----';
        return;
    }

    try {
        // 1. Fetch Technician Coverage Data
        const response = await fetch('/api/get-tech-coverage');
        if (!response.ok) throw new Error('Falha ao buscar dados de cobertura.');
        const techCoverageData = await response.json();

        // 2. Filter by Category "Central"
        const centralTechs = techCoverageData.filter(tech =>
            tech.categoria && tech.categoria.toLowerCase() === 'central'
        );

        // Prepare an array of promises to resolve the state for each central technician
        const techsWithStatePromises = centralTechs.map(async tech => {
            if (tech.zip_code && tech.zip_code.length === 5) {
                const techLocation = await getCityFromZip(tech.zip_code);
                if (techLocation && techLocation.state) {
                    return { name: tech.nome, state: techLocation.state };
                }
            }
            return null;
        });

        const techsWithState = (await Promise.all(techsWithStatePromises)).filter(t => t !== null);

        // 3. Filter by Same State
        const suggestedTechs = techsWithState.filter(tech =>
            tech.state === customerState
        ).map(tech => tech.name); // Get only the names

        // 4. Render Dropdown or Message
        if (suggestedTechs.length > 0) {

            // CORREÇÃO DA SOBREPOSIÇÃO: Remove *todos* os estilos de "caixa" do DIV externo 
            // e deixa apenas a altura/largura, aplicando o estilo de caixa ao SELECT interno.
            suggestedTechDisplay.className = 'h-12 w-full';

            // Cria o SELECT com a estilização completa de input. Adicionado 'required'
            let dropdownHTML = `<select id="suggestedTechSelect" name="technician" required class="${inputStyleClassesForSelect} w-full h-full">`;

            // Default option with empty value is critical for 'required' to work
            dropdownHTML += `<option value="">Selecione um técnico (Central)</option>`;
            suggestedTechs.forEach((name) => {
                dropdownHTML += `<option value="${name}">${name}</option>`;
            });

            dropdownHTML += `</select>`;
            suggestedTechDisplay.innerHTML = dropdownHTML;
        } else {
            // Renderiza o fallback, restaurando o estilo de caixa (displayStyleClasses) e erro.
            suggestedTechDisplay.className = 'h-12 w-full flex items-center bg-muted/50 px-3 py-2 font-medium rounded-xl border-2 border-foreground/80 text-red-600';
            suggestedTechDisplay.textContent = 'Nenhum técnico Central disponível neste estado.';
        }

    } catch (error) {
        // Tratamento de erro, garantindo que o DIV tenha o estilo de caixa
        suggestedTechDisplay.className = 'h-12 w-full flex items-center bg-muted/50 px-3 py-2 font-medium rounded-xl border-2 border-foreground/80 text-red-600';
        suggestedTechDisplay.textContent = 'Erro ao buscar técnicos.';
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
        const today = formatDateToMMDDYYYY(new Date());
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayFormatted = formatDateToMMDDYYYY(yesterday);

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
            const appointmentYear = parseInt(parts[2], 10);
            const appointmentMonth = parseInt(parts[0], 10);
            return appointmentMonth === currentMonth && appointmentYear === currentYear;
        });

        const lastMonthAppointments = appointments.filter(appointment => {
            const parts = appointment.date.split('/');
            const appointmentYear = parseInt(parts[2], 10);
            const appointmentMonth = parseInt(parts[0], 10);
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
        const dataField = document.getElementById('data');
        if (dataField) {
            const currentDate = new Date().toISOString().slice(0, 10);
            dataField.value = currentDate;
            document.getElementById('month').value = currentMonth;
            document.getElementById('year').value = currentYear;
        }


    } catch (error) {
        console.error('Erro ao buscar dados do painel:', error);
        // Fallback para exibir erros
        const todayCount = document.getElementById('todayAppointmentsCount');
        if (todayCount) {
            todayCount.textContent = 'error';
            setTextAndColor('appointmentDifference', 'Error loading data', -1);
            document.getElementById('customersThisMonthCount').textContent = 'error';
            setTextAndColor('customersThisMonthPercentage', 'Error loading data', -1);
            document.getElementById('petsThisMonthCount').textContent = 'error';
            setTextAndColor('petsThisMonthPercentage', 'Error loading data', -1);
            document.getElementById('bestSellerName').textContent = 'error';
        }
    }
}

// Function to handle form submission
async function handleFormSubmission(event) {
    event.preventDefault();

    const form = event.target;
    console.log("Submit Event Fired. Starting API call...");

    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    const technician = data.technician || '';
    const appointmentDateLocal = data.appointmentDate; // YYYY-MM-DDTHH:MM

    const MIN_HOUR = 7;
    const MAX_HOUR = 21;

    const hour = parseInt(appointmentDateLocal.substring(11, 13), 10);
    const minute = parseInt(appointmentDateLocal.substring(14, 16), 10);

    if (hour < MIN_HOUR || hour > MAX_HOUR || (hour === MAX_HOUR && minute > 0)) {
        alert(`Registration Error: Appointments must be scheduled between ${MIN_HOUR}:00 and ${MAX_HOUR}:00.`);
        return;
    }

    const [datePart, timePart] = appointmentDateLocal.split('T');
    const [year, month, day] = datePart.split('-');
    
    const apiFormattedDate = `${month}/${day}/${year} ${timePart}`;
    
    const reminderDateValue = document.getElementById('reminderDate').value;
    const [rYear, rMonth, rDay] = reminderDateValue.split('-');
    const apiFormattedReminderDate = `${rMonth}/${rDay}/${rYear}`;


    const formattedData = {
        type: data.type,
        data: data.data,
        pets: data.pets,
        closer1: data.closer1,
        closer2: data.closer2,
        customers: data.customers,
        phone: data.phone,
        oldNew: data.oldNew,
        appointmentDate: apiFormattedDate,
        serviceValue: data.serviceValue,
        franchise: data.franchise,
        city: data.city,
        source: data.source,
        week: data.week,
        month: data.month,
        year: data.year,
        value: '',
        code: document.getElementById('codePass').value,
        reminderDate: apiFormattedReminderDate,
        verification: 'Scheduled',
        zipCode: data.zipCode,
        technician: technician,
    };

    try {
        const response = await fetch('/api/register-appointment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formattedData),
        });

        const result = await response.json();
        if (result.success) {
            form.reset();
            fetchAndRenderDashboardData();
            alert('Agendamento registrado com sucesso!');
        } else {
            alert('Erro ao registrar agendamento: ' + result.message);
        }
    } catch (error) {
        console.error('Erro ao registrar agendamento:', error);
        alert('Erro de rede ou servidor ao registrar agendamento.');
    }
}


// --- INÍCIO DO NOVO CÓDIGO PARA VERIFICAÇÃO DE DISPONIBILIDADE ---
function initializeSmartCheck() {
    const availabilitySection = document.getElementById('availability-checker-section');
    if (!availabilitySection) return;

    const mainFormSection = document.getElementById('main-appointment-form');
    const zipCodeInputCheck = document.getElementById('customer-zip-code');
    const numPetsInput = document.getElementById('num-pets');
    const marginSelect = document.getElementById('appointment-margin');
    const verifyBtn = document.getElementById('verify-availability-btn');
    const skipBtn = document.getElementById('skip-to-manual-btn');
    const resultsDiv = document.getElementById('availability-results');

    let availabilityData = [];
    let currentOptionIndex = 0;

    verifyBtn.addEventListener('click', handleVerifyAvailability);
    skipBtn.addEventListener('click', () => {
        availabilitySection.style.display = 'none';
        mainFormSection.classList.remove('hidden');
        mainFormSection.scrollIntoView({ behavior: 'smooth' });
    });

    async function handleVerifyAvailability() {
        const zipCode = zipCodeInputCheck.value.trim();
        const numPets = numPetsInput.value;
        const margin = marginSelect.value;

        if (zipCode.length !== 5 || !numPets || numPets < 1) {
            resultsDiv.innerHTML = `<p class="text-red-600 font-semibold">Please enter a valid Zip Code and Number of Pets.</p>`;
            return;
        }

        resultsDiv.innerHTML = `<p class="text-muted-foreground">Calculating travel times and finding the best slots...</p>`;
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Calculating...';

        try {
            const response = await fetch('/api/find-availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zipCode, numPets, margin }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'An unknown error occurred.');
            availabilityData = result.options;
            currentOptionIndex = 0;
            displayCurrentOption(zipCode, numPets);
        } catch (error) {
            resultsDiv.innerHTML = `<p class="text-red-600 font-semibold">Error: ${error.message}</p>`;
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Check Availability';
        }
    }

    function displayCurrentOption(originalZip, numPets) {
        if (availabilityData.length === 0) {
            resultsDiv.innerHTML = `<p class="text-red-600 font-semibold">No suitable slots found with the given travel constraints.</p>`;
            return;
        }
        const data = availabilityData[currentOptionIndex];
        const { technician, restrictions, date, availableSlots } = data;
        const friendlyDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const slotsHtml = availableSlots.map(slot => `<button type="button" class="slot-btn bg-brand-primary/10 text-brand-primary font-semibold py-2 px-4 rounded-lg hover:bg-brand-primary hover:text-white" data-slot="${slot}" data-date="${date}" data-tech="${technician}" data-zip="${originalZip}" data-pets="${numPets}">${slot}</button>`).join('');
        const prevButtonHtml = currentOptionIndex > 0 ? `<button id="prev-option-btn" class="text-sm font-semibold text-brand-primary hover:underline">&larr; Previous</button>` : `<div></div>`;
        const nextButtonHtml = currentOptionIndex < availabilityData.length - 1 ? `<button id="next-option-btn" class="text-sm font-semibold text-brand-primary hover:underline">Next &rarr;</button>` : `<div></div>`;
        resultsDiv.innerHTML = `<div class="space-y-4 p-4 border rounded-lg bg-muted/30"><div class="flex justify-between items-center"><p class="text-lg font-bold text-green-600">Option ${currentOptionIndex + 1}/${availabilityData.length}</p><div class="flex gap-4">${prevButtonHtml}${nextButtonHtml}</div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><p class="text-sm font-semibold">Technician:</p><p>${technician}</p></div><div><p class="text-sm font-semibold">Restrictions:</p><p class="text-amber-700">${restrictions}</p></div></div><div><p class="text-sm font-semibold">Date:</p><p>${friendlyDate}</p></div><div><p class="text-sm font-semibold">Available Times:</p><div class="flex flex-wrap gap-2 mt-2">${slotsHtml}</div></div></div>`;
        document.querySelectorAll('.slot-btn').forEach(b => b.addEventListener('click', handleSlotSelection));
        if (document.getElementById('prev-option-btn')) document.getElementById('prev-option-btn').addEventListener('click', () => { currentOptionIndex--; displayCurrentOption(originalZip, numPets); });
        if (document.getElementById('next-option-btn')) document.getElementById('next-option-btn').addEventListener('click', () => { currentOptionIndex++; displayCurrentOption(originalZip, numPets); });
    }

    function handleSlotSelection(event) {
        const { slot, date, tech, zip, pets } = event.currentTarget.dataset;
        availabilitySection.style.display = 'none';
        mainFormSection.classList.remove('hidden');
        document.getElementById('appointmentDate').value = `${date}T${slot}`;
        document.getElementById('zipCode').value = zip;
        document.getElementById('pets').value = pets;
        document.getElementById('zipCode').dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => {
            const techSelect = document.getElementById('suggestedTechSelect');
            if (techSelect) techSelect.value = tech;
            else if (document.getElementById('suggestedTechDisplay')) document.getElementById('suggestedTechDisplay').textContent = tech;
        }, 1500);
        mainFormSection.scrollIntoView({ behavior: 'smooth' });
        document.getElementById('appointmentDate').dispatchEvent(new Event('input', { bubbles: true }));
    }
}
// --- FIM DO NOVO CÓDIGO PARA VERIFICAÇÃO DE DISPONIBILIDADE ---


// --- INICIALIZAÇÃO DA PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Roda a lógica de inicialização para a página correta
    if (document.getElementById('scheduleForm')) {
        // Estamos na página appointments.html

        // 1. Roda a função de popular os cards de resumo
        fetchAndRenderDashboardData();
        
        // 2. Roda a função que ativa o Smart Availability Check
        initializeSmartCheck();

        // 3. Configura os listeners do formulário principal
        const scheduleForm = document.getElementById('scheduleForm');
        const zipCodeInput = document.getElementById('zipCode');
        const cityInput = document.getElementById('city');
        const suggestedTechDisplay = document.getElementById('suggestedTechDisplay');
        const customersInput = document.getElementById('customers');
        const codePassDisplay = document.getElementById('codePassDisplay');
        const appointmentDateInput = document.getElementById('appointmentDate');
        const reminderDateDisplay = document.getElementById('reminderDateDisplay');

        // Adiciona campos hidden se não existirem
        if (!document.getElementById('codePass')) {
            const codePassInput = document.createElement('input');
            codePassInput.type = 'hidden';
            codePassInput.id = 'codePass';
            codePassInput.name = 'codePass';
            scheduleForm.appendChild(codePassInput);
        }
        if (!document.getElementById('reminderDate')) {
            const reminderDateInput = document.createElement('input');
            reminderDateInput.type = 'hidden';
            reminderDateInput.id = 'reminderDate';
            reminderDateInput.name = 'reminderDate';
            scheduleForm.appendChild(reminderDateInput);
        }

        // Adiciona Listeners do formulário
        scheduleForm.addEventListener('submit', handleFormSubmission);

        zipCodeInput.addEventListener('input', async () => {
            const zipCode = zipCodeInput.value.trim();
            cityInput.value = '';
            if (suggestedTechDisplay) suggestedTechDisplay.innerHTML = '--/--/----';
            if (zipCode.length === 5) {
                cityInput.disabled = true;
                cityInput.placeholder = 'Buscando...';
                const locationData = await getCityFromZip(zipCode);
                cityInput.disabled = false;
                cityInput.placeholder = 'Ex: Beverly Hills';
                if (locationData && locationData.city) {
                    cityInput.value = locationData.city;
                    await updateSuggestedTechnician(locationData.state, suggestedTechDisplay);
                }
            }
        });

        appointmentDateInput.addEventListener('input', (event) => {
            if (event.target.value) {
                const appointmentDate = new Date(event.target.value);
                appointmentDate.setMonth(appointmentDate.getMonth() + 5);
                reminderDateDisplay.textContent = formatDateToMMDDYYYY(appointmentDate);
                document.getElementById('reminderDate').value = appointmentDate.toISOString().split('T')[0];
            } else {
                reminderDateDisplay.textContent = '--/--/----';
                document.getElementById('reminderDate').value = '';
            }
        });

        customersInput.addEventListener('input', () => {
            if (customersInput.value.trim().length > 0) {
                const generatedCode = generateAlphanumericCode(5);
                codePassDisplay.textContent = generatedCode;
                document.getElementById('codePass').value = generatedCode;
            } else {
                codePassDisplay.textContent = '--/--/----';
                document.getElementById('codePass').value = '';
            }
        });
    }
});
