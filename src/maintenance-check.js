const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const ssm = new SSMClient({ region: 'eu-west-2' });

let maintenanceMode = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 60 seconds

exports.handler = async (event) => {
    const request = event.Records[0].cf.request;
    const uri = request.uri;
    
    // Skip maintenance check for the maintenance page itself
    if (uri === '/maintenance.html') {
        return request;
    }
    
    // Check cache first
    const now = Date.now();
    if (maintenanceMode !== null && now - cacheTime < CACHE_TTL) {
        if (maintenanceMode) {
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
        const command = new GetParameterCommand({ Name: '/uploader/maintenance-mode' });
        const response = await ssm.send(command);
        maintenanceMode = response.Parameter.Value === 'true';
        cacheTime = now;
        
        if (maintenanceMode) {
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
    
    return request;
};
