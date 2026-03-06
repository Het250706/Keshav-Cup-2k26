import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email') || 'admin@keshav.com';
        const password = searchParams.get('password') || 'admin123';

        // 1. Create User in Auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role: 'ADMIN' }
        });

        if (authError && !authError.message.includes('already registered')) {
            throw authError;
        }

        return NextResponse.json({
            success: true,
            message: `Admin access granted for ${email}!`,
            credentials: { email, password }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
