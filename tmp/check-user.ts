import { supabaseAdmin } from '../src/lib/admin';

async function checkUser() {
    console.log('Checking for user: divyam@keshav.com');
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
        console.error('Error listing users:', error);
        return;
    }

    const user = users.find(u => u.email === 'divyam@keshav.com');
    if (user) {
        console.log('User found:', {
            id: user.id,
            email: user.email,
            metadata: user.user_metadata
        });
    } else {
        console.log('User NOT found.');
        console.log('Total users:', users.length);
    }
}

checkUser();
