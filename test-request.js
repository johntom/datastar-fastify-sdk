/**
 * Test client for the test server
 * Tests various event types to ensure they work correctly
 */

'use strict';

async function testServer() {
  const baseUrl = 'http://127.0.0.1:7331';

  // Test 1: PatchElements
  console.log('\n=== Test 1: PatchElements ===');
  const test1 = {
    events: [
      {
        type: 'patchElements',
        elements: '<div id="test">Hello World</div>',
        selector: '#container',
        mode: 'inner',
        useViewTransition: false
      }
    ]
  };

  try {
    const response1 = await fetch(`${baseUrl}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'datastar-request': 'true'
      },
      body: JSON.stringify(test1)
    });

    console.log('Status:', response1.status);
    console.log('Headers:', Object.fromEntries(response1.headers.entries()));

    const reader = response1.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    console.log('Response:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 2: PatchSignals
  console.log('\n=== Test 2: PatchSignals ===');
  const test2 = {
    events: [
      {
        type: 'patchSignals',
        signals: { count: 42, message: 'Test message' },
        onlyIfMissing: false
      }
    ]
  };

  try {
    const response2 = await fetch(`${baseUrl}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'datastar-request': 'true'
      },
      body: JSON.stringify(test2)
    });

    console.log('Status:', response2.status);

    const reader = response2.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    console.log('Response:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 3: ExecuteScript
  console.log('\n=== Test 3: ExecuteScript ===');
  const test3 = {
    events: [
      {
        type: 'executeScript',
        script: 'console.log("Hello from server");',
        autoRemove: true,
        attributes: { type: 'module', blocking: 'render' }
      }
    ]
  };

  try {
    const response3 = await fetch(`${baseUrl}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'datastar-request': 'true'
      },
      body: JSON.stringify(test3)
    });

    console.log('Status:', response3.status);

    const reader = response3.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    console.log('Response:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 4: Multiple events
  console.log('\n=== Test 4: Multiple Events ===');
  const test4 = {
    events: [
      {
        type: 'patchSignals',
        signals: { step: 1 }
      },
      {
        type: 'patchElements',
        elements: '<p>Step 1 complete</p>',
        selector: '#status',
        mode: 'append'
      },
      {
        type: 'executeScript',
        script: 'console.log("All steps complete");'
      }
    ]
  };

  try {
    const response4 = await fetch(`${baseUrl}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'datastar-request': 'true'
      },
      body: JSON.stringify(test4)
    });

    console.log('Status:', response4.status);

    const reader = response4.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    console.log('Response:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n=== All tests completed ===\n');
}

testServer().catch(console.error);
