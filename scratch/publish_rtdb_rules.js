import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';

async function publishRules() {
  try {
    const rulesPath = 'c:/CODING/Projects/BrainSync/database.rules.json';
    const keyPath = 'c:/CODING/Projects/BrainSync/fFIREBASE_PRIVATE KEY.json';

    const rulesContent = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

    console.log(`🔐 Authenticating Service Account: ${serviceAccount.client_email}...`);

    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: [
        'https://www.googleapis.com/auth/firebase.database',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    });

    const tokens = await client.getAccessToken();
    console.log('✅ Access Token acquired successfully!');

    const dbUrl = 'https://brainsync-07-default-rtdb.asia-southeast1.firebasedatabase.app/.settings/rules.json';
    
    console.log(`🚀 Publishing optimized security rules to RTDB: ${dbUrl}...`);

    const response = await fetch(`${dbUrl}?access_token=${tokens.token}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rulesContent),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('🎉 [SUCCESS] Database Security Rules Published Successfully!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      const errText = await response.text();
      console.error('❌ Failed to publish rules. Status:', response.status, errText);
    }
  } catch (error) {
    console.error('💥 Error publishing rules:', error.message);
  }
}

publishRules();
