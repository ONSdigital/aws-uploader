const AWS = require('aws-sdk');
const ssm = new AWS.SSM({ region: 'us-east-1' });

const MAINTENANCE_PARAM = '/cloudfront/maintenance_mode'; // SSM parameter name
const MAINTENANCE_PAGE_PATH = '/council-tax/maintenance_page.html';
const S3_BUCKET = 'aws-uploader-ost-dev'; // update if needed

exports.handler = async (event, context, callback) => {
    const request = event.Records[0].cf.request;
    let maintenanceMode = false;

    try {
        const param = await ssm.getParameter({ Name: MAINTENANCE_PARAM }).promise();
        maintenanceMode = param.Parameter.Value === 'true';
    } catch (err) {
        // If SSM fails, default to not in maintenance
        maintenanceMode = false;
    }

    if (maintenanceMode) {
        // Serve the maintenance page from S3
        const response = {
            status: '503',
            statusDescription: 'Service Unavailable',
            headers: {
                'cache-control': [{ key: 'Cache-Control', value: 'no-cache' }],
                'content-type': [{ key: 'Content-Type', value: 'text/html' }],
            },
            body: await getMaintenancePage(),
        };
        callback(null, response);
    } else {
        callback(null, request);
    }
};

async function getMaintenancePage() {
    const s3 = new AWS.S3({ region: 'eu-west-2' }); // update region if needed
    try {
        const data = await s3.getObject({
            Bucket: S3_BUCKET,
            Key: MAINTENANCE_PAGE_PATH.replace(/^\//, ''),
        }).promise();
        return data.Body.toString('utf-8');
    } catch (err) {
        return '<h1>Maintenance</h1><p>The site is under maintenance.</p>';
    }
}
