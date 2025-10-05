// api/find-availability.js

import fetch from 'node-fetch';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { SHEET_NAME_APPOINTMENTS, SHEET_NAME_TECH_COVERAGE, SHEET_NAME_AVAILABILITY } from './configs/sheets-config.js';

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;
const SPREADSHEET_ID_GENERAL = process.env.SHEET_ID;

async function getTravelTime(originZip, destinationZip, apiKey) {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=zip%20${originZip}&destinations=zip%20${destinationZip}&key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
            const durationInSeconds = data.rows[0].elements[0].duration.value;
            return Math.ceil(durationInSeconds / 60);
        }
        return null;
    } catch (error) {
        console.error('Google Maps API error:', error);
        return null;
    }
}

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

        const [allTechs, allAppointmentsRows, allBlocksRows] = await Promise.all([
            sheetTechCoverage.getRows(),
            sheetAppointments.getRows(),
            sheetAvailability.getRows(),
        ]);
        
        const availabilityOptions = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() + dayOffset);

            // *** NOVA REGRA: Pula Domingos (getDay() === 0) ***
            if (currentDate.getDay() === 0) {
                continue;
            }

            for (const techRow of allTechs) {
                const tech = {
                    nome: techRow.get('Name'),
                    homeZip: techRow.get('OriginZipCode'),
                    restrictions: techRow.get('Restrictions') || 'N/A',
                };
                if (!tech.nome || !tech.homeZip) continue;

                let dailySchedule = [];
                dailySchedule.push({ time: new Date(currentDate).setHours(0, 0, 0, 0), zip: tech.homeZip, type: 'start' });

                allAppointmentsRows
                    .filter(row => row.get('Technician') === tech.nome)
                    .forEach(row => {
                        const apptDateStr = row.get('Date (Appointment)');
                        if (apptDateStr) {
                            const apptDate = new Date(apptDateStr);
                            if (apptDate.toDateString() === currentDate.toDateString()) {
                                dailySchedule.push({ time: apptDate.getTime(), zip: row.get('Zip Code'), type: 'appointment' });
                            }
                        }
                    });

                dailySchedule.sort((a, b) => a.time - b.time);
                dailySchedule.push({ time: new Date(currentDate).setHours(23, 59, 0, 0), zip: tech.homeZip, type: 'end' });

                for (let i = 0; i < dailySchedule.length - 1; i++) {
                    const prevEvent = dailySchedule[i];
                    const nextEvent = dailySchedule[i + 1];

                    const prevEventEndTime = (prevEvent.type === 'appointment')
                        ? new Date(prevEvent.time).getTime() + (2 * 60 * 60 * 1000)
                        : new Date(prevEvent.time).getTime();

                    const gapStart = new Date(prevEventEndTime);
                    const gapEnd = new Date(nextEvent.time);
                    
                    const travelTimeToNew = await getTravelTime(prevEvent.zip, zipCode, googleApiKey);
                    if (travelTimeToNew === null || travelTimeToNew > 90) continue;

                    const serviceStartTime = new Date(gapStart.getTime() + (travelTimeToNew * 60 * 1000));
                    const serviceDuration = (parseInt(numPets) * 60) + parseInt(margin);
                    const serviceEndTime = new Date(serviceStartTime.getTime() + (serviceDuration * 60 * 1000));
                    const travelTimeFromNew = await getTravelTime(zipCode, nextEvent.zip, googleApiKey);
                    if (travelTimeFromNew === null) continue;

                    const arrivalAtNextEvent = new Date(serviceEndTime.getTime() + (travelTimeFromNew * 60 * 1000));
                    
                    if (arrivalAtNextEvent.getTime() <= gapEnd.getTime()) {
                        const hour = serviceStartTime.getHours();
                        const minute = serviceStartTime.getMinutes();
                        const roundedMinute = minute < 30 ? 30 : 60;
                        const finalStartTime = new Date(serviceStartTime);

                        if (roundedMinute === 60) {
                            finalStartTime.setHours(hour + 1, 0);
                        } else {
                            finalStartTime.setHours(hour, roundedMinute);
                        }

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
            const groupedOptions = availabilityOptions.reduce((acc, option) => {
                const key = `${option.date}-${option.technician}`;
                if (!acc[key]) {
                    acc[key] = { ...option, availableSlots: [] };
                }
                acc[key].availableSlots.push(...option.availableSlots);
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
