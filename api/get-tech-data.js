import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const techDataJson = process.env.TECH_CIDADES_JSON;
        
        if (!techDataJson) {
            console.error('Environment variable TECH_CIDADES_JSON is not set.');
            return res.status(500).json({ error: 'Environment variable TECH_CIDADES_JSON not found.' });
        }

        const techData = JSON.parse(techDataJson);

        return res.status(200).json(techData);

    } catch (error) {
        console.error('Error processing technician data:', error);
        res.status(500).json({ error: 'Failed to process technician data. Please check the JSON format.' });
    }
}
