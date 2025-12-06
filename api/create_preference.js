// api/create_preference.js (Versión Final con CORS Forzado)

const mercadopago = require('mercadopago');

// Exportamos la función handler para Vercel
module.exports = async (req, res) => {
    
    // ------------------------------------------------------------------
    // 💥 CORS - Forzar Headers antes de cualquier retorno (CRÍTICO) 💥
    // ------------------------------------------------------------------
    // Permitir acceso desde cualquier origen (incluyendo http://localhost)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // ------------------------------------------------------------------
    // 💥 CORS (Manejo de Preflight OPTIONS) 💥
    // ------------------------------------------------------------------
    if (req.method === 'OPTIONS') {
        // En un OPTIONS (preflight), respondemos 200 OK y terminamos
        // Esto soluciona el error "It does not have HTTP ok status"
        return res.status(200).end();
    }
    // ------------------------------------------------------------------
    
    if (req.method !== 'POST') {
        return res.status(405).send('Método no permitido. Solo POST.');
    }
    
    // Configuración de Mercado Pago usando la variable de entorno de Vercel
    if (!process.env.MP_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'Token de acceso de MP no configurado en Vercel.' });
    }
    
    try {
        // Inicialización de MP (usando el método correcto para v2.x)
        mercadopago.configurations.setAccessToken(process.env.MP_ACCESS_TOKEN);

        const { items, orderId } = req.body; 
        
        if (!items || items.length === 0 || !orderId) {
            return res.status(400).json({ error: 'Faltan datos (items o orderId) para crear la preferencia.' });
        }

        // Mapeo de items
        const mpItems = items.map(item => ({
            title: item.name,
            unit_price: parseFloat(item.price) || 0, 
            quantity: parseInt(item.cantidad) || 1, 
            currency_id: 'MXN' 
        }));

        // USAMOS VERCEL_URL para el dominio si existe
        const VERCEL_DOMAIN = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : "http://localhost:80/Pizzas%20Jarocho"; 

        const preference = {
            items: mpItems,
            external_reference: orderId, 
            back_urls: {
                success: `${VERCEL_DOMAIN}/notifications.html?payment=success&orderId=${orderId}`, 
                failure: `${VERCEL_DOMAIN}/cart.html?payment=failure`,
                pending: `${VERCEL_DOMAIN}/cart.html?payment=pending`,
            },
            notification_url: `${VERCEL_DOMAIN}/api/mp_webhook?source_topic=merchant_order`, 
            auto_return: "approved"
        };

        const result = await mercadopago.preferences.create(preference);
        
        return res.status(200).json({ 
            id: result.body.id,
            init_point: result.body.init_point 
        });

    } catch (error) {
        console.error("Error al crear la preferencia de pago:", error.cause || error.message);
        return res.status(500).json({ 
            error: 'Error interno al crear la preferencia de pago.',
            detail: error.message || 'Error desconocido. Revisar logs de Vercel.'
        });
    }
};