import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendOtpEmail } from '@/lib/sendEmail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store OTP in database
    const { error: dbError } = await supabase
      .from('reset_otps')
      .insert({
        email,
        otp_code: otp,
        expires_at: expiresAt,
        used: false,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: `Failed to generate OTP: ${dbError.message}` }, { status: 500 });
    }

    // Send OTP via email
    console.log('=== OTP GENERATED ===');
    console.log('Email:', email);
    console.log('OTP Code:', otp);
    console.log('Expires:', expiresAt);
    console.log('====================');
    
    const emailResult = await sendOtpEmail(email, otp);

    if (!emailResult.success) {
      console.error('Email failed, but OTP is stored. Check logs above for OTP code.');
      // Still return success since OTP is stored in DB
      return NextResponse.json({ success: true, message: 'OTP generated (check server logs)' });
    }

    return NextResponse.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
