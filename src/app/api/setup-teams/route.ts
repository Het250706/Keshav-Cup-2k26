import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

const DEFAULTS = [
    { name: 'SHAURYAM', email: 'shauryam@keshav.com' },
    { name: 'DIVYAM', email: 'divyam@keshav.com' },
    { name: 'SATYAM', email: 'satyam@keshav.com' },
    { name: 'DASHATVAM', email: 'dashatvam@keshav.com' },
    { name: 'DHAIRYAM', email: 'dhairyam@keshav.com' },
    { name: 'GYANAM', email: 'gyanam@keshav.com' },
    { name: 'AISHWARYAM', email: 'aishwaryam@keshav.com' },
    { name: 'ASTIKAYAM', email: 'astikayam@keshav.com' },
];

export async function GET() {
    try {
        const results: any[] = [];
        const password = '12345678';

        for (const team of DEFAULTS) {
            let authStatus = 'created';

            // 1. Create User in Auth
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: team.email,
                password: password,
                email_confirm: true,
                user_metadata: { role: 'CAPTAIN', team_name: team.name }
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    authStatus = 'existing_auth';
                } else {
                    results.push({ team: team.name, status: 'error', message: `Auth: ${authError.message}` });
                    continue;
                }
            }

            // 2. Insert into Teams table
            const { error: dbError } = await supabaseAdmin.from('teams').upsert({
                name: team.name,
                captain_email: team.email,
                captain_name: `Captain ${team.name}`,
                remaining_budget: 5000
            }, { onConflict: 'name' });

            if (dbError) {
                results.push({
                    team: team.name,
                    status: 'success',
                    auth: authStatus === 'created' ? 'New Captain Created' : 'Existing Captain Verified'
                });
            }
        }

        return NextResponse.json({
            message: 'Setup complete',
            password_used: password,
            results
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
