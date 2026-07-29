'use strict';

const SUPABASE_URL = 'https://rhstnoegynxqaveqnbju.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bSqzZAZgyo8iNNcH2jeggQ_luXGlgDs';

let _supabase = null;
let _eventBus = null;

function initSupabase() {
    try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('[Auth] Supabase client initialized');
        } else {
            console.warn('[Auth] Supabase SDK not loaded');
        }
    } catch (err) {
        console.error('[Auth] Failed to initialize Supabase client:', err);
        _supabase = null;
    }
}

export function initAuth(eventBus) {
    _eventBus = eventBus;
    initSupabase();
    return checkUserSession();
}

export async function checkUserSession() {
    try {
        if (!_supabase) {
            showAuthModal();
            document.getElementById('app')?.classList.add('auth-blur');
            return null;
        }
        const { data, error } = await _supabase.auth.getSession();
        if (error) {
            console.error('[Auth] Session check failed:', error.message);
            showAuthModal();
            document.getElementById('app')?.classList.add('auth-blur');
            return null;
        }
        if (data?.session) {
            window.__tarteeb.user = {
                id: data.session.user.id,
                email: data.session.user.email,
                isPremium: false,
            };
            closeAuthModal();
            document.getElementById('app')?.classList.remove('auth-blur');
            localStorage.setItem('tarteeb_session_active', 'true');
            console.log('[Auth] Session found:', data.session.user.email);
            return data.session;
        }
        showAuthModal();
        document.getElementById('app')?.classList.add('auth-blur');
        return null;
    } catch (err) {
        console.error('[Auth] checkUserSession error:', err);
        showAuthModal();
        document.getElementById('app')?.classList.add('auth-blur');
        return null;
    }
}

export async function handleSignUp(email, password) {
    try {
        if (!_supabase) throw new Error('Supabase client not initialized');
        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) {
            console.error('[Auth] Sign up error:', error.message);
            alert(error.message);
            return;
        }
        console.log('[Auth] Sign up success:', data);
        alert('Check your email for confirmation');
        if (data.session) {
            window.__tarteeb.user = {
                id: data.user.id,
                email: data.user.email,
                isPremium: false,
            };
            closeAuthModal();
            document.getElementById('app')?.classList.remove('auth-blur');
        }
    } catch (err) {
        console.error('[Auth] Sign up exception:', err);
        alert(err.message || 'Sign up failed');
    }
}

export async function handleLogin(email, password) {
    try {
        if (!_supabase) throw new Error('Supabase client not initialized');
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) {
            console.error('[Auth] Login error:', error.message);
            alert(error.message);
            return;
        }
        console.log('[Auth] Login success:', data.user.email);
        localStorage.setItem('tarteeb_session_active', 'true');
        window.__tarteeb.user = {
            id: data.user.id,
            email: data.user.email,
            isPremium: false,
        };
        closeAuthModal();
        document.getElementById('app')?.classList.remove('auth-blur');
    } catch (err) {
        console.error('[Auth] Login exception:', err);
        alert(err.message || 'Login failed');
    }
}

export function showAuthModal() {
    closeAuthModal();

    const portal = document.getElementById('modal-portal');
    if (!portal) return;

    const overlay = document.createElement('div');
    overlay.id = 'auth-modal';
    overlay.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4';
    overlay.style.pointerEvents = 'auto';

    const backdrop = document.createElement('div');
    backdrop.className = 'absolute inset-0 bg-black/60 backdrop-blur-md animate-entrance';

    const card = document.createElement('div');
    card.className = [
        'relative bg-surface-raised rounded-2xl shadow-modal w-full max-w-sm',
        'border border-white/[0.06] p-6',
        'animate-entrance',
    ].join(' ');

    card.innerHTML =
        '<div class="text-center mb-6">' +
            '<div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-accent-finance via-accent-knowledge to-accent-goals flex items-center justify-center shadow-[0_0_24px_rgba(96,165,250,0.2)] mb-4">' +
                '<span class="text-white font-heading font-bold text-xl select-none">T</span>' +
            '</div>' +
            '<h1 class="text-xl font-heading font-semibold text-text-primary">Welcome to Tarteeb</h1>' +
            '<p class="text-[13px] text-text-secondary mt-1">Sign in or create an account</p>' +
        '</div>' +
        '<div class="space-y-3 mb-4">' +
            '<input id="auth-email" type="email" placeholder="Email" autocomplete="email" ' +
                   'class="w-full px-4 py-2.5 rounded-xl text-[14px] font-body text-text-primary bg-surface-elevated border border-white/[0.06] placeholder:text-text-disabled outline-none focus:border-accent-finance/40 focus:bg-surface-floating transition-all duration-200">' +
            '<input id="auth-password" type="password" placeholder="Password" autocomplete="current-password" ' +
                   'class="w-full px-4 py-2.5 rounded-xl text-[14px] font-body text-text-primary bg-surface-elevated border border-white/[0.06] placeholder:text-text-disabled outline-none focus:border-accent-finance/40 focus:bg-surface-floating transition-all duration-200">' +
        '</div>' +
        '<div class="flex flex-col gap-2">' +
            '<button id="auth-login-btn" ' +
                    'class="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white bg-accent-finance hover:brightness-110 transition-all shadow-[0_0_20px_rgba(96,165,250,0.15)]">' +
                'Login' +
            '</button>' +
            '<button id="auth-signup-btn" ' +
                    'class="w-full py-2.5 rounded-xl text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-colors border border-white/[0.06]">' +
                'Sign Up' +
            '</button>' +
        '</div>';

    overlay.appendChild(backdrop);
    overlay.appendChild(card);
    portal.appendChild(overlay);
    portal.style.pointerEvents = 'auto';

    _bindAuthEvents(card);
}

function closeAuthModal() {
    const existing = document.getElementById('auth-modal');
    if (existing) existing.remove();
    const portal = document.getElementById('modal-portal');
    if (portal) portal.style.pointerEvents = 'none';
}

function _bindAuthEvents(card) {
    const emailInput = card.querySelector('#auth-email');
    const passwordInput = card.querySelector('#auth-password');
    const loginBtn = card.querySelector('#auth-login-btn');
    const signupBtn = card.querySelector('#auth-signup-btn');

    loginBtn.addEventListener('click', async function () {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in…';
        await handleLogin(email, password);
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    });

    signupBtn.addEventListener('click', async function () {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }
        signupBtn.disabled = true;
        signupBtn.textContent = 'Signing up…';
        await handleSignUp(email, password);
        signupBtn.disabled = false;
        signupBtn.textContent = 'Sign Up';
    });

    function submitOnEnter(e) {
        if (e.key === 'Enter') loginBtn.click();
    }
    emailInput.addEventListener('keydown', submitOnEnter);
    passwordInput.addEventListener('keydown', submitOnEnter);
}

export async function logout() {
    try {
        if (_supabase) {
            await _supabase.auth.signOut();
        }
    } catch (err) {
        console.error('[Auth] Logout error:', err);
    }
    localStorage.removeItem('tarteeb_session_active');
    window.location.href = './index.html';
}
