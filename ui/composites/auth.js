'use strict';

const SUPABASE_URL = 'https://rhstnoegynxqaveqnbju.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bSqzZAZgyo8iNNcH2jeggQ_luXGlgDs';

let _supabase = null;
let _eventBus = null;
let _premiumCache = null;

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
            verifyPremiumStatus();
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

export async function handleSignUp(email, password, fullName) {
    try {
        if (!_supabase) throw new Error('Supabase client not initialized');
        const { data, error } = await _supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName || '',
                },
            },
        });
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
        verifyPremiumStatus();
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
            '<div class="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-md mx-auto mb-4">' +
                '<span class="select-none">T</span>' +
            '</div>' +
            '<h1 class="text-xl font-heading font-semibold text-text-primary">Welcome to Tarteeb</h1>' +
            '<p class="text-[13px] text-text-secondary mt-1">Sign in or create an account</p>' +
        '</div>' +
        '<div class="space-y-3 mb-4">' +
            '<input id="auth-fullname" type="text" placeholder="Full Name (For New Accounts)" autocomplete="name" hidden ' +
                   'class="w-full px-4 py-2.5 rounded-xl text-[14px] font-body text-text-primary bg-surface-elevated border border-white/[0.06] placeholder:text-text-disabled outline-none focus:border-accent-finance/40 focus:bg-surface-floating transition-all duration-200">' +
            '<input id="auth-email" type="email" placeholder="Email" autocomplete="email" ' +
                   'class="w-full px-4 py-2.5 rounded-xl text-[14px] font-body text-text-primary bg-surface-elevated border border-white/[0.06] placeholder:text-text-disabled outline-none focus:border-accent-finance/40 focus:bg-surface-floating transition-all duration-200">' +
            '<input id="auth-password" type="password" placeholder="Password" autocomplete="current-password" ' +
                   'class="w-full px-4 py-2.5 rounded-xl text-[14px] font-body text-text-primary bg-surface-elevated border border-white/[0.06] placeholder:text-text-disabled outline-none focus:border-accent-finance/40 focus:bg-surface-floating transition-all duration-200">' +
        '</div>' +
        '<div class="flex flex-col gap-2">' +
            '<button id="auth-login-btn" ' +
                    'class="auth-mode-btn w-full py-2.5 rounded-xl text-[13px] font-semibold text-white bg-accent-finance hover:brightness-110 transition-all shadow-[0_0_20px_rgba(96,165,250,0.15)]">' +
                'Login' +
            '</button>' +
            '<button id="auth-signup-btn" ' +
                    'class="auth-mode-btn w-full py-2.5 rounded-xl text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-colors border border-white/[0.06]">' +
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
    const fullnameInput = card.querySelector('#auth-fullname');
    const emailInput = card.querySelector('#auth-email');
    const passwordInput = card.querySelector('#auth-password');
    const loginBtn = card.querySelector('#auth-login-btn');
    const signupBtn = card.querySelector('#auth-signup-btn');
    const modeBtns = card.querySelectorAll('.auth-mode-btn');

    function setMode(mode) {
        var isSignup = mode === 'signup';
        fullnameInput.hidden = !isSignup;
        modeBtns.forEach(function (btn) {
            var isActive = (isSignup && btn.id === 'auth-signup-btn') || (!isSignup && btn.id === 'auth-login-btn');
            btn.className = 'auth-mode-btn w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all ' +
                (isActive
                    ? 'text-white bg-accent-finance hover:brightness-110 shadow-[0_0_20px_rgba(96,165,250,0.15)]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border border-white/[0.06] font-medium');
        });
    }

    loginBtn.addEventListener('click', async function () {
        setMode('login');
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
        setMode('signup');
        fullnameInput.focus();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const fullname = fullnameInput.value.trim();
        if (!fullname) {
            alert('Please enter your full name');
            fullnameInput.focus();
            return;
        }
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }
        signupBtn.disabled = true;
        signupBtn.textContent = 'Signing up…';
        await handleSignUp(email, password, fullname);
        signupBtn.disabled = false;
        signupBtn.textContent = 'Sign Up';
    });

    function submitOnEnter(e) {
        if (e.key === 'Enter') {
            if (!fullnameInput.hidden && fullnameInput === document.activeElement) {
                signupBtn.click();
            } else {
                loginBtn.click();
            }
        }
    }
    fullnameInput.addEventListener('keydown', submitOnEnter);
    emailInput.addEventListener('keydown', submitOnEnter);
    passwordInput.addEventListener('keydown', submitOnEnter);
}

export async function getCurrentSession() {
    try {
        if (!_supabase) return null;
        var { data, error } = await _supabase.auth.getSession();
        if (error || !data?.session) return null;
        return data.session;
    } catch (err) {
        console.error('[Auth] getCurrentSession error:', err);
        return null;
    }
}

export async function verifyPremiumStatus(forceRefresh = false) {
    if (!forceRefresh && _premiumCache !== null) {
        return _premiumCache;
    }
    try {
        var session = await getCurrentSession();
        if (!session) {
            _premiumCache = false;
            return false;
        }

        var { data, error } = await _supabase
            .from('profiles')
            .select('is_premium')
            .eq('id', session.user.id)
            .maybeSingle();

        if (error) {
            console.error('[Auth] verifyPremiumStatus query failed:', error.message);
            _premiumCache = false;
            return false;
        }

        if (!data) {
            console.warn('[Auth] No profile found, defaulting to free');
            _premiumCache = false;
            return false;
        }

        var isPremium = data.is_premium === true;
        _premiumCache = isPremium;

        if (window.__tarteeb?.user) {
            window.__tarteeb.user.isPremium = isPremium;
        }

        return isPremium;
    } catch (err) {
        console.error('[Auth] verifyPremiumStatus error:', err);
        _premiumCache = false;
        return false;
    }
}

export function getSupabase() {
    return _supabase;
}

export async function logout() {
    _premiumCache = null;
    try {
        if (_supabase) {
            await _supabase.auth.signOut();
        }
    } catch (err) {
        console.error('[Auth] Logout error:', err);
    }
    localStorage.removeItem('tarteeb_session_active');
    localStorage.removeItem('tarteeb_premium');
    window.location.href = './index.html';
}
