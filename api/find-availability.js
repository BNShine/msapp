// api/find-availability.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { SHEET_NAME_APPOINTMENTS, SHEET_NAME_TECH_COVERAGE, SHEET_NAME_AVAILABILITY } from './configs/sheets-config.js';

dotenv.config();

// --- Autenticação e Configuração do Google Sheets ---
const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// --- Funções Auxiliares de Datas ---
const parseSheetDate = (dateStr) => {
    if (!dateStr) return null;
    const [datePart, timePart] = dateStr.split(' ');
    if (!datePart || !timePart) return null;
    const [month, day, year] = datePart.split('/').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    if ([year, month, day, hour, minute].some(isNaN)) return null;
    return new Date(year, month - 1, day, hour, minute);
};

// --- Funções Auxiliares de API Externa ---
const getCityFromZip = async (zipCode) => {
    try {
        const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.places?.[0]?.['place name'] || null;
    } catch (error) {
        console.error(`Zippopotam API error for zip ${zipCode}:`, error);
        return null;
    }
};

const getTravelTime = async (originZip, destinationZip) => {
    if (!GOOGLE_MAPS_API_KEY) {
        throw new Error("Google Maps API key is not configured on the server.");
    }
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=zip%20${originZip}&destinations=zip%20${destinationZip}&key=${GOOGLE_MAPS_API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.status !== 'OK' || !data.rows[0].elements[0].duration) {
            console.warn(`Google Maps API could not calculate travel time between ${originZip} and ${destinationZip}. Status: ${data.status}`);
            return Infinity; // Retorna infinito se a rota não for encontrada
        }
        return data.rows[0].elements[0].duration.value / 60; // Retorna em minutos
    } catch (error) {
        console.error(`Google Maps API request failed:`, error);
        return Infinity;
    }
};

// --- Funções de Busca de Dados Internos ---
const getAllData = async () => {
    const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
    const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);

    await Promise.all([docAppointments.loadInfo(), docData.loadInfo()]);

    const techSheet = docData.sheetsByTitle[SHEET_NAME_TECH_COVERAGE];
    const availabilitySheet = docData.sheetsByTitle[SHEET_NAME_AVAILABILITY];
    const appointmentSheet = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];

    const techRows = await techSheet.getRows();
    const technicians = techRows.map(row => ({
        name: row.get('Name'),
        zipCode: row.get('OriginZipCode'),
        restrictions: row.get('Restrictions'),
        cities: JSON.parse(row.get('Cities') || '[]'),
    })).filter(t => t.name && t.zipCode);

    const availabilityRows = await availabilitySheet.getRows();
    const availabilityBlocks = availabilityRows.map(row => ({
        technician: row.get('TechnicianName'),
        date: row.get('Date'),
        start: row.get('StartHour'),
        end: row.get('EndHour'),
    }));

    const appointmentRows = await appointmentSheet.getRows();
    const appointments = appointmentRows.map(row => ({
        technician: row.get('Technician'),
        zipCode: row.get('Zip Code'),
        dateTime: parseSheetDate(row.get('Date (Appointment)')),
    })).filter(a => a.technician && a.dateTime);

    return { technicians, availabilityBlocks, appointments };
};


// --- Handler Principal da API ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { zipCode, numPets, margin } = req.body;
        const blockDuration = (60 * parseInt(numPets, 10)) + parseInt(margin, 10);

        const [customerCity, { technicians, availabilityBlocks, appointments }] = await Promise.all([
            getCityFromZip(zipCode),
            getAllData(),
        ]);

        if (!customerCity) {
            return res.status(404).json({ success: false, message: `Could not find city for Zip Code ${zipCode}.` });
        }

        const qualifiedTechs = technicians.filter(tech =>
            tech.cities.some(city => city.toLowerCase() === customerCity.toLowerCase())
        );

        if (qualifiedTechs.length === 0) {
            return res.status(200).json({ options: [] });
        }
        
        const allOptions = new Map();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 14; i++) {
            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() + i);
            if (currentDate.getDay() === 0) continue; // Pula domingos

            for (const tech of qualifiedTechs) {
                const techSchedule = [];
                
                // Adiciona agendamentos existentes
                appointments.forEach(appt => {
                    if (appt.technician === tech.name && appt.dateTime.toDateString() === currentDate.toDateString()) {
                        const endTime = new Date(appt.dateTime.getTime() + (120 * 60000)); // Duração fixa de 2h
                        techSchedule.push({ start: appt.dateTime, end: endTime, zip: appt.zipCode, type: 'appointment' });
                    }
                });

                // Adiciona bloqueios de horário
                availabilityBlocks.forEach(block => {
                    const [bMonth, bDay, bYear] = block.date.split('/').map(Number);
                    const blockDate = new Date(bYear, bMonth - 1, bDay);
                    if (block.technician === tech.name && blockDate.toDateString() === currentDate.toDateString()) {
                        const [sH, sM] = block.start.split(':').map(Number);
                        const [eH, eM] = block.end.split(':').map(Number);
                        const start = new Date(currentDate);
                        start.setHours(sH, sM);
                        const end = new Date(currentDate);
                        end.setHours(eH, eM);
                        techSchedule.push({ start, end, type: 'block' });
                    }
                });

                techSchedule.sort((a, b) => a.start - b.start);
                
                // Analisa as lacunas na agenda
                let lastEventEnd = new Date(currentDate);
                lastEventEnd.setHours(7, 0, 0, 0); // Início do dia de trabalho
                let lastEventZip = tech.zipCode;

                for (let j = 0; j <= techSchedule.length; j++) {
                    const nextEvent = techSchedule[j];
                    const gapStart = lastEventEnd;
                    const gapEnd = nextEvent ? nextEvent.start : new Date(currentDate).setHours(21, 0, 0, 0);
                    const gapDuration = (gapEnd - gapStart) / 60000;

                    if (gapDuration >= blockDuration) {
                        const travelFrom = await getTravelTime(lastEventZip, zipCode);
                        if (travelFrom > 90) continue;

                        const nextEventZip = nextEvent ? nextEvent.zip : tech.zipCode;
                        const travelTo = await getTravelTime(zipCode, nextEventZip);
                        
                        if (travelFrom + blockDuration + travelTo <= gapDuration) {
                            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                            const key = `${tech.name}|${dateStr}`;
                            
                            if (!allOptions.has(key)) {
                                allOptions.set(key, {
                                    technician: tech.name,
                                    restrictions: tech.restrictions || 'N/A',
                                    date: dateStr,
                                    availableSlots: [],
                                });
                            }
                            
                            const slotStart = new Date(gapStart.getTime() + travelFrom * 60000);
                            const slotHour = String(slotStart.getHours()).padStart(2, '0');
                            const slotMinute = String(slotStart.getMinutes()).padStart(2, '0');
                            
                            allOptions.get(key).availableSlots.push(`${slotHour}:${slotMinute}`);
                        }
                    }
                    
                    if(nextEvent) {
                        lastEventEnd = nextEvent.end;
                        lastEventZip = nextEvent.zip || tech.zipCode;
                    }
                }
            }
        }

        const sortedOptions = Array.from(allOptions.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        return res.status(200).json({ success: true, options: sortedOptions });

    } catch (error) {
        console.error('CRITICAL ERROR in /api/find-availability:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred while finding availability.' });
    }
}
