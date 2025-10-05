// api/get-dashboard-data.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { excelDateToYYYYMMDD } from './utils.js';
import { SHEET_NAME_APPOINTMENTS, SHEET_NAME_EMPLOYEES, SHEET_NAME_FRANCHISES, SHEET_NAME_TECHNICIANS } from './configs/sheets-config.js';

dotenv.config();

// Autenticação com permissão de leitura e escrita para consistência
const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;

export default async function handler(req, res) {
    console.log('[API LOG] /api/get-dashboard-data endpoint hit.');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        console.log('[API LOG] Initializing GoogleSpreadsheet instances...');
        const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);

        console.log('[API LOG] Loading spreadsheet info...');
        await Promise.all([docAppointments.loadInfo(), docData.loadInfo()]);
        console.log('[API LOG] Spreadsheet info loaded successfully.');

        // Get sheets
        const sheetAppointments = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        const sheetEmployees = docData.sheetsByTitle[SHEET_NAME_EMPLOYEES];
        const sheetTechnicians = docData.sheetsByTitle[SHEET_NAME_TECHNICIANS];
        const sheetFranchises = docData.sheetsByTitle[SHEET_NAME_FRANCHISES];

        // Verification log
        console.log(`[API LOG] Sheet found? Appointments: ${!!sheetAppointments}, Employees: ${!!sheetEmployees}, Technicians: ${!!sheetTechnicians}, Franchises: ${!!sheetFranchises}`);

        if (!sheetAppointments || !sheetEmployees || !sheetTechnicians || !sheetFranchises) {
            const errorMessage = 'One or more essential sheets were not found in the spreadsheets.';
            console.error(`[API LOG] ERROR: ${errorMessage}`);
            return res.status(404).json({ error: errorMessage });
        }

        // Fetch Technicians
        console.log(`[API LOG] Fetching technicians from sheet: "${SHEET_NAME_TECHNICIANS}"...`);
        await sheetTechnicians.loadCells('A1:A' + sheetTechnicians.rowCount);
        const technicians = [];
        for (let i = 1; i < sheetTechnicians.rowCount; i++) {
            const cell = sheetTechnicians.getCell(i, 0);
            if (cell.value) {
                technicians.push(cell.value);
            }
        }
        console.log(`[API LOG] Found ${technicians.length} technicians.`);
        if (technicians.length > 0) {
            console.log('[API LOG] Technicians list:', technicians);
        }

        // Fetch Appointments
        console.log(`[API LOG] Fetching appointments from sheet: "${SHEET_NAME_APPOINTMENTS}"...`);
        await sheetAppointments.loadCells('B1:E' + sheetAppointments.rowCount);
        const appointments = [];
        for (let i = 1; i < sheetAppointments.rowCount; i++) {
            const dateCell = sheetAppointments.getCell(i, 1);
            if (dateCell.value) {
                appointments.push({ 
                    date: excelDateToYYYYMMDD(dateCell.value),
                    pets: sheetAppointments.getCell(i, 2).value,
                    closer1: sheetAppointments.getCell(i, 3).value,
                    closer2: sheetAppointments.getCell(i, 4).value
                });
            }
        }
        console.log(`[API LOG] Found ${appointments.length} appointments.`);

        // Fetch Employees
        console.log(`[API LOG] Fetching employees from sheet: "${SHEET_NAME_EMPLOYEES}"...`);
        await sheetEmployees.loadCells('A1:A' + sheetEmployees.rowCount);
        const employees = [];
        for (let i = 1; i < sheetEmployees.rowCount; i++) {
            const cell = sheetEmployees.getCell(i, 0);
            if (cell.value) {
                employees.push(cell.value);
            }
        }
        console.log(`[API LOG] Found ${employees.length} employees.`);
        
        // Fetch Franchises
        console.log(`[API LOG] Fetching franchises from sheet: "${SHEET_NAME_FRANCHISES}"...`);
        await sheetFranchises.loadCells('A1:A' + sheetFranchises.rowCount);
        const franchises = [];
        for (let i = 1; i < sheetFranchises.rowCount; i++) {
            const cell = sheetFranchises.getCell(i, 0);
            if (cell.value) {
                franchises.push(cell.value);
            }
        }
        console.log(`[API LOG] Found ${franchises.length} franchises.`);

        const responseData = {
            appointments,
            employees,
            technicians,
            franchises
        };

        console.log('[API LOG] Sending successful response to client.');
        return res.status(200).json(responseData);

    } catch (error) {
        console.error('[API LOG] CRITICAL ERROR in /api/get-dashboard-data:', error);
        res.status(500).json({ error: 'A critical server error occurred while fetching dashboard data.' });
    }
}
