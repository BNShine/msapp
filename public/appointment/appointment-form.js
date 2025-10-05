// public/appointment/appointment-form.js

document.addEventListener('DOMContentLoaded', async () => {
    const scheduleForm = document.getElementById('scheduleForm');
    if (!scheduleForm) return;

    // --- Funções Auxiliares do Formulário ---
    function populateDropdowns(selectElement, items) {
        if (!selectElement) return;
        while (selectElement.options.length > 1) selectElement.remove(1);
        if (items && Array.isArray(items)) {
            items.forEach(item => { if (item) selectElement.add(new Option(item, item)) });
        }
    }

    function generateAlphanumericCode(length = 5) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * characters.length));
        return result;
    }

    async function getCityFromZip(zipCode) {
        if (!zipCode || zipCode.length !== 5) return null;
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
            if (!response.ok) return null;
            const data = await response.json();
            return data.places?.[0] ? { city: data.places[0]['place name'], state: data.places[0]['state abbreviation'] } : null;
        } catch (error) {
            console.error('Erro ao buscar ZIP code:', error);
            return null;
        }
    }

    async function updateSuggestedTechnician(customerState, suggestedTechDisplay) {
        if (!suggestedTechDisplay) return;
        const inputStyle = 'block w-full h-full rounded-xl border-2 border-foreground/80 hover:border-brand-primary bg-muted/50 px-3 py-2 text-sm';
        suggestedTechDisplay.className = 'h-12 w-full flex items-center bg-muted/50 px-3 py-2 text-muted-foreground font-medium rounded-xl border-2 border-foreground/80';
        suggestedTechDisplay.innerHTML = 'Procurando...';
        if (!customerState) {
            suggestedTechDisplay.textContent = '--/--/----';
            return;
        }
        try {
            const response = await fetch('/api/get-tech-coverage');
            if (!response.ok) throw new Error('Falha ao buscar cobertura.');
            const techCoverageData = await response.json();
            const centralTechs = techCoverageData.filter(t => t.categoria?.toLowerCase() === 'central');
            const techsWithState = (await Promise.all(centralTechs.map(async tech => {
                if (tech.zip_code?.length === 5) {
                    const loc = await getCityFromZip(tech.zip_code);
                    if (loc?.state) return { name: tech.nome, state: loc.state };
                }
                return null;
            }))).filter(Boolean);
            const suggestedTechs = techsWithState.filter(t => t.state === customerState).map(t => t.name);
            if (suggestedTechs.length > 0) {
                suggestedTechDisplay.className = 'h-12 w-full';
                let dropdown = `<select id="suggestedTechSelect" name="technician" required class="${inputStyle}"><option value="">Selecione um técnico</option>`;
                suggestedTechs.forEach(name => { dropdown += `<option value="${name}">${name}</option>`; });
                dropdown += `</select>`;
                suggestedTechDisplay.innerHTML = dropdown;
            } else {
                suggestedTechDisplay.className += ' text-red-600';
                suggestedTechDisplay.textContent = 'Nenhum técnico Central neste estado.';
            }
        } catch (error) {
            suggestedTechDisplay.className += ' text-red-600';
            suggestedTechDisplay.textContent = 'Erro ao buscar técnicos.';
        }
    }

    // --- Seletores e Configuração Inicial do Formulário ---
    const customersInput = document.getElementById('customers');
    const codePassDisplay = document.getElementById('codePassDisplay');
    const appointmentDateInput = document.getElementById('appointmentDate');
    const reminderDateDisplay = document.getElementById('reminderDateDisplay');
    const zipCodeInputForm = document.getElementById('zipCode');
    const cityInput = document.getElementById('city');
    const suggestedTechDisplay = document.getElementById('suggestedTechDisplay');
    
    // Adiciona campos hidden e valores padrão
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
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    document.getElementById('data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('month').value = currentMonth;
    document.getElementById('year').value = currentYear;

    // --- Lógica de Submissão ---
    async function handleFormSubmission(event) {
        event.preventDefault();
        const formData = new FormData(scheduleForm);
        const data = Object.fromEntries(formData.entries());
        const appointmentDateLocal = data.appointmentDate;
        const hour = parseInt(appointmentDateLocal.substring(11, 13), 10);
        if (hour < 7 || hour >= 21) {
            alert(`Error: Appointments must be between 07:00 and 21:00.`);
            return;
        }
        const [datePart, timePart] = appointmentDateLocal.split('T');
        const [year, month, day] = datePart.split('-');
        const apiFormattedDate = `${month}/${day}/${year} ${timePart}`;
        const [rYear, rMonth, rDay] = document.getElementById('reminderDate').value.split('-');
        const apiFormattedReminderDate = `${rMonth}/${rDay}/${rYear}`;
        const formattedData = { ...data, appointmentDate: apiFormattedDate, reminderDate: apiFormattedReminderDate, verification: 'Scheduled', code: document.getElementById('codePass').value };
        try {
            const response = await fetch('/api/register-appointment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formattedData) });
            const result = await response.json();
            if (result.success) {
                alert('Agendamento registrado com sucesso!');
                window.location.reload();
            } else {
                alert('Erro ao registrar: ' + result.message);
            }
        } catch (error) {
            alert('Erro de rede ao registrar.');
        }
    }

    // --- Adiciona Event Listeners ao Formulário ---
    scheduleForm.addEventListener('submit', handleFormSubmission);

    zipCodeInputForm.addEventListener('input', async () => {
        const zipCode = zipCodeInputForm.value.trim();
        cityInput.value = '';
        if (zipCode.length === 5) {
            cityInput.disabled = true;
            cityInput.placeholder = 'Buscando...';
            const locationData = await getCityFromZip(zipCode);
            cityInput.disabled = false;
            cityInput.placeholder = 'Ex: Beverly Hills';
            if (locationData) {
                cityInput.value = locationData.city;
                await updateSuggestedTechnician(locationData.state, suggestedTechDisplay);
            }
        }
    });

    appointmentDateInput.addEventListener('input', (event) => {
        const reminderDateInput = document.getElementById('reminderDate');
        if (event.target.value) {
            const appointmentDate = new Date(event.target.value);
            appointmentDate.setMonth(appointmentDate.getMonth() + 5);
            const displayDate = `${(appointmentDate.getMonth() + 1).toString().padStart(2, '0')}/${appointmentDate.getDate().toString().padStart(2, '0')}/${appointmentDate.getFullYear()}`;
            reminderDateDisplay.textContent = displayDate;
            reminderDateInput.value = appointmentDate.toISOString().split('T')[0];
        } else {
            reminderDateDisplay.textContent = '--/--/----';
            reminderDateInput.value = '';
        }
    });

    customersInput.addEventListener('input', () => {
        const codePassInput = document.getElementById('codePass');
        if (customersInput.value.trim()) {
            const generatedCode = generateAlphanumericCode(5);
            codePassDisplay.textContent = generatedCode;
            codePassInput.value = generatedCode;
        } else {
            codePassDisplay.textContent = '--/--/----';
            codePassInput.value = '';
        }
    });

    // Popula dropdowns do formulário
    (async function populateFormDropdowns() {
        try {
            const [dataResponse, listsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-lists')
            ]);
            if (!dataResponse.ok || !listsResponse.ok) throw new Error('Falha ao carregar dados dos dropdowns.');
            const data = await dataResponse.json();
            const lists = await listsResponse.json();
            
            populateDropdowns(document.getElementById('closer1'), data.employees);
            populateDropdowns(document.getElementById('closer2'), data.employees);
            populateDropdowns(document.getElementById('franchise'), data.franchises);
            populateDropdowns(document.getElementById('pets'), lists.pets);
            populateDropdowns(document.getElementById('source'), lists.sources);
        } catch(error) {
            console.error("Erro ao popular dropdowns:", error);
        }
    })();
});
