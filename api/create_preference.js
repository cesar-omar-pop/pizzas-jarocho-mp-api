// api/create_preference.js

const mercadopago = require('mercadopago');

// Exportamos la función handler para Vercel
module.exports = async (req, res) => {
    
    if (req.method !== 'POST') {
        // Devolvemos 405 Method Not Allowed si no es POST
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
        const { items, orderId } = req.body; // Recibimos el carrito y el ID de Firestore
        
        if (!items || items.length === 0 || !orderId) {
            return res.status(400).json({ error: 'Faltan datos (items o orderId) para crear la preferencia.' });
        }

        // --- CORRECCIÓN CRÍTICA DE CANTIDAD Y PRECIO ---
        const mpItems = items.map(item => ({
            title: item.name,
            unit_price: parseFloat(item.price) || 0, // Aseguramos que sea número
            quantity: parseInt(item.cantidad) || 1, // <--- USA item.cantidad
            currency_id: 'MXN' 
        }));

        // Check if running on Vercel (Production/Preview) or local (XAMPP)
        // Usamos VERCEL_URL para asegurar que las URLs de retorno sean HTTPS y válidas
        const DOMAIN = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : "http://localhost/Pizzas%20Jarocho"; 

        const preference = {
            items: mpItems,
            // Agregamos el ID de la orden de Firestore como referencia
            external_reference: orderId, 
            back_urls: {
                // URLs de retorno configuradas dinámicamente
                success: `${DOMAIN}/notifications.html?payment=success&orderId=${orderId}`, 
                failure: `${DOMAIN}/cart.html?payment=failure`,
                pending: `${DOMAIN}/cart.html?payment=pending`,
            },
            // Webhook (Importante para producción)
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
        // Logging detallado para diagnosticar errores de Mercado Pago
        console.error("Error al crear la preferencia de pago:", error.cause || error);
        return res.status(500).json({ error: 'Error interno al crear la preferencia de pago. (Revisar logs de Vercel)' });
    }
};