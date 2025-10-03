// api/register-appointment.js
const { google } = require('googleapis');
const { getAuth } = require('./utils');
const { spreadsheetId } = require('./configs/sheets-config');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Incluído 'verification' na desestruturação
    const { 
        type, 
        data, 
        pets, 
        closer1, 
        closer2, 
        customers, 
        phone, 
        oldNew, 
        appointmentDate, 
        serviceValue, 
        franchise, 
        city, 
        source, 
        week, 
        month, 
        year, 
        value, 
        code, 
        reminderDate,
        verification // <-- Adicionado aqui!
    } = req.body;

    // A planilha deve ser "Appointment"
    const sheetName = 'Appointment';
    const range = `${sheetName}!A:Z`;

    // A ordem dos valores deve corresponder às colunas da sua planilha.
    // Presumindo que 'Verification' é uma das últimas colunas:
    const values = [
      type,
      data,
      pets,
      closer1,
      closer2,
      customers,
      phone,
      oldNew,
      appointmentDate,
      serviceValue,
      franchise,
      city,
      source,
      week,
      month,
      year,
      value,
      code,
      reminderDate,
      verification // <-- Usado aqui!
    ];

    const resource = {
      values: [values],
    };

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: resource,
    });

    res.status(200).json({ success: true, message: 'Appointment registered successfully', response: response.data });
  } catch (error) {
    console.error('Error registering appointment:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
};
