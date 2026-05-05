// ============================================
// CONFIGURACIÓN DE SUPABASE
// ============================================
// Aquí pegas tu URL y tu clave anon.
// Estas claves son seguras de poner aquí porque tienes RLS activado en Supabase.

const SUPABASE_CONFIG = {
    // Tu URL del proyecto (sin la parte "/rest/v1/")
    url: 'https://fmdurznjnmjudkuzubuk.supabase.co',
    
    // Tu clave anon public (pégala entre las comillas)
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtZHVyem5qbm1qdWRrdXp1YnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTQ1ODcsImV4cCI6MjA5MzQ5MDU4N30.jE2QqcsJxko_Hcu1y-WwWhkO2AY1fg2mhZVdzG3hJco'
};

// Clave pública VAPID para Web Push (pon aquí tu clave pública, puedes dejar el placeholder y generarla en el servidor)
const VAPID_PUBLIC_KEY = 'BEuBSMwg34Fa_NouR0707DnpRHLMEX6aNzUal5guYctE4R_DwTl34FnnYKv4YUUatyEcsjt1s35ZGcmwitoUuPY';
