// api/get-dashboard-data.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { excelDateToYYYYMMDD } from './utils.js';
import { SHEET_NAME_APPOINTMENTS, SHEET_NAME_EMPLOYEES, SHEET_NAME_FRANCHISES, SHEET_NAME_TECHNICIANS } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    let technicians = [];
    let appointments = [];
    let employees = [];
    let franchises = [];

    try {
        const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);

        await Promise.all([docAppointments.loadInfo(), docData.loadInfo()]);

        // Busca Técnicos (de forma resiliente)
        const sheetTechnicians = docData.sheetsByTitle[SHEET_NAME_TECHNICIANS];
        if (sheetTechnicians) {
            await sheetTechnicians.loadCells('A1:A' + sheetTechnicians.rowCount);
            for (let i = 1; i < sheetTechnicians.rowCount; i++) {
                const cell = sheetTechnicians.getCell(i, 0);
                if (cell.value) {
                    technicians.push(cell.value);
                }
            }
        } else {
            console.warn(`[API WARN] Planilha "${SHEET_NAME_TECHNICIANS}" não encontrada.`);
        }

        // Busca Employees (de forma resiliente)
        const sheetEmployees = docData.sheetsByTitle[SHEET_NAME_EMPLOYEES];
        if (sheetEmployees) {
            await sheetEmployees.loadCells('A1:A' + sheetEmployees.rowCount);
            for (let i = 1; i < sheetEmployees.rowCount; i++) {
                const cell = sheetEmployees.getCell(i, 0);
                if (cell.value) {
                    employees.push(cell.value);
                }
            }
        } else {
            console.warn(`[API WARN] Planilha "${SHEET_NAME_EMPLOYEES}" não encontrada.`);
        }
        
        // Busca Franchises (de forma resiliente)
        const sheetFranchises = docData.sheetsByTitle[SHEET_NAME_FRANCHISES];
        if (sheetFranchises) {
            await sheetFranchises.loadCells('A1:A' + sheetFranchises.rowCount);
            for (let i = 1; i < sheetFranchises.rowCount; i++) {
                const cell = sheetFranchises.getCell(i, 0);
                if (cell.value) {
                    franchises.push(cell.value);
                }
            }
        } else {
            console.warn(`[API WARN] Planilha "${SHEET_NAME_FRANCHISES}" não encontrada.`);
        }

        // Busca Appointments (de forma resiliente)
        const sheetAppointments = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        if (sheetAppointments) {
            await sheetAppointments.loadCells('B1:E' + sheetAppointments.rowCount);
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
        } else {
            console.warn(`[API WARN] Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.`);
        }

        const responseData = { appointments, employees, technicians, franchises };
        return res.status(200).json(responseData);

    } catch (error) {
        console.error('[API LOG] CRITICAL ERROR in /api/get-dashboard-data:', error);
        res.status(500).json({ 
            error: 'A critical server error occurred.',
            appointments: [],
            employees: [],
            technicians: [],
            franchises: []
        });
    }
}
