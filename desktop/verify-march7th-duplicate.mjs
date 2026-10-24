import {app} from 'electron';
app.setPath('userData',process.argv[2]);
await import('./main.js');
// If the lock fails to reject this duplicate, fail the integration test.
setTimeout(()=>app.exit(2),3000);
