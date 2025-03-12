const config = {
    API_URL: 'http://localhost:3000',
    WS_URL: 'ws://localhost:3000'
};

if (process.env.NODE_ENV === 'production') {
    config.API_URL = 'https://your-production-api-url';
    config.WS_URL = 'wss://your-production-api-url';
}
