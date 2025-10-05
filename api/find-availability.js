// api/find-availability.js

import fetch from 'node-fetch';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { SHEET_NAME_APPOINTMENTS, SHEET_NAME_TECH_COVERAGE, SHEET_NAME_AVAILABILITY } from './configs/sheets-config.js';

// --- Configuração de Autenticação (copiado de outros arquivos da API) ---
const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;

// --- Funções Auxiliares (copiado/adaptado do frontend e backend) ---

async function getCityFromZip(zipCode) {
    if (!zipCode || zipCode.length !== 5) return null;
    try {
        const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.places && data.places.length > 0 ? data.places[0]['place name'] : null;
    } catch (error) {
        console.error('Erro ao buscar dados de zip code:', error);
        return null;
    }
}

function parseSheetDate(dateStr) {
    if (!dateStr) return null;
    const [datePart, timePart] = dateStr.split(' ');
    if (!datePart || !timePart) return null;
    const dateParts = datePart.split('/');
    if (dateParts.length !== 3) return null;
    const [month, day, year] = dateParts.map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) return null;
    return new Date(year, month - 1, day, hour, minute);
}

// --- Handler Principal da API ---

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { zipCode } = req.body;
    if (!zipCode) {
        return res.status(400).json({ success: false, message: 'Zip Code is required.' });
    }

    try {
        // 1. Encontrar a cidade do cliente
        const customerCity = await getCityFromZip(zipCode);
        if (!customerCity) {
            return res.status(404).json({ success: false, message: 'Could not find the city for the provided Zip Code.' });
        }

        // --- Conectar às Planilhas ---
        const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);
        await Promise.all([docAppointments.loadInfo(), docData.loadInfo()]);

        // 2. Buscar e filtrar técnicos que atendem a cidade
        const sheetTechCoverage = docData.sheetsByTitle[SHEET_NAME_TECH_COVERAGE];
        if (!sheetTechCoverage) throw new Error(`Sheet "${SHEET_NAME_TECH_COVERAGE}" not found.`);
        const allTechs = await sheetTechCoverage.getRows();

        const availableTechs = allTechs
            .map(row => ({
                nome: row.get('Name'),
                cidades: JSON.parse(row.get('Cities') || '[]'),
            }))
            .filter(tech => tech.cidades.some(city => city.trim().toLowerCase() === customerCity.trim().toLowerCase()));

        if (availableTechs.length === 0) {
            return res.status(404).json({ success: false, message: `No technicians available for the city: ${customerCity}.` });
        }
        
        // 3. Buscar todos os agendamentos e bloqueios
        const sheetAppointments = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        const sheetAvailability = docAppointments.sheetsByTitle[SHEET_NAME_AVAILABILITY];
        if (!sheetAppointments || !sheetAvailability) throw new Error('Appointments or Availability sheet not found.');
        
        const allAppointmentsRows = await sheetAppointments.getRows();
        const allBlocksRows = await sheetAvailability.getRows();

        // --- Algoritmo de Busca de Disponibilidade ---
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let dayOffset = 0; dayOffset < 14; dayOffset++) { // Busca por até 14 dias
            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() + dayOffset);
            const currentDateStr = `${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getDate().toString().padStart(2, '0')}/${currentDate.getFullYear()}`;

            for (const tech of availableTechs) {
                // Filtra agendamentos e bloqueios para o técnico e dia atuais
                const techAppointments = allAppointmentsRows
                    .filter(row => row.get('Technician') === tech.nome)
                    .map(row => parseSheetDate(row.get('Date (Appointment)')))
                    .filter(date => date && date.toDateString() === currentDate.toDateString());

                const techBlocks = allBlocksRows
                    .filter(row => row.get('TechnicianName') === tech.nome && row.get('Date') === currentDateStr)
                    .map(row => {
                        const [startH, startM] = row.get('StartHour').split(':').map(Number);
                        const [endH, endM] = row.get('EndHour').split(':').map(Number);
                        return {
                            start: new Date(currentDate).setHours(startH, startM),
                            end: new Date(currentDate).setHours(endH, endM),
                        };
                    });
                
                // Gera os horários ocupados
                let busySlots = [];
                techAppointments.forEach(date => busySlots.push({ start: date.getTime(), end: date.getTime() + (2 * 60 * 60 * 1000) })); // Agendamentos duram 2 horas
                techBlocks.forEach(block => busySlots.push({ start: block.start, end: block.end }));

                // Verifica os slots disponíveis (das 7h às 21h)
                let availableSlots = [];
                for (let hour = 7; hour < 21; hour++) {
                    const slotStart = new Date(currentDate).setHours(hour, 0, 0, 0);
                    const slotEnd = new Date(currentDate).setHours(hour + 2, 0, 0, 0); // Verifica janela de 2h
                    
                    const isOverlapping = busySlots.some(busy => (slotStart < busy.end) && (slotEnd > busy.start));

                    if (!isOverlapping) {
                        availableSlots.push(`${hour.toString().padStart(2, '0')}:00`);
                    }
                }

                if (availableSlots.length > 0) {
                    // ENCONTRAMOS! Retorna o primeiro resultado válido.
                    return res.status(200).json({
                        success: true,
                        technician: tech.nome,
                        date: currentDate.toISOString().split('T')[0], // Formato YYYY-MM-DD
                        availableSlots: availableSlots,
                    });
                }
            }
        }
        
        // Se o loop terminar, nenhum horário foi encontrado
        return res.status(404).json({ success: false, message: 'No available appointments found in the next 14 days.' });

    } catch (error) {
        console.error('API Error in /api/find-availability:', error);
        return res.status(500).json({ success: false, message: `Server Error: ${error.message}` });
    }
}
