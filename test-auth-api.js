#!/usr/bin/env node

// Simple test script for authentication API
const axios = require('axios');

const API_BASE_URL = process.env.URL_API || 'http://localhost:3001';

async function testAPI() {
  console.log('🧪 Testing Authentication API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check:', healthResponse.data);
    console.log();

    // Test user registration
    console.log('2. Testing user registration...');
    const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, {
      email: `test${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Test User'
    });
    console.log('✅ Registration successful:', registerResponse.data.user.email);
    const token = registerResponse.data.token;
    console.log();

    // Test user login
    console.log('3. Testing user login...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'testpassword123'
    });
    console.log('✅ Login successful:', loginResponse.data.user.email);
    console.log();

    // Test protected route
    console.log('4. Testing protected route (/users/me)...');
    const userResponse = await axios.get(`${API_BASE_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('✅ Protected route access successful:', userResponse.data.user.email);
    console.log();

    // Test user profile update
    console.log('5. Testing profile update...');
    const updateResponse = await axios.put(`${API_BASE_URL}/users/me`, {
      name: 'Updated Test User'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('✅ Profile update successful:', updateResponse.data.user.name);
    console.log();

    // Test logout
    console.log('6. Testing logout...');
    const logoutResponse = await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('✅ Logout successful:', logoutResponse.data.message);
    console.log();

    console.log('🎉 All tests passed! The authentication API is working correctly.');

  } catch (error) {
    if (error.response) {
      console.error('❌ Test failed:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ Network error:', error.message);
      console.log('💡 Make sure the Fastify server is running on port 3001');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  testAPI();
}

module.exports = { testAPI };