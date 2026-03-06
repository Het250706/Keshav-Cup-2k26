import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

const DEFAULTS = [
    { team_name: 'SHAURYAM', email: 'shauryam@keshav.com' },
    { team_name: 'DIVYAM', email: 'divyam@keshav.com' },
    { team_name: 'SATYAM', email: 'satyam@keshav.com' },
    { team_name: 'DASHATVAM', email: 'dashatvam@keshav.com' },
    { team_name: 'DHAIRYAM', email: 'dhairyam@keshav.com' },
    { team_name: 'GYANAM', email: 'gyanam@keshav.com' },
    { team_name: 'AISHWARYAM', email: 'aishwaryam@keshav.com' },
    { team_name: 'ASTIKAYAM', email: 'astikayam@keshav.com' },
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
                user_metadata: { role: 'CAPTAIN', team_name: team.team_name }
            });

            if (authError) {
                if (authError.message.includes('already registered')) {
                    authStatus = 'existing_auth';
                } else {
                    results.push({ team: team.team_name, status: 'error', message: `Auth: ${authError.message}` });
                    continue;
                }
            }

            // 2. Insert into Teams table
            const { error: dbError } = await supabaseAdmin.from('teams').upsert({
                team_name: team.team_name,
                captain_email: team.email,
                captain_name: `Captain ${team.team_name}`,
                purse_remaining: 1000000000 // 100 Cr
            }, { onConflict: 'team_name' });

            if (dbError) {
                results.push({ team: team.team_name, status: 'error', message: `DB: ${dbError.message}` });
            } else {
                results.push({
                    team: team.team_name,
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
