import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    // Force session-only cookies by removing maxAge and expires
                    // This ensures the session is NOT persisted after browser close
                    const sessionOptions = { ...options }
                    delete sessionOptions.maxAge
                    delete sessionOptions.expires

                    request.cookies.set({
                        name,
                        value,
                        ...sessionOptions,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...sessionOptions,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const url = request.nextUrl.clone()
    const pathname = url.pathname

    // 1. Root path logic
    if (pathname === '/') {
        if (user) {
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .single()

            const role = roleData?.role?.toLowerCase()
            if (role === 'admin') return NextResponse.redirect(new URL('/admin/dashboard', request.url))
            if (role === 'captain') return NextResponse.redirect(new URL('/captain/dashboard', request.url))
        }
        return response
    }

    // 2. Protect Admin Routes
    if (pathname === '/admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }

    if (pathname.startsWith('/admin')) {
        // Allow the login page even if authenticated as a captain
        if (pathname === '/admin/login') {
            if (user) {
                const { data: roleData } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', user.id)
                    .single()

                if (roleData?.role?.toLowerCase() === 'admin') {
                    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
                }
            }
            return response
        }

        if (!user) {
            return NextResponse.redirect(new URL('/admin/login', request.url))
        }

        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        const role = roleData?.role?.toLowerCase()
        if (role !== 'admin') {
            // If they are a captain in the admin area, send them to their dashboard
            if (role === 'captain') return NextResponse.redirect(new URL('/captain/dashboard', request.url))
            // Only redirect to login if no recognized role
            return NextResponse.redirect(new URL('/admin/login', request.url))
        }
    }

    // 3. Protect Captain Routes
    if (pathname.startsWith('/captain')) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        const role = roleData?.role?.toLowerCase()
        if (role !== 'captain' && role !== 'admin') {
            // ADMINS can access captain routes for monitoring, but captains cannot access admin
            return NextResponse.redirect(new URL('/login', request.url))
        }
    }

    // 4. Protect Login Pages from their own roles
    if (pathname === '/login' && user) {
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        if (roleData?.role?.toLowerCase() === 'captain') {
            return NextResponse.redirect(new URL('/captain/dashboard', request.url))
        }
    }

    return response
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}
