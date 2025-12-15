const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const ssm = new SSMClient({ region: 'eu-west-2' });

let maintenanceMode = null;
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
    if (maintenanceMode !== null && now - cacheTime < CACHE_TTL) {
        console.log('Using cached maintenance mode:', maintenanceMode);
        if (maintenanceMode) {
            console.log('Redirecting to maintenance page (cached)');
            return {
                status: '302',
                statusDescription: 'Found',
                headers: {
                    'location': [{ key: 'Location', value: '/maintenance.html' }]
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
        maintenanceMode = response.Parameter.Value === 'true';
        cacheTime = now;
        
        if (maintenanceMode) {
            console.log('Redirecting to maintenance page (from SSM)');
            return {
                status: '302',
                statusDescription: 'Found',
                headers: {
                    'location': [{ key: 'Location', value: '/maintenance.html' }]
                }
            };
        }
    } catch (error) {
        console.log('Error checking maintenance mode:', error);
        maintenanceMode = false;
    }
    
    console.log('Allowing request through');
    return request;
};
