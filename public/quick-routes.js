// public/quick-routes.js

document.addEventListener('DOMContentLoaded', async () => {
    const techTableBody = document.getElementById('tech-table-body');
    const clientTableBody = document.getElementById('client-table-body');
    const zipCodeInput = document.getElementById('zip-code-input');
    const verifyZipBtn = document.getElementById('verify-zip-btn');
    const zipCodeResults = document.getElementById('zip-code-results');
    const addTechRowBtn = document.getElementById('add-tech-row-btn');
    const saveTechDataBtn = document.getElementById('save-tech-data-btn');
    const techSelect = document.getElementById('tech-select');
    const addClientRowBtn = document.getElementById('add-client-row-btn');
    const optimizeItineraryBtn = document.getElementById('optimize-itinerary-btn');
    const itineraryList = document.getElementById('itinerary-list');
    const mapContainer = document.getElementById('map');

    let GOOGLE_MAPS_API_KEY = "API_KEY_PLACEHOLDER";
    let techData = [];
    let clientData = [{ nome: "", zip_code: "" }]; // Inicia com uma linha vazia para input
    let map, directionsService, directionsRenderer;
    
    // Configurações e opções para o cadastro
    const CATEGORIA_OPTIONS = ["Central", "Franquia"];


    // --- Core Helper Functions (Geocoding and Distance) ---

    async function fetchGoogleMapsApiKey() {
        try {
            const response = await fetch('/api/get-google-maps-api-key');
            if (response.ok) {
                const data = await response.json();
                GOOGLE_MAPS_API_KEY = data.apiKey;
                // Load Google Maps script dynamically after fetching the key
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap`;
                document.head.appendChild(script);
            } else {
                console.error('Failed to fetch Google Maps API key. Map functionality disabled.');
                zipCodeResults.innerHTML = '<p class="text-red-600">Erro: Chave da Google Maps API não carregada. Funcionalidade de mapa desativada.</p>';
            }
        } catch (error) {
            console.error('Error fetching Google Maps API key:', error);
        }
    }

    async function getLatLon(zipCode) {
        if (!zipCode) return [null, null, null, null];
        try {
            // API pública para consulta de Zip Codes dos EUA
            const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
            if (!response.ok) return [null, null, null, null];
            const data = await response.json();
            const place = data.places[0];
            return [parseFloat(place.latitude), parseFloat(place.longitude), place['place name'], place['state abbreviation']];
        } catch (error) {
            console.error('Error fetching zip code data:', error);
            return [null, null, null, null];
        }
    }

    // Calcula a distância euclidiana (aproximação para comparação de proximidade)
    function calculateDistance(lat1, lon1, lat2, lon2) {
        return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
    }


    // --- Local Storage and Data Management ---

    function saveTechData() {
        localStorage.setItem('tech_data', JSON.stringify(techData));
    }

    function loadTechData() {
        // Tenta carregar dados salvos localmente
        const savedData = localStorage.getItem('tech_data');
        if (savedData) {
            try {
                return JSON.parse(savedData);
            } catch {
                return null;
            }
        }
        return null;
    }

    async function loadInitialData() {
        const savedData = loadTechData();
        if (savedData && savedData.length > 0) {
            techData = savedData;
        } else {
            // Se não houver dados locais, tenta carregar do tech_cidades.json via API
            try {
                const response = await fetch('/api/get-tech-data');
                if (response.ok) {
                    const apiData = await response.json();
                    if (Array.isArray(apiData)) {
                        // Limpa entradas vazias da API e inicializa a lista
                        techData = apiData.filter(t => t.nome && t.zip_code);
                        saveTechData(); 
                    }
                }
            } catch (error) {
                console.error('Falha ao carregar dados iniciais de técnicos:', error);
            }
        }
        renderTechTable();
        renderClientTable();
        populateTechSelect();
    }


    // --- UI Rendering Functions ---

    function renderTechTable() {
        techTableBody.innerHTML = '';
        if (techData && techData.length > 0) {
            techData.forEach((tech, i) => {
                const row = document.createElement('tr');
                row.className = 'border-b border-border hover:bg-muted/50 transition-colors';
                
                // Opções de categorias, garantindo que a categoria atual esteja selecionada
                const categoryOptionsHtml = CATEGORIA_OPTIONS.map(cat => 
                    `<option value="${cat}" ${tech.categoria === cat ? 'selected' : ''}>${cat}</option>`
                ).join('');

                row.innerHTML = `
                    <td class="p-4"><input type="text" class="w-full bg-transparent border-none focus:outline-none" value="${tech.nome}" data-key="nome" data-index="${i}"></td>
                    <td class="p-4">
                        <select class="w-full bg-transparent border-none focus:outline-none" data-key="categoria" data-index="${i}">
                            <option value="">Selecionar</option>
                            ${categoryOptionsHtml}
                        </select>
                    </td>
                    <td class="p-4"><input type="text" class="w-full bg-transparent border-none focus:outline-none" value="${tech.tipo_atendimento || ''}" data-key="tipo_atendimento" data-index="${i}"></td>
                    <td class="p-4"><input type="text" class="w-full bg-transparent border-none focus:outline-none" value="${tech.zip_code}" data-key="zip_code" data-index="${i}" maxlength="5"></td>
                    <td class="p-4">
                        <div class="flex flex-wrap gap-1 mb-2">
                            ${tech.cidades.map(city => `<span class="city-tag bg-brand-primary/10 text-brand-primary px-2 py-1 rounded-full text-xs" data-city="${city}">${city} <button data-index="${i}" data-city="${city}" class="remove-city-btn text-xs ml-1 font-bold">x</button></span>`).join('')}
                        </div>
                        <input type="text" class="mt-2 w-full bg-background border border-border focus:ring-2 focus:ring-brand-primary rounded-md px-2 py-1 text-sm" placeholder="Adicionar cidade e Enter" data-key="new_city" data-index="${i}">
                    </td>
                    <td class="p-4"><button data-index="${i}" class="text-red-600 hover:text-red-800 delete-tech-btn">🗑️</button></td>
                `;
                techTableBody.appendChild(row);
            });
        } else {
            techTableBody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-muted-foreground">Nenhum técnico cadastrado.</td></tr>';
        }

        // Add event listeners for dynamic elements
        techTableBody.querySelectorAll('input, select').forEach(element => {
            element.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                const key = e.target.dataset.key;
                
                if (key === 'new_city') {
                    const newCity = e.target.value.trim();
                    if (newCity && !techData[index].cidades.includes(newCity)) {
                        techData[index].cidades.push(newCity.trim());
                        saveTechData();
                        renderTechTable(); // Rerender para mostrar a nova tag
                    }
                } else {
                    techData[index][key] = e.target.value;
                }
            });
        });
        
        // Listener para remover tag de cidade
        techTableBody.querySelectorAll('.remove-city-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                const cityToRemove = e.target.dataset.city;
                techData[index].cidades = techData[index].cidades.filter(c => c !== cityToRemove);
                saveTechData();
                renderTechTable();
            });
        });

        // Listener para deletar técnico
        techTableBody.querySelectorAll('.delete-tech-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                techData.splice(index, 1);
                saveTechData();
                renderTechTable();
                populateTechSelect();
            });
        });
    }

    function renderClientTable() {
        clientTableBody.innerHTML = '';
        clientData.forEach((client, i) => {
            const row = document.createElement('tr');
            row.className = 'border-b border-border hover:bg-muted/50 transition-colors';
            row.innerHTML = `
                <td class="p-4"><input type="text" class="w-full bg-transparent border-none focus:outline-none" value="${client.nome}" data-key="nome" data-index="${i}"></td>
                <td class="p-4"><input type="text" class="w-full bg-transparent border-none focus:outline-none" value="${client.zip_code}" data-key="zip_code" data-index="${i}" maxlength="5"></td>
                <td class="p-4">
                    ${i > 0 ? `<button data-index="${i}" class="text-red-600 hover:text-red-800 delete-client-btn">🗑️</button>` : 'Principal'}
                </td>
            `;
            clientTableBody.appendChild(row);
        });

        // Add listeners for client inputs
        clientTableBody.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                const key = e.target.dataset.key;
                clientData[index][key] = e.target.value;
            });
        });

        // Listener para deletar cliente
        clientTableBody.querySelectorAll('.delete-client-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                clientData.splice(index, 1);
                renderClientTable();
            });
        });
    }

    function populateTechSelect() {
        techSelect.innerHTML = '<option value="">Selecione um técnico para otimizar</option>';
        if (techData && techData.length > 0) {
            techData.forEach(tech => {
                const option = document.createElement('option');
                option.value = tech.nome;
                option.textContent = `${tech.nome} (${tech.zip_code})`;
                techSelect.appendChild(option);
            });
        }
    }


    // --- Main Logic ---

    async function handleVerifyZipCode() {
        const zipCode = zipCodeInput.value.trim();
        zipCodeResults.innerHTML = '';
        if (!zipCode) {
            zipCodeResults.innerHTML = `<p class="text-red-600">Por favor, insira um Zip Code.</p>`;
            return;
        }

        const [lat, lon, city, state] = await getLatLon(zipCode);
        if (!city) {
            zipCodeResults.innerHTML = `<p class="text-red-600">Zip Code não encontrado ou inválido.</p>`;
            return;
        }

        zipCodeResults.innerHTML = `
            <p class="text-green-600 font-bold">Zip Code Encontrado!</p>
            <p><strong>Cidade:</strong> ${city}, ${state} (Geolocalização: ${lat.toFixed(4)}, ${lon.toFixed(4)})</p>
        `;
        
        if (!techData || techData.length === 0) {
            zipCodeResults.innerHTML += `<p class="text-red-600 mt-2">Nenhum técnico cadastrado para verificar a cobertura.</p>`;
            return;
        }

        const availableTechs = [];
        const techsWithCoords = [];

        // 1. Filtra técnicos que atendem a cidade E obtém suas coordenadas
        for (const tech of techData) {
            if (tech.cidades.some(c => c.toLowerCase() === city.toLowerCase())) {
                availableTechs.push(tech);
                
                if (tech.zip_code) {
                    const [techLat, techLon] = await getLatLon(tech.zip_code);
                    if (techLat !== null) {
                        techsWithCoords.push({ ...tech, lat: techLat, lon: techLon });
                    }
                }
            }
        }

        const techNames = availableTechs.map(tech => tech.nome).join(', ');
        zipCodeResults.innerHTML += `<p class="mt-2"><strong>Técnicos em área de cobertura:</strong> ${techNames || 'Nenhum'}</p>`;

        // 2. Encontra o técnico mais próximo DENTRO dos disponíveis
        if (techsWithCoords.length > 0) {
            let closestTech = null;
            let minDistance = Infinity;

            for (const tech of techsWithCoords) {
                const distance = calculateDistance(lat, lon, tech.lat, tech.lon);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestTech = tech;
                }
            }
            if (closestTech) {
                zipCodeResults.innerHTML += `
                    <p><strong>Técnico mais próximo (por Zip Origem):</strong> <span class="font-bold">${closestTech.nome}</span></p>
                    <p class="text-sm text-muted-foreground"><strong>Restrições:</strong> ${closestTech.tipo_atendimento || 'Nenhuma restrição especificada'}</p>
                `;
            }
        }
    }

    async function handleOptimizeItinerary() {
        itineraryList.innerHTML = '';
        mapContainer.innerHTML = ''; 
        
        if (!GOOGLE_MAPS_API_KEY || !directionsService) {
            alert('Erro: O serviço Google Maps (DirectionsService) não foi inicializado. Verifique a chave da API.');
            return;
        }

        const selectedTech = techData.find(tech => tech.nome === techSelect.value);
        
        if (!selectedTech || !selectedTech.zip_code) {
            alert('Erro: Selecione um técnico válido com Zip Code de Origem cadastrado.');
            return;
        }
        
        // 1. Valida e obtém coordenadas dos clientes
        const validClients = [];
        for (const client of clientData.filter(c => c.zip_code)) {
            const [lat, lon, city] = await getLatLon(client.zip_code);
            if (lat !== null) {
                validClients.push({ nome: client.nome, zip_code: client.zip_code, lat, lon });
            } else {
                itineraryList.innerHTML += `<p class="text-red-600">Aviso: Cliente ${client.nome} tem Zip Code inválido (${client.zip_code}) e foi ignorado.</p>`;
            }
        }

        if (validClients.length < 2) {
            alert('Adicione pelo menos 2 clientes com Zip Codes válidos para otimizar a rota.');
            return;
        }

        // 2. Lógica do Caixeiro Viajante (Nearest Neighbor Aproximation)
        let currentOriginZip = selectedTech.zip_code;
        let [currentLat, currentLon] = await getLatLon(currentOriginZip);

        let unvisitedClients = [...validClients];
        const optimizedItinerary = [];

        while (unvisitedClients.length > 0) {
            let closestClient = null;
            let minDistance = Infinity;

            for (const client of unvisitedClients) {
                const distance = calculateDistance(currentLat, currentLon, client.lat, client.lon);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestClient = client;
                }
            }
            optimizedItinerary.push(closestClient);
            currentLat = closestClient.lat;
            currentLon = closestClient.lon;
            unvisitedClients = unvisitedClients.filter(c => c !== closestClient);
        }

        // 3. Monta a requisição para o Google Maps Directions
        const origin = selectedTech.zip_code;
        const destination = optimizedItinerary[optimizedItinerary.length - 1].zip_code;
        const waypoints = optimizedItinerary.slice(0, -1).map(c => ({
            location: c.zip_code,
            stopover: true
        }));

        const request = {
            origin: origin,
            destination: destination,
            waypoints: waypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING
        };
        
        // 4. Exibe a rota no mapa
        directionsService.route(request, (response, status) => {
            if (status === 'OK') {
                directionsRenderer.setDirections(response);

                let totalDistance = 0;
                let totalDuration = 0;

                const route = response.routes[0];
                const optimizedOrder = response.routes[0].waypoint_order;
                
                // Mapeia a ordem otimizada (incluindo o destino final)
                const sortedClients = [
                    ...optimizedItinerary.slice(0, optimizedItinerary.length - 1)
                        .filter((_, i) => optimizedOrder.includes(i))
                        .sort((a, b) => optimizedOrder.indexOf(optimizedItinerary.indexOf(a)) - optimizedOrder.indexOf(optimizedItinerary.indexOf(b))),
                    optimizedItinerary[optimizedItinerary.length - 1] // Adiciona o destino final
                ];
                
                itineraryList.innerHTML += `<p class="font-bold">A melhor sequência de atendimento é:</p>`;
                
                route.legs.forEach((leg, i) => {
                    const client = sortedClients[i];
                    totalDistance += leg.distance.value;
                    totalDuration += leg.duration.value;

                    itineraryList.innerHTML += `
                        <div class="border-b border-muted py-2">
                            <p class="font-bold text-lg">${i + 1}. ${client.nome}</p>
                            <p class="ml-4 text-sm">Tempo: ${leg.duration.text} | Distância: ${leg.distance.text}</p>
                        </div>
                    `;
                });

                itineraryList.innerHTML += `<div class="mt-4 font-bold text-lg text-brand-primary">Total Estimado: ${Math.round(totalDuration / 60)} min / ${(totalDistance / 1000).toFixed(2)} km</div>`;
                
            } else {
                alert('Falha na requisição de rotas do Google Maps devido ao status: ' + status);
            }
        });
    }

    // Initialize Map Function (Global callback for Google Maps API)
    window.initMap = function() {
        map = new google.maps.Map(mapContainer, {
            center: { lat: 39.8283, lng: -98.5795 }, // Centro dos EUA
            zoom: 4,
            streetViewControl: false,
            fullscreenControl: false,
        });
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({ map: map });
    }


    // --- Event Listeners and Initial Setup ---
    
    // Add Tech Row Listener
    addTechRowBtn.addEventListener('click', () => {
        if (!techData) techData = [];
        techData.push({ nome: "", categoria: "", tipo_atendimento: "", zip_code: "", cidades: [] });
        renderTechTable();
        populateTechSelect();
    });
    
    // Save Data Listener
    saveTechDataBtn.addEventListener('click', () => {
        saveTechData();
        alert('Dados dos técnicos salvos com sucesso no seu navegador!');
        populateTechSelect(); // Recarrega o seletor de técnicos
    });
    
    // Add Client Row Listener
    addClientRowBtn.addEventListener('click', () => {
        clientData.push({ nome: "", zip_code: "" });
        renderClientTable();
    });

    // Main Function to Fetch API Key and Load Data
    const init = async () => {
        await fetchGoogleMapsApiKey();
        await loadInitialData();
    }


    // Event Listeners for Actions
    verifyZipBtn.addEventListener('click', handleVerifyZipCode);
    optimizeItineraryBtn.addEventListener('click', handleOptimizeItinerary);

    init();
});
