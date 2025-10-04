// api/manage-technician-availability.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_AVAILABILITY } from './configs/sheets-config.js'; // Adicione esta nova variável ao seu config

dotenv.config();

// Autenticação (leitura e escrita)
const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;

export default async function handler(req, res) {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);

    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_AVAILABILITY];
        if (!sheet) {
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_AVAILABILITY}" não encontrada.` });
        }

        // --- LÓGICA DE PULL (GET) ---
        if (req.method === 'GET') {
            const { technicianName } = req.query;
            const rows = await sheet.getRows();

            let availabilityData = rows.map(row => ({
                technician: row.get('TechnicianName'),
                date: row.get('Date'),
                startHour: row.get('StartHour'),
                endHour: row.get('EndHour'),
                notes: row.get('Notes'),
                rowNumber: row.rowNumber // importante para futuras edições/deletações
            }));

            if (technicianName) {
                availabilityData = availabilityData.filter(block => block.technician === technicianName);
            }

            return res.status(200).json({ availability: availabilityData });
        }

        // --- LÓGICA DE PUSH (POST) ---
        if (req.method === 'POST') {
            const { technicianName, date, startHour, endHour, notes } = req.body;

            if (!technicianName || !date || !startHour || !endHour) {
                return res.status(400).json({ success: false, message: 'Campos obrigatórios estão faltando.' });
            }

            await sheet.addRow({
                TechnicianName: technicianName,
                Date: date,
                StartHour: startHour,
                EndHour: endHour,
                Notes: notes || '',
            });

            return res.status(201).json({ success: true, message: 'Bloco de tempo salvo com sucesso!' });
        }

        // Se o método não for GET ou POST
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        console.error('Erro na API de disponibilidade:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor.' });
    }
}
