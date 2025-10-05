// api/find-availability.js

import fetch from 'node-fetch';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { SHEET_NAME_APPOINTMENTS, SHEET_NAME_TECH_COVERAGE, SHEET_NAME_AVAILABILITY } from './configs/sheets-config.js';

// --- Configuração de Autenticação ---
const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;
const SPREADSHEET_ID_GENERAL = process.env.SHEET_ID;

// --- Funções Auxiliares ---

// Função para chamar a API de Direções do Google Maps e retornar o tempo de viagem em minutos
async function getTravelTime(originZip, destinationZip, apiKey) {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=zip%20${originZip}&destinations=zip%20${destinationZip}&key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
            const durationInSeconds = data.rows[0].elements[0].duration.value;
            return Math.ceil(durationInSeconds / 60); // Retorna em minutos, arredondado para cima
        }
        return null; // Retorna nulo se a rota não for encontrada
    } catch (error) {
        console.error('Google Maps API error:', error);
        return null;
    }
}

// --- Handler Principal da API ---

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { zipCode, numPets, margin } = req.body;
    if (!zipCode || !numPets || !margin) {
        return res.status(400).json({ success: false, message: 'Zip Code, Number of Pets, and Margin are required.' });
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleApiKey) {
        return res.status(500).json({ success: false, message: 'Server configuration error: Google Maps API Key is missing.' });
    }

    try {
        // Conexão com as planilhas
        const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);
        const docGeneral = new GoogleSpreadsheet(SPREADSHEET_ID_GENERAL, serviceAccountAuth);
        await Promise.all([docAppointments.loadInfo(), docData.loadInfo(), docGeneral.loadInfo()]);

        const sheetAppointments = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        const sheetTechCoverage = docData.sheetsByTitle[SHEET_NAME_TECH_COVERAGE];
        const sheetAvailability = docGeneral.sheetsByTitle[SHEET_NAME_AVAILABILITY];
        if (!sheetAppointments || !sheetTechCoverage || !sheetAvailability) {
            throw new Error('One or more required sheets could not be found.');
        }

        // Busca todos os dados necessários em paralelo
        const [allTechs, allAppointmentsRows, allBlocksRows] = await Promise.all([
            sheetTechCoverage.getRows(),
            sheetAppointments.getRows(),
            sheetAvailability.getRows(),
        ]);
        
        const availabilityOptions = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let dayOffset = 0; dayOffset < 7; dayOffset++) { // Limita a busca a 7 dias
            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() + dayOffset);

            for (const techRow of allTechs) {
                const tech = {
                    nome: techRow.get('Name'),
                    homeZip: techRow.get('OriginZipCode'),
                    restrictions: techRow.get('Restrictions') || 'N/A',
                };
                if (!tech.homeZip) continue; // Pula técnicos sem CEP base

                // Monta a agenda do técnico para o dia, incluindo o início e o fim
                let dailySchedule = [];
                // Ponto de partida: casa do técnico
                dailySchedule.push({ time: new Date(currentDate).setHours(0, 0, 0, 0), zip: tech.homeZip, type: 'start' });

                // Adiciona agendamentos existentes
                allAppointmentsRows
                    .filter(row => row.get('Technician') === tech.nome)
                    .forEach(row => {
                        const apptDate = new Date(row.get('Date (Appointment)'));
                        if (apptDate.toDateString() === currentDate.toDateString()) {
                            dailySchedule.push({ time: apptDate.getTime(), zip: row.get('Zip Code'), type: 'appointment' });
                        }
                    });

                // Ordena a agenda por horário
                dailySchedule.sort((a, b) => a.time - b.time);

                // Adiciona o fim do dia para calcular o último slot
                dailySchedule.push({ time: new Date(currentDate).setHours(23, 59, 0, 0), zip: tech.homeZip, type: 'end' });

                // Itera sobre os espaços ("gaps") na agenda
                for (let i = 0; i < dailySchedule.length - 1; i++) {
                    const prevEvent = dailySchedule[i];
                    const nextEvent = dailySchedule[i + 1];

                    const prevEventEndTime = (prevEvent.type === 'appointment')
                        ? new Date(prevEvent.time).getTime() + (2 * 60 * 60 * 1000) // Duração fixa de 2h para agendamentos existentes
                        : new Date(prevEvent.time).getTime();

                    const gapStart = new Date(prevEventEndTime);
                    const gapEnd = new Date(nextEvent.time);
                    
                    // Calcula o tempo de viagem do evento anterior para o novo cliente
                    const travelTimeToNew = await getTravelTime(prevEvent.zip, zipCode, googleApiKey);

                    if (travelTimeToNew === null || travelTimeToNew > 90) {
                        continue; // Pula se a viagem for impossível ou maior que 90 min
                    }

                    // Calcula o início real do serviço
                    const serviceStartTime = new Date(gapStart.getTime() + (travelTimeToNew * 60 * 1000));
                    
                    // Calcula a duração do novo serviço
                    const serviceDuration = (parseInt(numPets) * 60) + parseInt(margin);
                    const serviceEndTime = new Date(serviceStartTime.getTime() + (serviceDuration * 60 * 1000));

                    // Calcula a viagem de volta para o próximo agendamento
                    const travelTimeFromNew = await getTravelTime(zipCode, nextEvent.zip, googleApiKey);
                    if (travelTimeFromNew === null) {
                        continue; // Pula se a viagem de volta for impossível
                    }

                    const arrivalAtNextEvent = new Date(serviceEndTime.getTime() + (travelTimeFromNew * 60 * 1000));
                    
                    // Validação final: O serviço cabe no "gap"?
                    if (arrivalAtNextEvent.getTime() <= gapEnd.getTime()) {
                        // Slot válido encontrado!
                        const hour = serviceStartTime.getHours();
                        const minute = serviceStartTime.getMinutes();
                        // Arredonda para o slot de 30min mais próximo (para cima)
                        const roundedMinute = minute < 30 ? 30 : 60;
                        const finalStartTime = new Date(serviceStartTime);
                        if (roundedMinute === 60) {
                            finalStartTime.setHours(hour + 1, 0);
                        } else {
                            finalStartTime.setHours(hour, roundedMinute);
                        }

                        // Garante que o horário final não ultrapasse o próximo evento
                        if(finalStartTime.getTime() >= gapStart.getTime() && (finalStartTime.getTime() + serviceDuration * 60 * 1000) <= gapEnd.getTime()){
                            availabilityOptions.push({
                                technician: tech.nome,
                                restrictions: tech.restrictions,
                                date: currentDate.toISOString().split('T')[0],
                                availableSlots: [`${finalStartTime.getHours().toString().padStart(2, '0')}:${finalStartTime.getMinutes().toString().padStart(2, '0')}`],
                            });
                        }
                    }
                }
            }
        }
        
        if (availabilityOptions.length > 0) {
            // Agrupa os resultados por técnico e data para uma melhor UI
            const groupedOptions = availabilityOptions.reduce((acc, option) => {
                const key = `${option.date}-${option.technician}`;
                if (!acc[key]) {
                    acc[key] = { ...option, availableSlots: [] };
                }
                acc[key].availableSlots.push(...option.availableSlots);
                // Remove duplicados e ordena
                acc[key].availableSlots = [...new Set(acc[key].availableSlots)].sort();
                return acc;
            }, {});

            return res.status(200).json({ success: true, options: Object.values(groupedOptions) });
        }
        
        return res.status(404).json({ success: false, message: 'No suitable appointment slots found within the next 7 days.' });

    } catch (error) {
        console.error('API Error in /api/find-availability:', error);
        return res.status(500).json({ success: false, message: `Server Error: ${error.message}` });
    }
}
