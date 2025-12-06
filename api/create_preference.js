// api/create_preference.js

const mercadopago = require('mercadopago');

// Exportamos la función handler para Vercel
module.exports = async (req, res) => {
    
    // 1. Configuración de CORS y método (Solo POST)
    res.setHeader('Access-Control-Allow-Origin', '*'); // Permite llamadas desde cualquier dominio (CORS)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).send('Método no permitido. Solo POST.');
    }
    
    // Configurar Mercado Pago usando la variable de entorno de Vercel
    if (!process.env.MP_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'Token de acceso de MP no configurado.' });
    }
    mercadopago.configure({
        access_token: process.env.MP_ACCESS_TOKEN 
    });

    try {
        const { items, orderId } = req.body; // Recibimos el carrito y el ID de Firestore
        
        if (!items || items.length === 0 || !orderId) {
            return res.status(400).json({ error: 'Datos de pedido incompletos.' });
        }
        
        const mpItems = items.map(item => ({
            title: item.name,
            unit_price: item.price,
            quantity: item.quantity,
            currency_id: 'MXN' 
        }));

        // NOTA: Para probar localmente (XAMPP), debes usar las URL de tu entorno
        const DOMAIN = "http://localhost/Pizzas%20Jarocho"; // Cambia esto si tienes un dominio real

        const preference = {
            items: mpItems,
            // Agregamos el ID de la orden de Firestore como referencia
            external_reference: orderId, 
            back_urls: {
                success: `${DOMAIN}/notifications.html?payment=success&orderId=${orderId}`, 
                failure: `${DOMAIN}/cart.html?payment=failure`,
                pending: `${DOMAIN}/cart.html?payment=pending`,
            },
            // Webhook para producción (después lo configurarás)
            notification_url: `${DOMAIN}/api/mp_webhook?source_topic=merchant_order`, 
            auto_return: "approved"
        };

        const result = await mercadopago.preferences.create(preference);
        
        // Devolver la URL de redirección
        return res.status(200).json({ 
            id: result.body.id,
            init_point: result.body.init_point // La URL de pago de MP
        });

    } catch (error) {
        console.error("Error al crear la preferencia de pago:", error);
        return res.status(500).json({ 
            error: 'Error interno al procesar el pago.',
            details: error.message 
        });
    }
};