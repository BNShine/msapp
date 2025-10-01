// alansalviano/myshineapp/myshineapp-18a461598f3c9c98d96afa273b479d93020ab378/api/login.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
// REMOVIDO: import dotenv from 'dotenv';
import { SHEET_NAME_USERS } from './configs/sheets-config.js';

// REMOVIDO: dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { role, email, password } = req.body;

    console.log('Received data:', { role, email, password });

    // --- Handle Access Code Login Scenario (e.g., from finance-credentials.html) ---
    // If role and email are absent, it attempts a code-based login against F_CODE.
    if (!role && !email && password) {
        // Agora, process.env.F_CODE deve ser lido diretamente do ambiente de runtime.
        const fCodeEnv = process.env.F_CODE; 
        
        if (!fCodeEnv) {
            console.error('Environment variable F_CODE is not set.');
            return res.status(500).json({ success: false, message: 'Server configuration error: F_CODE not set.' });
        }

        // Assume F_CODE format is "REDIRECT_URL,ACCESS_CODE"
        const [redirectUrl, accessCode] = fCodeEnv.split(',');

        if (!accessCode || !redirectUrl) {
            console.error('Environment variable F_CODE is improperly formatted.');
            return res.status(500).json({ success: false, message: 'Server configuration error: F_CODE improperly formatted.' });
        }

        if (password.trim() === accessCode.trim()) {
            console.log('Access code login successful.');
            return res.status(200).json({ success: true, message: 'Access Granted!', redirectUrl });
        } else {
            console.log('Access code login failed: Invalid password.');
            return res.status(401).json({ success: false, message: 'Invalid access code.' });
        }
    }
    // --- End Access Code Handler ---


    // --- Standard User Login Logic (Requires Role, Email, and Password) ---
    if (!role || !email || !password) {
        console.error('Validation Error: Role, email, or password is missing.');
        return res.status(400).json({ success: false, message: 'Role, email and password are required.' });
    }

    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_USERS];
        if (!sheet) {
            console.error('Spreadsheet Error: "Users" sheet not found.');
            return res.status(500).json({ success: false, message: `Spreadsheet "${SHEET_NAME_USERS}" not found.` });
        }

        const rows = await sheet.getRows();

        console.log('Fetched rows from sheet:', rows.map(row => ({
            role: row._rawData[0],
            email: row._rawData[1],
            password: row._rawData[2]
        })));

        const user = rows.find(row => {
            const rowRole = row._rawData[0] || '';
            const rowEmail = row._rawData[1] || '';
            const rowPassword = row._rawData[2] || '';

            console.log(`Comparing: Role "${role}" vs "${rowRole}", Email "${email}" vs "${rowEmail}", Password "${password}" vs "${rowPassword}"`);

            return rowRole.trim().toLowerCase() === role.trim().toLowerCase() &&
                   rowEmail.trim().toLowerCase() === email.trim().toLowerCase() &&
                   rowPassword.trim() === password.trim();
        });


        if (user) {
            console.log('Login successful for user:', email);
            const redirectUrl = "appointments.html";
            return res.status(200).json({ success: true, message: 'Login successful!', redirectUrl });
        } else {
            console.log('Login failed: Invalid credentials.');
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
    } catch (error) {
        console.error('Error processing login:', error);
        return res.status(500).json({ success: false, message: 'An error occurred on the server. Please try again.' });
    }
}
