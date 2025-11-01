import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_SECRET_KEY = "s3dfgERGfdKIhgn234%454$5"; // Match the hardcoded key from WhatsApp agent

export function verifyApiKey(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  console.log('Auth header:', authHeader); // Debug log
  
  if (!authHeader) {
    return NextResponse.json(
      { error: 'Missing authorization header' },
      { status: 401 }
    );
  }

  // Remove 'Bearer ' prefix if it exists and trim any whitespace
  const providedKey = authHeader.replace('Bearer ', '').trim();
  console.log('Provided key:', providedKey); // Debug log
  console.log('Expected key:', API_SECRET_KEY); // Debug log
  
  if (providedKey !== API_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    );
  }

  return null; // Return null if verification passes
} 