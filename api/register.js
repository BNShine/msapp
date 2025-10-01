import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_USERS } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    const { role, user, email, password } = req.body;

    if (!role || !user || !email || !password) {
        return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }

    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_USERS];
        if (!sheet) {
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_USERS}" não encontrada.` });
        }

        const rows = await sheet.getRows();
        const userExists = rows.some(row => row.email === email || row.user === user);

        if (userExists) {
            return res.status(409).json({ success: false, message: 'Este e-mail ou user já está registrado.' });
        }

        await sheet.addRow({ role, user, email, password });

        return res.status(201).json({ success: true, message: 'Conta criada com sucesso! Agora você pode fazer login.' });
    } catch (error) {
        console.error('Erro ao registrar conta:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor. Por favor, tente novamente.' });
    }
}
