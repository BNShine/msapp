import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_APPOINTMENTS } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.SHEET_ID_APPOINTMENTS, serviceAccountAuth);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { type, data, pets, closer1, closer2, customers, phone, oldNew, appointmentDate, serviceValue, franchise, city, source, week, month, year, code, reminderDate } = req.body;

        // Validação de dados de entrada
        if (!type || !data || !customers || !phone || !appointmentDate || !serviceValue || !franchise || !city || !source) {
            return res.status(400).json({ success: false, message: 'Todos os campos obrigatórios precisam ser preenchidos.' });
        }

        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        if (!sheet) {
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.` });
        }

        const newRow = {
            'Type': type,
            'Date': data,
            'Pets': pets,
            'Closer (1)': closer1, 
            'Closer (2)': closer2, 
            'Customers': customers,
            'Phone': phone,
            'Old/New': oldNew,
            'Date (Appointment)': appointmentDate,
            'Service Value': serviceValue,
            'Franchise': franchise,
            'City': city,
            'Source': source,
            'Week': week,
            'Month': month,
            'Year': year,
            'Code': code,
            'Reminder Date': reminderDate,
        };

        await sheet.addRow(newRow);

        return res.status(201).json({ success: true, message: 'Agendamento registrado com sucesso!' });
    } catch (error) {
        console.error('Erro ao registrar agendamento:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor. Por favor, tente novamente.' });
    }
}
