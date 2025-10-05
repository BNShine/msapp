// api/manage-technician-availability.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_AVAILABILITY } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = process.env.SHEET_ID;

export default async function handler(req, res) {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_AVAILABILITY];
        if (!sheet) {
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_AVAILABILITY}" não encontrada.` });
        }

        // --- LÓGICA DE GET ---
        if (req.method === 'GET') {
            const { technicianName } = req.query;
            const rows = await sheet.getRows();
            let availabilityData = rows.map(row => ({
                technician: row.get('TechnicianName'),
                date: row.get('Date'),
                startHour: row.get('StartHour'),
                endHour: row.get('EndHour'),
                notes: row.get('Notes'),
                rowNumber: row.rowNumber
            }));
            if (technicianName) {
                availabilityData = availabilityData.filter(block => block.technician === technicianName);
            }
            return res.status(200).json({ availability: availabilityData });
        }

        // --- LÓGICA DE POST (CRIAR NOVO) ---
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

        // --- INÍCIO DA NOVA LÓGICA DE PUT (ATUALIZAR) ---
        if (req.method === 'PUT') {
            const { rowNumber, date, startHour, endHour, notes } = req.body;
            if (!rowNumber || !date || !startHour || !endHour) {
                return res.status(400).json({ success: false, message: 'Dados insuficientes para atualizar.' });
            }
            const rows = await sheet.getRows();
            const rowToUpdate = rows.find(row => row.rowNumber === rowNumber);
            if (!rowToUpdate) {
                return res.status(404).json({ success: false, message: 'Bloco de tempo não encontrado para atualização.' });
            }
            rowToUpdate.set('Date', date);
            rowToUpdate.set('StartHour', startHour);
            rowToUpdate.set('EndHour', endHour);
            rowToUpdate.set('Notes', notes || '');
            await rowToUpdate.save();
            return res.status(200).json({ success: true, message: 'Bloco de tempo atualizado com sucesso!' });
        }
        // --- FIM DA NOVA LÓGICA DE PUT ---

        // --- INÍCIO DA NOVA LÓGICA DE DELETE ---
        if (req.method === 'DELETE') {
            const { rowNumber } = req.body;
            if (!rowNumber) {
                return res.status(400).json({ success: false, message: 'ID do bloco de tempo não fornecido.' });
            }
            const rows = await sheet.getRows();
            const rowToDelete = rows.find(row => row.rowNumber === rowNumber);
            if (!rowToDelete) {
                return res.status(404).json({ success: false, message: 'Bloco de tempo não encontrado para exclusão.' });
            }
            await rowToDelete.delete();
            return res.status(200).json({ success: true, message: 'Bloco de tempo excluído com sucesso!' });
        }
        // --- FIM DA NOVA LÓGICA DE DELETE ---

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        console.error('Erro na API de disponibilidade:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor.' });
    }
}
