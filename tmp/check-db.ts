import { supabaseAdmin } from '../src/lib/admin';

async function checkTeams() {
    const { data, error } = await supabaseAdmin.from('teams').select('*');
    if (error) {
        console.error('Error fetching teams:', error);
        return;
    }
    console.log('Teams in DB:', data);
}

checkTeams();
