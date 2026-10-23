const http = require('http');
const fs = require('fs');
const path = require('path');

const boundary = '----FormBoundary123' + Date.now();
const imagePath = path.resolve(__dirname, '../../assets/hero-dog.jpg');
let imageBuffer = Buffer.alloc(0);
if (fs.existsSync(imagePath)) {
  imageBuffer = fs.readFileSync(imagePath);
}

const parts = [
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="animal_type"\r\n\r\nDog\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="breed"\r\n\r\nIndian Pariah (Indie)\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="injury_type"\r\n\r\nLeg fracture and deep abrasion\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="severity"\r\n\r\nSevere\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\nFound near highway toll plaza, unable to bear weight on hind leg.\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="location"\r\n\r\nSangamner Toll Plaza, Pune Highway\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="report_date"\r\n\r\n2026-09-21\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="report_time"\r\n\r\n23:10:00\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reporter_name"\r\n\r\nRahul Patil\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reporter_email"\r\n\r\nrahul.patil.citizen@gmail.com\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reporter_contact"\r\n\r\n9876543210\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="recommended_action"\r\n\r\nDispatch emergency ambulance with splint.\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="report_source"\r\n\r\nMANUAL\r\n`)
];

if (imageBuffer.length > 0) {
  parts.push(
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="injured-dog.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    imageBuffer,
    Buffer.from('\r\n')
  );
}

parts.push(Buffer.from(`--${boundary}--\r\n`));
const body = Buffer.concat(parts);

console.log('[TestScript] Submitting manual report with image upload...');
const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/reports',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': body.length
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    try {
      console.log('Response Body:', JSON.parse(data));
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', err => console.error('Error:', err.message));
req.write(body);
req.end();
