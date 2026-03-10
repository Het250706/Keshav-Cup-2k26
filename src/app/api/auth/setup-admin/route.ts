import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/admin';

export async function GET() {
    try {
        const email = 'admin@keshav.com';
        const password = 'het@2576';

        // 1. Try to create the admin user
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role: 'ADMIN' }
        });

        if (error) {
            // If user already exists, update them to ensure password and role are correct
            if (error.message.toLowerCase().includes('already registered')) {
                const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
                const existingUser = userData?.users?.find((u: any) => u.email === email);

                if (existingUser) {
                    await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
                        password,
                        email_confirm: true,
                        user_metadata: { role: 'ADMIN' }
                    });

                    // Sync role in database
                    const { error: dbError } = await supabaseAdmin
                        .from('user_roles')
                        .upsert({ user_id: existingUser.id, role: 'admin' }, { onConflict: 'user_id' });

                    if (dbError) throw dbError;

                    return NextResponse.json({ success: true, message: 'Admin account updated and synced', role: 'admin' });
                }
            }
            throw error;
        }

        // For new user
        if (data.user) {
            const { error: dbError } = await supabaseAdmin
                .from('user_roles')
                .insert({ user_id: data.user.id, role: 'admin' });

            if (dbError) throw dbError;
        }

        return NextResponse.json({ success: true, message: 'Admin account created successfully', role: 'admin' });
    } catch (err: any) {
        console.error('Setup Admin Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
