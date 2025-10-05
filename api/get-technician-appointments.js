// api/get-technician-appointments.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { excelDateToDateTime } from './utils.js';
import { SHEET_NAME_APPOINTMENTS } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        await docAppointments.loadInfo();

        const sheetAppointments = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        if (!sheetAppointments) {
            return res.status(404).json({ error: `Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.` });
        }

        const rows = await sheetAppointments.getRows();

        const headerRow = sheetAppointments.headerValues;
        const headersToIndex = {};
        headerRow.forEach((header, index) => {
            headersToIndex[header] = index;
        });

        const appointments = rows.map(row => {
            const getCellValue = (header) => {
                const index = headersToIndex[header];
                if (index !== undefined && row._rawData.length > index) {
                    return String(row._rawData[index] || '');
                }
                return '';
            };

            const appointmentDateRaw = getCellValue('Date (Appointment)');
            const technician = getCellValue('Technician');
            
            if (!technician || !appointmentDateRaw) {
                return null;
            }

            return {
                id: row.rowNumber,
                technician: technician,
                appointmentDate: excelDateToDateTime(appointmentDateRaw),
                customers: getCellValue('Customers'),
                code: getCellValue('Code'),
                verification: getCellValue('Verification') || 'Scheduled', 
                pets: getCellValue('Pets'), // <-- CAMPO ADICIONADO AQUI
                petShowed: getCellValue('Pet Showed'),
                serviceShowed: getCellValue('Service Showed'),
                tips: getCellValue('Tips'),
                percentage: getCellValue('Percentage'),
                paymentMethod: getCellValue('Method'),
                zipCode: getCellValue('Zip Code'),
            };
        }).filter(a => a !== null);

        return res.status(200).json({ appointments });

    } catch (error) {
        console.error('Erro ao buscar agendamentos de técnicos:', error);
        res.status(500).json({ error: 'Falha ao buscar dados dos agendamentos.' });
    }
}
