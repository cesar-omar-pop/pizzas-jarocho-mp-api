// api/create_preference.js

const mercadopago = require('mercadopago');

// Exportamos la función handler para Vercel
module.exports = async (req, res) => {
    
    // ------------------------------------------------------------------
    // 💥 CORRECCIÓN CRÍTICA DE CORS (Manejo de Preflight OPTIONS) 💥
    // ------------------------------------------------------------------
    // Vercel.json ya pone los headers, pero la función debe responder 200.
    if (req.method === 'OPTIONS') {
        // En un OPTIONS (preflight), respondemos 200 OK y terminamos
        return res.status(200).end();
    }
    // ------------------------------------------------------------------
    
    if (req.method !== 'POST') {
        // Si no es OPTIONS ni POST, devolvemos 405
        return res.status(405).send('Método no permitido. Solo POST.');
    }
    
    // Configurar Mercado Pago usando la variable de entorno de Vercel
    if (!process.env.MP_ACCESS_TOKEN) {
        // CRÍTICO: Si no hay token, fallará. Se debe configurar en Vercel.
        return res.status(500).json({ error: 'Token de acceso de MP no configurado. (ERROR 500)' });
    }
    mercadopago.configure({
        access_token: process.env.MP_ACCESS_TOKEN 
    });

    try {
        const { items, orderId } = req.body; 
        
        if (!items || items.length === 0 || !orderId) {
            return res.status(400).json({ error: 'Faltan datos (items o orderId) para crear la preferencia.' });
        }

        // Corrección de Cantidad (item.cantidad)
        const mpItems = items.map(item => ({
            title: item.name,
            unit_price: parseFloat(item.price) || 0, 
            quantity: parseInt(item.cantidad) || 1, 
            currency_id: 'MXN' 
        }));

        // Corrección de Dominio (VERCEL_URL)
        const DOMAIN = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : "http://localhost/Pizzas%20Jarocho"; 

        const preference = {
            items: mpItems,
            external_reference: orderId, 
            back_urls: {
                success: `${DOMAIN}/notifications.html?payment=success&orderId=${orderId}`, 
                failure: `${DOMAIN}/cart.html?payment=failure`,
                pending: `${DOMAIN}/cart.html?payment=pending`,
            },
            notification_url: `${DOMAIN}/api/mp_webhook?source_topic=merchant_order`, 
            auto_return: "approved"
        };

        const result = await mercadopago.preferences.create(preference);
        
        return res.status(200).json({ 
            id: result.body.id,
            init_point: result.body.init_point 
        });

    } catch (error) {
        console.error("Error al crear la preferencia de pago:", error.cause || error);
        return res.status(500).json({ error: 'Error interno al crear la preferencia de pago. (Revisar logs de Vercel)' });
    }
};