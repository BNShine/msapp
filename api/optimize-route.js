// api/optimize-route.js
import fetch from 'node-fetch'; // Certifique-se de que 'node-fetch' está no seu package.json
import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { originZip, waypoints, isReversed } = req.body;
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
            console.error('SERVER ERROR: GOOGLE_MAPS_API_KEY is not set.');
            return res.status(500).json({ success: false, message: 'Server configuration error: API key is missing.' });
        }

        if (!originZip || !waypoints || waypoints.length === 0) {
            return res.status(400).json({ success: false, message: 'Origin and at least one waypoint are required.' });
        }

        // Constrói a URL para a API do Google Maps Directions
        const googleApiUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
        googleApiUrl.searchParams.append('origin', `zip ${originZip}`);
        // O destino é o mesmo que a origem para uma rota de retorno
        googleApiUrl.searchParams.append('destination', `zip ${originZip}`); 
        googleApiUrl.searchParams.append('key', apiKey);
        
        // Adiciona os waypoints, otimizando a ordem se não for uma rota reversa
        const waypointsString = waypoints.map(wp => `zip ${wp.zipCode}`).join('|');
        if (!isReversed) {
            googleApiUrl.searchParams.append('waypoints', `optimize:true|${waypointsString}`);
        } else {
            googleApiUrl.searchParams.append('waypoints', waypointsString);
        }

        console.log(`[API LOG] Calling Google Maps API: ${googleApiUrl.toString()}`);

        // Faz a chamada do servidor para o Google
        const apiResponse = await fetch(googleApiUrl);
        const data = await apiResponse.json();

        if (data.status !== 'OK') {
            console.error('[API LOG] Google Maps API Error:', data.error_message || data.status);
            return res.status(500).json({ success: false, message: `Google Maps API Error: ${data.status}` });
        }

        // Envia a resposta já processada de volta para o frontend
        return res.status(200).json({ success: true, routeData: data });

    } catch (error) {
        console.error('CRITICAL ERROR in /api/optimize-route:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
}
