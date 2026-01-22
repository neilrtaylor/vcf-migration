/**
 * Local test script for the pricing proxy server
 *
 * Usage:
 *   # Start the server first in another terminal:
 *   npm start
 *
 *   # Then run tests:
 *   node test.js
 *
 *   # Or with a custom port:
 *   PORT=3000 node test.js
 */

const PORT = process.env.PORT || 8080;
const BASE_URL = `http://localhost:${PORT}`;

async function test() {
  console.log('Testing pricing proxy server...');
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    // Test 1: Health check
    console.log('Test 1: Health check');
    console.log('====================');

    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log('Status:', healthRes.status);
    console.log('Response:', JSON.stringify(healthData));
    console.log('');

    // Test 2: Get pricing data
    console.log('Test 2: Get pricing data');
    console.log('========================');

    const pricingRes = await fetch(BASE_URL);
    const pricingData = await pricingRes.json();
    console.log('Status:', pricingRes.status);
    console.log('Cached:', pricingData.cached);
    console.log('Source:', pricingData.source);
    console.log('VSI Profiles:', Object.keys(pricingData.vsiProfiles || {}).length);
    console.log('Regions:', Object.keys(pricingData.regions || {}).length);
    console.log('');

    // Test 3: Cache behavior (second request)
    console.log('Test 3: Cache behavior');
    console.log('======================');

    const cacheRes = await fetch(BASE_URL);
    const cacheData = await cacheRes.json();
    console.log('Second call - Cached:', cacheData.cached);
    console.log('Cache Age:', cacheData.cacheAge, 'seconds');
    console.log('');

    // Test 4: Force refresh
    console.log('Test 4: Force refresh');
    console.log('=====================');

    const refreshRes = await fetch(`${BASE_URL}?refresh=true`);
    const refreshData = await refreshRes.json();
    console.log('With refresh=true - Cached:', refreshData.cached);
    console.log('');

    // Test 5: CORS headers
    console.log('Test 5: CORS headers');
    console.log('====================');

    const corsRes = await fetch(BASE_URL, { method: 'OPTIONS' });
    console.log('Status:', corsRes.status);
    console.log(
      'Access-Control-Allow-Origin:',
      corsRes.headers.get('Access-Control-Allow-Origin')
    );
    console.log('');

    // Output sample pricing data
    console.log('Sample Pricing Data');
    console.log('===================');
    console.log(
      'cx2-2x4 hourly rate:',
      pricingData.vsiProfiles?.['cx2-2x4']?.hourlyRate
    );
    console.log(
      'Storage cost/GB:',
      pricingData.blockStorage?.generalPurpose?.costPerGBMonth
    );
    console.log(
      'Load Balancer/mo:',
      pricingData.networking?.loadBalancer?.perLBMonthly
    );
    console.log('');

    console.log('All tests completed successfully!');
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') {
      console.error('Error: Server is not running.');
      console.error(`Please start the server first with: npm start`);
      console.error(`Then run tests in another terminal.`);
    } else {
      console.error('Test failed:', error.message);
    }
    process.exit(1);
  }
}

test();
