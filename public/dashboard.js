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

// Function to populate dropdowns (FIXED DUPLICATION ISSUE)
function populateDropdowns(selectElement, items) {
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
// *** FIM DA LÓGICA PARA SUGERIR TÉCNICO ***


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
    console.log("Submit Event Fired. Starting API call..."); 

    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });
    
    const technician = data.technician || '';
    const appointmentDateLocal = data.appointmentDate; // YYYY-MM-DDTHH:MM

    // Validação de horário de slot e conflito removida.

    // Convert to YYYY/MM/DD HH:MM format for API payload
    const formattedAppointmentDate = appointmentDateLocal.replace('T', ' ').replace(/-/g, '/');
    
    const formattedData = {
        type: data.type,
        data: data.data,
        pets: data.pets,
        closer1: data.closer1,
        closer2: data.closer2,
        customers: data.customers,
        phone: data.phone,
        oldNew: data.oldNew,
        appointmentDate: formattedAppointmentDate, // Usa o novo formato YYYY/MM/DD HH:MM
        serviceValue: data.serviceValue,
        franchise: data.franchise,
        city: data.city,
        source: data.source,
        week: data.week,
        month: data.month,
        year: data.year,
        value: '', 
        code: document.getElementById('codePass').value,
        reminderDate: document.getElementById('reminderDate').value,
        verification: 'Scheduled',
        zipCode: data.zipCode, // Valor do campo Zip Code
        technician: technician, // Inclui o técnico selecionado
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
        console.log("API Response:", result);

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

// Event listener to handle all initial setup and actions
document.addEventListener('DOMContentLoaded', async () => {
    // Initial data fetch and render
    fetchAndRenderDashboardData();

    // Selectors for new feature
    const zipCodeInput = document.getElementById('zipCode');
    const cityInput = document.getElementById('city');
    const suggestedTechDisplay = document.getElementById('suggestedTechDisplay'); // NOVO SELETOR

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

    // *** NOVO EVENT LISTENER PARA O ZIP CODE ***
    zipCodeInput.addEventListener('input', async () => {
        const zipCode = zipCodeInput.value.trim();
        cityInput.value = ''; // Limpa a cidade ao digitar
        
        // Reset suggested technician display to default loading style
        suggestedTechDisplay.innerHTML = '--/--/----'; 
        suggestedTechDisplay.classList.remove('text-green-600', 'text-red-600');
        suggestedTechDisplay.classList.add('input-display-style', 'font-medium', 'text-muted-foreground');


        if (zipCode.length === 5) {
            // Desabilita temporariamente o campo City
            cityInput.disabled = true;
            cityInput.placeholder = 'Buscando cidade...';
            suggestedTechDisplay.innerHTML = 'Procurando...'; // Set to loading state after zip check

            const locationData = await getCityFromZip(zipCode);

            cityInput.disabled = false;
            cityInput.placeholder = 'Ex: Beverly Hills';
            
            if (locationData && locationData.city) {
                cityInput.value = locationData.city;
                
                // *** CALL NEW LOGIC ***
                await updateSuggestedTechnician(locationData.state, suggestedTechDisplay); 
                // *** END NEW LOGIC ***

                const addressInput = document.getElementById('address');
                if (addressInput && !addressInput.value) {
                    addressInput.focus();
                }
            } else {
                // Fallback if city not found
                cityInput.focus();
                cityInput.placeholder = 'Zip Code não encontrado. Digite a cidade.';
                suggestedTechDisplay.innerHTML = '--/--/----';
            }
        } else {
             // Reset if zip code is incomplete
             suggestedTechDisplay.innerHTML = '--/--/----';
        }
    });
    // *** FIM NOVO EVENT LISTENER ***


    // Add event listeners
    document.getElementById('scheduleForm').addEventListener('submit', handleFormSubmission);

    appointmentDateInput.addEventListener('input', (event) => {
        const appointmentDateValue = event.target.value; // YYYY-MM-DDTHH:MM
        if (appointmentDateValue) {
            // New logic to handle datetime-local input
            const appointmentDate = new Date(appointmentDateValue);
            appointmentDate.setMonth(appointmentDate.getMonth() + 5);
            
            // Format only the date part to YYYY/MM/DD for display
            const displayDate = formatDateToYYYYMMDD(appointmentDate); 
            reminderDateDisplay.textContent = displayDate;
            
            // API Date format for Sheets is YYYY-MM-DD (Date Only)
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
            // CÓDIGO ATUALIZADO (5 caracteres alfanuméricos):
            const generatedCode = generateAlphanumericCode(5);
            codePassDisplay.textContent = generatedCode;
            codePassInput.value = generatedCode;
            
        } else {
            codePassDisplay.textContent = '--/--/----';
            codePassInput.value = '';
        }
    });
});
