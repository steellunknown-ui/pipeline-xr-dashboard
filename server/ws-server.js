const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3001 });

const deploymentPipeline = [
  { level: 'info', message: 'Starting deployment process...', source: 'deployment-service' },
  { level: 'info', message: 'Authenticating with registry...', source: 'auth-service' },
  { level: 'info', message: 'Pulling Docker image from registry...', source: 'docker' },
  { level: 'warn', message: 'Large image size detected (2.1GB)', source: 'docker' },
  { level: 'info', message: 'Image pulled successfully', source: 'docker' },
  { level: 'info', message: 'Creating container...', source: 'docker' },
  { level: 'info', message: 'Installing dependencies...', source: 'build-service' },
  { level: 'info', message: 'Running npm install...', source: 'npm' },
  { level: 'warn', message: 'Deprecated package found: lodash@3.10.1', source: 'npm' },
  { level: 'info', message: 'Dependencies installed (247 packages)', source: 'npm' },
  { level: 'error', message: 'Build failed: Missing environment variable DATABASE_URL', source: 'build-service' },
  { level: 'info', message: 'Retrying build with fallback configuration...', source: 'build-service' },
  { level: 'info', message: 'Building application...', source: 'build-service' },
  { level: 'info', message: 'Running build command: npm run build', source: 'build-service' },
  { level: 'info', message: 'Compiling TypeScript files...', source: 'typescript' },
  { level: 'warn', message: 'Unused variable detected in utils.ts:42', source: 'typescript' },
  { level: 'info', message: 'Build completed successfully', source: 'build-service' },
  { level: 'info', message: 'Optimizing bundle size...', source: 'webpack' },
  { level: 'info', message: 'Bundle size: 2.3MB (gzipped: 847KB)', source: 'webpack' },
  { level: 'info', message: 'Starting health checks...', source: 'health-service' },
  { level: 'info', message: 'Health check passed: /api/health', source: 'health-service' },
  { level: 'info', message: 'Deploying to production environment...', source: 'deployment-service' },
  { level: 'info', message: 'Updating load balancer configuration...', source: 'load-balancer' },
  { level: 'info', message: 'Rolling out to 3 instances...', source: 'orchestrator' },
  { level: 'info', message: 'Instance 1/3 deployed successfully', source: 'orchestrator' },
  { level: 'info', message: 'Instance 2/3 deployed successfully', source: 'orchestrator' },
  { level: 'info', message: 'Instance 3/3 deployed successfully', source: 'orchestrator' },
  { level: 'info', message: 'Running post-deployment tests...', source: 'test-runner' },
  { level: 'info', message: 'All tests passed ✓', source: 'test-runner' },
  { level: 'info', message: 'Deployment completed successfully!', source: 'deployment-service' },
  { level: 'info', message: 'Application is live at https://pipeline-xr.vercel.app', source: 'deployment-service' }
];

function createDeploymentLog(step, logCounter) {
  return {
    id: `log_${logCounter}`,
    timestamp: new Date().toISOString(),
    level: step.level,
    message: step.message,
    source: step.source
  };
}

wss.on('connection', function connection(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const deploymentId = url.pathname.split('/').pop();
  
  console.log(`Client connected for deployment: ${deploymentId}`);
  
  let currentStep = 0;
  
  // Send initial connection message
  ws.send(JSON.stringify({
    id: 'connection_established',
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `Connected to deployment logs for ${deploymentId}`,
    source: 'websocket-server'
  }));
  
  // Send deployment pipeline logs sequentially
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN && currentStep < deploymentPipeline.length) {
      const step = deploymentPipeline[currentStep];
      const log = createDeploymentLog(step, currentStep + 1);
      ws.send(JSON.stringify(log));
      
      currentStep++;
      
      // If we've sent all steps, close the connection gracefully
      if (currentStep >= deploymentPipeline.length) {
        console.log(`Deployment pipeline completed for ${deploymentId}. Closing connection.`);
        clearInterval(interval);
        
        // Send final message and close after a short delay
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1000, 'Deployment completed');
          }
        }, 2000);
      }
    }
  }, 3000); // 3 seconds - gives users time to read AI analysis
  
  ws.on('close', function close() {
    console.log(`Client disconnected from deployment: ${deploymentId}`);
    clearInterval(interval);
  });
  
  ws.on('error', function error(err) {
    console.error('WebSocket error:', err);
    clearInterval(interval);
  });
});

console.log('WebSocket server running on ws://localhost:3001');
console.log('Connect to: ws://localhost:3001/logs/{deploymentId}');