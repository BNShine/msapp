// alansalviano/myshineapp/myshineapp-db2432304fc990c3e93b2326d7faa293e6a13b38/api/get-customers-data.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { excelDateToYYYYMMDD } from './utils.js';
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
        console.log('Tentando carregar informações da planilha...');
        await docAppointments.loadInfo();
        console.log('Informações da planilha carregadas com sucesso.');

        const sheetAppointments = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        if (!sheetAppointments) {
            console.error(`Sheet "${SHEET_NAME_APPOINTMENTS}" not found.`);
            return res.status(404).json({ error: `Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.` });
        }
        console.log(`Planilha "${SHEET_NAME_APPOINTMENTS}" encontrada.`);

        console.log('Carregando linhas da planilha...');
        const rows = await sheetAppointments.getRows();
        console.log(`Encontradas ${rows.length} linhas.`);

        if (rows.length === 0) {
            return res.status(200).json({ customers: [] });
        }
        
        console.log('Dados da primeira linha:', rows[0]._rawData);

        const headerRow = sheetAppointments.headerValues;
        const headersToIndex = {};
        headerRow.forEach((header, index) => {
            headersToIndex[header] = index;
        });

        const customers = rows.map(row => {
            const getCellValue = (header) => {
                const index = headersToIndex[header];
                if (index !== undefined && row._rawData.length > index) {
                    return row._rawData[index];
                }
                return '';
            };

            const customerData = {
                type: getCellValue('Type'),
                date: excelDateToYYYYMMDD(getCellValue('Date')),
                pets: getCellValue('Pets'),
                closer1: getCellValue('Closer (1)'),
                closer2: getCellValue('Closer (2)'),
                customers: getCellValue('Customers'),
                phone: getCellValue('Phone'),
                oldNew: getCellValue('Old/New'),
                appointmentDate: excelDateToYYYYMMDD(getCellValue('Date (Appointment)')),
                serviceValue: getCellValue('Service Value'),
                franchise: getCellValue('Franchise'),
                city: getCellValue('City'),
                source: getCellValue('Source'),
                week: getCellValue('Week'),
                month: getCellValue('Month'),
                year: getCellValue('Year'),
                code: getCellValue('Code'), // MANTER O CÓDIGO
                reminderDate: excelDateToYYYYMMDD(getCellValue('Reminder Date')),
                technician: getCellValue('Technician'),
                petShowed: getCellValue('Pet Showed'),
                serviceShowed: getCellValue('Service Showed'),
                tips: getCellValue('Tips'),
                percentage: getCellValue('Percentage'), // ADICIONAR PERCENTAGE
                paymentMethod: getCellValue('Method'),
                verification: getCellValue('Verification'),
                sheetRowNumber: row.rowNumber
            };
            return customerData;
        });
        
        console.log('Mapeamento de clientes concluído.');
        const responseData = {
            customers
        };

        return res.status(200).json(responseData);

    } catch (error) {
        console.error('Error fetching customer data:', error);
        res.status(500).json({ error: 'Falha ao buscar dados dos clientes.' });
    }
}
