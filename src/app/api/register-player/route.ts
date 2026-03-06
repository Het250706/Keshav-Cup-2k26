import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Mapping common registration fields to existing schema
        const {
            first_name,
            last_name,
            email,
            phone,
            age,
            role,
            category = 'Silver',
            base_price,
            batting_style,
            bowling_style,
            experience,
            photo_url,
            team_preference
        } = body;

        if (!first_name || !last_name || !email) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Insert into Database with pending status so it appears in pool
        const { data: playerData, error: dbError } = await supabase
            .from('players')
            .insert([{
                first_name,
                last_name,
                email,
                phone: phone || '',
                age: Number(age) || 20,
                role: role || 'Batsman',
                category: category || 'Silver',
                base_price: Number(base_price) || 20000000,
                batting_style: batting_style || 'Right Handed',
                bowling_style: bowling_style || 'Right Arm',
                photo_url: photo_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${first_name}`,
                city: team_preference || 'None', // Overloading city or using as separate field
                status: 'pending',
                auction_status: 'pending'
            }])
            .select()
            .maybeSingle();

        if (dbError) {
            console.error('Registration DB Error:', dbError);
            return NextResponse.json({ success: false, error: dbError.message || 'Database insert failed' }, { status: 500 });
        }

        return NextResponse.json({ success: true, player: playerData });

    } catch (error: any) {
        console.error('Registration API Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
