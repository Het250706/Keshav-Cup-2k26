/**
 * KESHAV CUP - Enterprise Authentication Module
 * Secure authentication with role-based access control
 */

import { supabase } from './supabase';
import { ADMIN_PASSWORD, CAPTAIN_PASSWORD } from '@/types';

// ============================================================================
// ADMIN AUTHENTICATION
// ============================================================================

/**
 * Admin login with email and password validation
 * Password: 87654321
 */
export async function loginAdmin(email: string, password: string) {
    try {
        // Validate password
        if (password !== ADMIN_PASSWORD) {
            return {
                error: { message: 'Invalid admin credentials. Access denied.' }
            };
        }

        // Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: ADMIN_PASSWORD,
        });

        if (error) {
            return { error: { message: 'Authentication failed. Invalid email.' } };
        }

        // Verify admin role in database
        const { data: adminData, error: adminError } = await supabase
            .from('admins')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (adminError || !adminData) {
            // Not an admin - sign out immediately
            await supabase.auth.signOut();
            return {
                error: { message: 'Unauthorized. Admin access required.' }
            };
        }

        return { data, error: null };
    } catch (err) {
        return {
            error: { message: 'System error. Please contact administrator.' }
        };
    }
}

// ============================================================================
// CAPTAIN AUTHENTICATION
// ============================================================================

/**
 * Captain login with team name, email, and password validation
 * Password: 12345678
 */
export async function loginCaptain(
    teamName: string,
    captainEmail: string,
    password: string
) {
    try {
        // Validate password
        if (password !== CAPTAIN_PASSWORD) {
            return {
                error: { message: 'Invalid password. Access denied.' }
            };
        }

        // Verify team and captain email match
        const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('*')
            .eq('team_name', teamName)
            .eq('captain_email', captainEmail)
            .single();

        if (teamError || !teamData) {
            return {
                error: { message: 'Invalid team or captain email combination.' }
            };
        }

        // Authenticate with Supabase using team ID as user ID
        // In production, you'd create actual user accounts
        // For this implementation, we'll use a mock authentication
        const mockEmail = `${teamName.toLowerCase().replace(/\s/g, '')}@keshav.com`;

        const { data, error } = await supabase.auth.signInWithPassword({
            email: mockEmail,
            password: CAPTAIN_PASSWORD,
        });

        if (error) {
            // If user doesn't exist, create them
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: mockEmail,
                password: CAPTAIN_PASSWORD,
            });

            if (signUpError) {
                return { error: { message: 'Authentication system error.' } };
            }

            return { data: signUpData, error: null };
        }

        return { data, error: null };
    } catch (err) {
        return {
            error: { message: 'System error. Please contact administrator.' }
        };
    }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
}

/**
 * Get current session
 */
export async function getCurrentSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
}

/**
 * Sign out current user
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('admins')
        .select('id')
        .eq('id', userId)
        .single();

    return !error && !!data;
}

/**
 * Check if user is captain
 */
export async function isCaptain(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('teams')
        .select('id')
        .eq('id', userId)
        .single();

    return !error && !!data;
}

/**
 * Get user role
 */
export async function getUserRole(userId: string): Promise<'ADMIN' | 'CAPTAIN' | null> {
    if (await isAdmin(userId)) return 'ADMIN';
    if (await isCaptain(userId)) return 'CAPTAIN';
    return null;
}
