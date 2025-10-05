// api/get-dashboard-data.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { excelDateToYYYYMMDD } from './utils.js';
import { SHEET_NAME_APPOINTMENTS, SHEET_NAME_EMPLOYEES, SHEET_NAME_FRANCHISES, SHEET_NAME_TECHNICIANS } from './configs/sheets-config.js';

dotenv.config();

// Recria a autenticação para cada requisição para garantir segurança em ambientes serverless
const getAuth = () => new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Usar escopo de apenas leitura
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;

export default async function handler(req, res) {
    console.log('[API LOG] /api/get-dashboard-data endpoint hit.');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    let technicians = [];
    let appointments = [];
    let employees = [];
    let franchises = [];

    // --- Busca de Técnicos (em bloco isolado para resiliência) ---
    try {
        if (!SPREADSHEET_ID_DATA) throw new Error("A variável de ambiente SPREADSHEET_ID_DATA não está definida.");
        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, getAuth());
        await docData.loadInfo();
        const sheetTechnicians = docData.sheetsByTitle[SHEET_NAME_TECHNICIANS];
        
        if (sheetTechnicians) {
            const rows = await sheetTechnicians.getRows();
            const headerValue = sheetTechnicians.headerValues.find(h => h.toLowerCase() === 'technician' || h.toLowerCase() === 'name');
            
            if (headerValue) {
                rows.forEach(row => {
                    const techName = row.get(headerValue);
                    if (techName) technicians.push(techName);
                });
                console.log(`[API LOG] Sucesso: Extraídos ${technicians.length} técnicos.`);
            } else {
                console.error(`[API ERROR] Nenhum cabeçalho 'Technician' ou 'Name' encontrado na aba "${SHEET_NAME_TECHNICIANS}".`);
            }
        } else {
            console.error(`[API ERROR] Aba "${SHEET_NAME_TECHNICIANS}" não encontrada na planilha com ID ${SPREADSHEET_ID_DATA}.`);
        }
    } catch (error) {
        console.error('[API CATCH - Technicians] Falha ao buscar técnicos:', error.message);
    }

    // --- Busca de Funcionários (em bloco isolado) ---
    try {
        if (!SPREADSHEET_ID_DATA) throw new Error("SPREADSHEET_ID_DATA não está definida.");
        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, getAuth());
        await docData.loadInfo();
        const sheetEmployees = docData.sheetsByTitle[SHEET_NAME_EMPLOYEES];
        if (sheetEmployees) {
            const rows = await sheetEmployees.getRows();
            const header = sheetEmployees.headerValues[0];
            if (header) rows.forEach(row => { if (row.get(header)) employees.push(row.get(header)) });
            console.log(`[API LOG] Sucesso: Extraídos ${employees.length} funcionários.`);
        } else {
            console.error(`[API ERROR] Aba "${SHEET_NAME_EMPLOYEES}" não encontrada.`);
        }
    } catch (error) {
        console.error('[API CATCH - Employees] Falha ao buscar funcionários:', error.message);
    }

    // --- Busca de Franquias (em bloco isolado) ---
    try {
        if (!SPREADSHEET_ID_DATA) throw new Error("SPREADSHEET_ID_DATA não está definida.");
        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, getAuth());
        await docData.loadInfo();
        const sheetFranchises = docData.sheetsByTitle[SHEET_NAME_FRANCHISES];
        if (sheetFranchises) {
            const rows = await sheetFranchises.getRows();
            const header = sheetFranchises.headerValues[0];
            if (header) rows.forEach(row => { if (row.get(header)) franchises.push(row.get(header)) });
            console.log(`[API LOG] Sucesso: Extraídas ${franchises.length} franquias.`);
        } else {
            console.error(`[API ERROR] Aba "${SHEET_NAME_FRANCHISES}" não encontrada.`);
        }
    } catch (error) {
        console.error('[API CATCH - Franchises] Falha ao buscar franquias:', error.message);
    }

    // --- Busca de Agendamentos (em bloco isolado) ---
    try {
        if (!SPREADSHEET_ID_APPOINTMENTS) throw new Error("SPREADSHEET_ID_APPOINTMENTS não está definida.");
        const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, getAuth());
        await docAppointments.loadInfo();
        const sheetAppointments = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        if (sheetAppointments) {
            const rows = await sheetAppointments.getRows();
            rows.forEach(row => {
                if (row.get('Date')) {
                    appointments.push({ 
                        date: excelDateToYYYYMMDD(row.get('Date')),
                        pets: row.get('Pets'),
                        closer1: row.get('Closer (1)'),
                        closer2: row.get('Closer (2)')
                    });
                }
            });
            console.log(`[API LOG] Sucesso: Extraídos ${appointments.length} agendamentos.`);
        } else {
            console.error(`[API ERROR] Aba "${SHEET_NAME_APPOINTMENTS}" não encontrada.`);
        }
    } catch (error) {
        console.error('[API CATCH - Appointments] Falha ao buscar agendamentos:', error.message);
    }

    // Sempre retorna uma resposta 200 OK com os dados que conseguiu buscar
    res.status(200).json({ appointments, employees, technicians, franchises });
}
