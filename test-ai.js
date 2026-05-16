const https = require('http');

async function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    body: responseBody
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

async function test() {
    console.log('Testing Homepage AI...');
    try {
        const res1 = await post('/api/assistant/homepage', { message: 'Hello homepage' });
        console.log('Homepage Status:', res1.status);
        console.log('Homepage Body:', res1.body.substring(0, 200) + '...');
    } catch (e) {
        console.error('Homepage Error:', e.message);
    }

    console.log('\nTesting Dashboard AI...');
    try {
        const res2 = await post('/api/assistant', { message: 'Hello dashboard', userId: 'test-user' });
        console.log('Dashboard Status:', res2.status);
        console.log('Dashboard Body:', res2.body.substring(0, 200) + '...');
    } catch (e) {
        console.error('Dashboard Error:', e.message);
    }
}

test();
