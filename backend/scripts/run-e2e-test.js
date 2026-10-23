const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function runFullTest() {
    console.log('====================================================');
    console.log('🚀 COMPREHENSIVE END-TO-END PROJECT VERIFICATION');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log('  ✅ [PASS]', message);
            passed++;
        } else {
            console.error('  ❌ [FAIL]', message);
            failed++;
        }
    }

    // ----------------------------------------------------
    // TEST 1: SERVER & STATIC FILES INTEGRITY
    // ----------------------------------------------------
    console.log('[1/4] Testing Server & Static Assets...');
    try {
        const rootRes = await axios.get(BASE_URL + '/');
        assert(rootRes.status === 200, 'GET / API Root responds with 200 OK');
        assert(rootRes.data.status === 'API Server Running', 'API status is active');

        const indexRes = await axios.get(BASE_URL + '/index.html');
        assert(indexRes.status === 200 && indexRes.data.includes('Injured Animal Detection'), 'GET /index.html served');

        const scriptRes = await axios.get(BASE_URL + '/script.js');
        assert(scriptRes.status === 200 && scriptRes.data.includes('loadPastReports'), 'GET /script.js served');

        const styleRes = await axios.get(BASE_URL + '/style.css');
        assert(styleRes.status === 200 && styleRes.data.includes('.past-report-card'), 'GET /style.css served');

        const manualHtmlRes = await axios.get(BASE_URL + '/manual-report/manual-report.html');
        assert(manualHtmlRes.status === 200 && manualHtmlRes.data.includes('animalReportForm'), 'GET /manual-report/manual-report.html served');

        const autoHtmlRes = await axios.get(BASE_URL + '/automatic-module/automatic_module.html');
        assert(autoHtmlRes.status === 200 && autoHtmlRes.data.includes('video'), 'GET /automatic-module/automatic_module.html served');
    } catch (e) {
        assert(false, 'Static asset test failed: ' + e.message);
    }

    // ----------------------------------------------------
    // TEST 2: MANUAL REPORT MODULE
    // ----------------------------------------------------
    console.log('\n[2/4] Testing Manual Report Module...');
    let manualReportCode = null;
    try {
        const payload = {
            animal_type: 'Dog',
            breed: 'Indie Stray',
            injury_type: 'Puncture wound on foreleg',
            severity: 'Moderate',
            description: 'Stray dog with puncture wound resting near grocery store.',
            location: 'Shivaji Chowk Market',
            latitude: 19.5760,
            longitude: 74.2070,
            reporter_name: 'Akash Citizen',
            reporter_contact: '+919876543210',
            reporter_email: 'akash@example.com'
        };

        const res = await axios.post(BASE_URL + '/api/reports', payload);
        assert(res.status === 201, 'POST /api/reports created manual report with 201 Created');
        assert(res.data.success === true, 'Response indicates success: true');
        assert(res.data.report && res.data.report.report_code, 'Generated report code: ' + res.data.report.report_code);
        assert(res.data.report.report_source === 'MANUAL', 'Report source is MANUAL');
        manualReportCode = res.data.report.report_code;

        // Validation test
        try {
            await axios.post(BASE_URL + '/api/reports', { description: 'Missing animal type' });
            assert(false, 'Validation failed: accepted report without animal type');
        } catch (valErr) {
            assert(valErr.response && valErr.response.status === 400, 'Validation properly rejects missing animal_type with 400 Bad Request');
        }
    } catch (e) {
        assert(false, 'Manual report test failed: ' + e.message);
    }

    // ----------------------------------------------------
    // TEST 3: AUTOMATIC DETECTION MODULE
    // ----------------------------------------------------
    console.log('\n[3/4] Testing Automatic Module Endpoints & AI Analysis...');
    try {
        const statusRes = await axios.get(BASE_URL + '/api/detection/status');
        assert(statusRes.status === 200, 'GET /api/detection/status responds with 200 OK');
        assert(statusRes.data.success === true, 'Detection status is active');

        // POST analyze endpoint expects multipart/form-data file upload (as used by automatic module)
        const FormData = require('form-data');
        const fs = require('fs');
        const path = require('path');

        // Use the first real uploaded image in the uploads folder, or create a tiny valid JPEG buffer
        const uploadsDir = path.join(__dirname, '../uploads');
        const uploadedFiles = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.jpg'));

        const form = new FormData();
        if (uploadedFiles.length > 0) {
            form.append('image', fs.createReadStream(path.join(uploadsDir, uploadedFiles[0])), {
                filename: uploadedFiles[0],
                contentType: 'image/jpeg'
            });
        } else {
            // Minimal valid 1x1 JPEG
            const tinyJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=', 'base64');
            form.append('image', tinyJpeg, { filename: 'test-frame.jpg', contentType: 'image/jpeg' });
        }
        form.append('camera_id', 'CAM-001');
        form.append('location', 'Test Location');

        const analyzeRes = await axios.post(BASE_URL + '/api/detection/analyze', form, {
            headers: form.getHeaders()
        });
        assert(analyzeRes.status === 200, 'POST /api/detection/analyze responds with 200 OK');
        assert(analyzeRes.data.success === true, 'AI analysis returned structured output');
        const det = analyzeRes.data.analysis || analyzeRes.data.detection;
        assert(det !== undefined, 'Contains analysis result object');
        assert(typeof det.animal_detected !== 'undefined' || typeof det.animalDetected !== 'undefined', 'animal_detected field present in result');
    } catch (e) {
        assert(false, 'Automatic module test failed: ' + e.message);
    }

    // ----------------------------------------------------
    // TEST 4: PAST REPORTS & STATISTICS MODULE
    // ----------------------------------------------------
    console.log('\n[4/4] Testing Past Reports, Pagination & Statistics...');
    try {
        const statsRes = await axios.get(BASE_URL + '/api/reports/statistics');
        assert(statsRes.status === 200, 'GET /api/reports/statistics responds with 200 OK');
        const stats = statsRes.data.data;
        assert(typeof stats.total_reports === 'number' && stats.total_reports > 0, 'Total reports is: ' + stats.total_reports);
        assert(stats.total_reports === stats.manual_reports + stats.automatic_reports, 'Mathematical consistency: total == manual + automatic');

        // Test 15 Limit Pagination
        const pagedRes = await axios.get(BASE_URL + '/api/reports?limit=15&offset=0');
        assert(pagedRes.status === 200, 'GET /api/reports?limit=15 responds with 200 OK');
        assert(Array.isArray(pagedRes.data.data), 'Reports payload is an array');
        assert(pagedRes.data.data.length <= 15, 'Returns top 15 reports (count: ' + pagedRes.data.data.length + ')');
        assert(pagedRes.data.pagination && pagedRes.data.pagination.limit === 15, 'Pagination metadata confirmed');

        // Test Filters
        const manualOnlyRes = await axios.get(BASE_URL + '/api/reports?source=MANUAL');
        assert(manualOnlyRes.data.data.every(r => r.report_source === 'MANUAL'), 'Filter source=MANUAL returns strictly manual reports');

        const autoOnlyRes = await axios.get(BASE_URL + '/api/reports?source=AUTOMATIC');
        assert(autoOnlyRes.data.data.every(r => r.report_source === 'AUTOMATIC'), 'Filter source=AUTOMATIC returns strictly automatic reports');

        // Test Single Report by Code
        if (manualReportCode) {
            const singleRes = await axios.get(BASE_URL + '/api/reports/' + manualReportCode);
            assert(singleRes.status === 200, 'GET /api/reports/' + manualReportCode + ' returns 200 OK');
            assert(singleRes.data.report.report_code === manualReportCode, 'Fetched report code matches');
            assert(Array.isArray(singleRes.data.report.rescue_contacts), 'Attached rescue contacts for dispatch');
        }
    } catch (e) {
        assert(false, 'Past reports test failed: ' + e.message);
    }

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`🏁 FINAL VERIFICATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================');
    
    if (failed === 0) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runFullTest().catch(console.error);
