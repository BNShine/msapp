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

    // Elementos do Modal de Cidades
    const citiesModal = document.getElementById('cities-modal');
    const modalContentArea = document.getElementById('modal-content-area');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');


    let GOOGLE_MAPS_API_KEY = "API_KEY_PLACEHOLDER";
    let techData = [];
    let clientData = [{ nome: "", zip_code: "" }];
    let map, directionsService, directionsRenderer;
    
    const CATEGORIA_OPTIONS = ["Central", "Franchise"];

    // --- Utility Functions (Simulated/Required) ---
    
    // Simulação de funções utilitárias que devem ser implementadas externamente
    const showLoading = () => {
        // Exibe um spinner ou mensagem de carregamento, se disponível
        console.log("LOADING...");
    };
    const hideLoading = () => console.log("LOADED.");
    const showToast = (message, type) => alert(type.toUpperCase() + ": " + message);
    
    // Função para carregar a chave e o script do Google Maps
    async function fetchGoogleMapsApiKey() {
        try {
            const response = await fetch('/api/get-google-maps-api-key');
            if (response.ok) {
                const data = await response.json();
                GOOGLE_MAPS_API_KEY = data.apiKey;
                // Carrega o script do Google Maps dinamicamente
                if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
                    const script = document.createElement('script');
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap`;
                    document.head.appendChild(script);
                }
            } else {
                console.error('Falha ao buscar a chave da API do Google Maps.');
                showToast('Erro: Chave da Google Maps API não carregada.', 'error');
            }
        } catch (error) {
            console.error('Erro ao buscar a chave da API do Google Maps:', error);
        }
    }

    // --- Core Helper Functions (Geocoding and Distance) ---

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
            console.error('Erro ao buscar dados de zip code:', error);
            return [null, null, null, null];
        }
    }

    // Calcula a distância euclidiana (aproximação para comparação de proximidade)
    function calculateDistance(lat1, lon1, lat2, lon2) {
        return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2));
    }


    // --- Data Loading and Persistence (Google Sheets Integration) ---
    
    async function loadInitialData() {
        showLoading();
        // 1. Tenta buscar dados frescos do Google Sheets
        try {
            const response = await fetch('/api/get-tech-coverage'); 
            if (response.ok) {
                const apiData = await response.json();
                if (Array.isArray(apiData)) {
                    techData = apiData.filter(t => t.nome);
                    localStorage.setItem('tech_data_cache', JSON.stringify(techData));
                } else {
                    throw new Error('Formato de dados inesperado da API.');
                }
            } else {
                 throw new Error('Falha na resposta da API de leitura. Status: ' + response.status);
            }
        } catch (error) {
            console.error('Falha ao carregar dados de cobertura do Sheets:', error);
            // 2. Se falhar, tenta usar o cache local
            const cachedData = localStorage.getItem('tech_data_cache');
            if (cachedData) {
                techData = JSON.parse(cachedData);
                showToast('Usando dados em cache devido a erro de conexão.', 'warning');
            } else {
                 showToast('Erro crítico ao carregar dados de técnicos.', 'error');
                 techData = [];
            }
        } finally {
            renderTechTable();
            populateTechSelect();
            hideLoading();
        }
    }
    
    async function handleSaveTechData() {
        showLoading();
        try {
            const response = await fetch('/api/save-tech-coverage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(techData)
            });

            const result = await response.json();

            if (result.success) {
                showToast('Dados salvos no Google Sheets com sucesso!', 'success');
                localStorage.setItem('tech_data_cache', JSON.stringify(techData));
            } else {
                showToast('Erro ao salvar dados no Sheets: ' + result.message, 'error');
            }
        } catch (error) {
            showToast('Erro de conexão ao tentar salvar. Verifique a rede ou a API.', 'error');
            console.error('Erro ao salvar dados:', error);
        } finally {
            hideLoading();
        }
    }


    // --- UI Rendering Functions ---

    function renderTechTable() {
        techTableBody.innerHTML = '';
        if (techData && techData.length > 0) {
            techData.forEach((tech, i) => {
                const row = document.createElement('tr');
                row.className = 'border-b border-border hover:bg-muted/50 transition-colors';
                
                const categoryOptionsHtml = CATEGORIA_OPTIONS.map(cat => 
                    `<option value="${cat}" ${tech.categoria === cat ? 'selected' : ''}>${cat}</option>`
                ).join('');

                const visibleCities = (tech.cidades || []).slice(0, 3);
                const hiddenCount = (tech.cidades || []).length - visibleCities.length;
                
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
                        <div class="flex flex-wrap gap-1 mb-2 max-h-16 overflow-y-auto">
                            ${visibleCities.map(city => `<span class="city-tag bg-brand-primary/10 text-brand-primary px-2 py-1 rounded-full text-xs">${city}</span>`).join('')}
                            ${hiddenCount > 0 ? `<span class="city-tag bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs">+ ${hiddenCount} mais</span>` : ''}
                        </div>
                        <button class="text-sm font-semibold text-brand-primary hover:text-brand-primary/80 view-edit-cities-btn" data-index="${i}">
                            Ver/Editar (${(tech.cidades || []).length} cidades)
                        </button>
                    </td>
                    <td class="p-4"><button data-index="${i}" class="text-red-600 hover:text-red-800 delete-tech-btn">🗑️</button></td>
                `;
                techTableBody.appendChild(row);
            });
        } else {
            techTableBody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-muted-foreground">Nenhum técnico cadastrado.</td></tr>';
        }

        // Add listeners for input fields and dropdowns
        techTableBody.querySelectorAll('input:not([data-key="new_city"]), select').forEach(element => {
            element.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                const key = e.target.dataset.key;
                techData[index][key] = e.target.value;
            });
        });
        
        // Listener para abrir o modal de edição de cidades
        techTableBody.querySelectorAll('.view-edit-cities-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                showCitiesModal(index);
            });
        });

        // Listener para deletar técnico
        techTableBody.querySelectorAll('.delete-tech-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                techData.splice(index, 1);
                renderTechTable();
                populateTechSelect();
            });
        });
    }
    
    // --- Lógica do Modal de Cidades ---
    
    function showCitiesModal(index) {
        const tech = techData[index];
        const initialCitiesString = (tech.cidades || []).join(', ');
        
        modalContentArea.innerHTML = `
            <div class="mb-4">
                <p class="text-sm font-semibold">Técnico:</p>
                <p class="text-lg font-bold text-brand-primary">${tech.nome || 'Novo Técnico'}</p>
            </div>
            <p class="text-sm text-muted-foreground mb-2">Edite a lista de cidades separando-as por vírgula (,). A ordem não importa.</p>
            <textarea id="modal-cities-textarea" 
                      class="w-full p-3 border border-border rounded-md focus:ring-2 focus:ring-brand-primary" 
                      rows="10"
                      data-index="${index}">${initialCitiesString}</textarea>
        `;

        modalSaveBtn.onclick = () => {
            const textarea = document.getElementById('modal-cities-textarea');
            const newCitiesString = textarea.value;
            
            // Converte a string de volta para array
            const newCitiesArray = newCitiesString.split(',').map(s => s.trim()).filter(s => s.length > 0);
            
            techData[index].cidades = newCitiesArray;
            
            // Oculta o modal e atualiza a interface
            citiesModal.classList.add('hidden');
            renderTechTable();
        };
        
        modalCancelBtn.onclick = () => {
            citiesModal.classList.add('hidden');
        };

        citiesModal.classList.remove('hidden');
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
                option.textContent = `${tech.nome} (${tech.zip_code || 'Sem Zip'})`;
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
            // Verifica se a cidade está na lista de cobertura (comparação case-insensitive)
            if (tech.cidades.some(c => c.trim().toLowerCase() === city.trim().toLowerCase())) {
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
        } else {
             zipCodeResults.innerHTML += `<p class="text-red-600 mt-2">Nenhum técnico disponível com Zip Code de origem válido para cálculo de proximidade.</p>`;
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

        // 3. Monta a requisição para o Google Maps Directions (com otimização nativa)
        const origin = selectedTech.zip_code;
        const destination = optimizedItinerary[optimizedItinerary.length - 1].zip_code;
        const waypoints = optimizedItinerary.slice(0, -1).map(c => ({
            location: c.zip_code,
            stopover: true
        }));
        
        if (waypoints.length > 8) {
            alert("Aviso: O Google Maps suporta no máximo 8 paradas intermediárias (waypoints). A rota será otimizada localmente, mas a rota do mapa pode ser incorreta.");
        }

        const request = {
            origin: origin,
            destination: destination,
            waypoints: waypoints.slice(0, 8), // Limita aos 8 primeiros para evitar erro da API
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
                
                itineraryList.innerHTML = `<p class="font-bold">A melhor sequência de atendimento é:</p>`;
                
                // Mapeia a ordem otimizada do Google Maps de volta para a lista de clientes original
                const orderedWaypoints = route.waypoint_order.map(i => optimizedItinerary[i]);
                const finalRoute = [
                    ...orderedWaypoints,
                    optimizedItinerary[optimizedItinerary.length - 1] // O último elemento
                ];

                route.legs.forEach((leg, i) => {
                    const client = finalRoute[i];
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
    saveTechDataBtn.addEventListener('click', handleSaveTechData);
    
    // Add Client Row Listener
    addClientRowBtn.addEventListener('click', () => {
        clientData.push({ nome: "", zip_code: "" });
        renderClientTable();
    });

    // Main Initialization Function
    const init = async () => {
        await fetchGoogleMapsApiKey();
        await loadInitialData();
    }


    // Event Listeners for Actions
    verifyZipBtn.addEventListener('click', handleVerifyZipCode);
    optimizeItineraryBtn.addEventListener('click', handleOptimizeItinerary);

    init();
});
