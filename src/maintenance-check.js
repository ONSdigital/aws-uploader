const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const ssm = new SSMClient({ region: 'eu-west-2' });

let maintenanceConfig = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 60 seconds

exports.handler = async (event) => {
    const request = event.Records[0].cf.request;
    const uri = request.uri;
    
    console.log('Lambda@Edge triggered for URI:', uri);
    
    // Skip maintenance check for the maintenance page itself and static assets
    if (uri === '/maintenance.html' || uri.startsWith('/css/') || uri.startsWith('/js/')) {
        console.log('Skipping maintenance check for:', uri);
        return request;
    }
    
    // Check cache first
    const now = Date.now();
    if (maintenanceConfig !== null && now - cacheTime < CACHE_TTL) {
        console.log('Using cached maintenance config:', maintenanceConfig);
        if (maintenanceConfig.enabled) {
            console.log('Redirecting to maintenance page (cached)');
            const location = maintenanceConfig.message 
                ? `/maintenance.html?message=${encodeURIComponent(maintenanceConfig.message)}`
                : '/maintenance.html';
            return {
                status: '302',
                statusDescription: 'Found',
                headers: {
                    'location': [{ key: 'Location', value: location }]
                }
            };
        }
        return request;
    }
    
    // Fetch from SSM
    try {
        console.log('Fetching maintenance mode from SSM');
        const command = new GetParameterCommand({ Name: '/uploader/maintenance-mode' });
        const response = await ssm.send(command);
        console.log('SSM response:', response.Parameter.Value);
        
        // Support both simple boolean and JSON format
        let value = response.Parameter.Value;
        if (value === 'true' || value === 'false') {
            maintenanceConfig = { enabled: value === 'true', message: null };
        } else {
            maintenanceConfig = JSON.parse(value);
        }
        cacheTime = now;
        
        if (maintenanceConfig.enabled) {
            console.log('Redirecting to maintenance page (from SSM)');
            const location = maintenanceConfig.message 
                ? `/maintenance.html?message=${encodeURIComponent(maintenanceConfig.message)}`
                : '/maintenance.html';
            return {
                status: '302',
                statusDescription: 'Found',
                headers: {
                    'location': [{ key: 'Location', value: location }]
                }
            };
        }
    } catch (error) {
        console.log('Error checking maintenance mode:', error);
        maintenanceConfig = { enabled: false, message: null };
    }
    
    console.log('Allowing request through');
    return request;
};
