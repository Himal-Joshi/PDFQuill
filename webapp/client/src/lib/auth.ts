/**
 * Client-side authentication utilities for PDFQuill.
 *
 * Since the app is hosted statically on GitHub Pages, there is no backend.
 * Accounts are stored in localStorage with SHA-256 hashed passwords.
 * This is NOT production-grade security — it is a demonstration of
 * proper validation logic and flow for a static-hosted app.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoredAccount {
  email: string;
  /** SHA-256 hex digest of the password */
  passwordHash: string;
  createdAt: number;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  token?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Allowed email domains
// ---------------------------------------------------------------------------

const ALLOWED_DOMAINS: string[] = [
  // Google
  'gmail.com',
  'googlemail.com',
  // Yahoo
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'ymail.com',
  // Microsoft / Outlook
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  // Proton
  'proton.me',
  'protonmail.com',
  'pm.me',
  // iCloud / Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // AOL
  'aol.com',
  // Zoho
  'zoho.com',
  // Mail.com
  'mail.com',
  'email.com',
  // GMX
  'gmx.com',
  'gmx.net',
  // Yandex
  'yandex.com',
  // Fastmail
  'fastmail.com',
  'fastmail.fm',
];

/**
 * Educational domain suffixes that are always allowed.
 * Any domain ending with one of these is accepted.
 */
const ALLOWED_EDU_SUFFIXES: string[] = [
  '.edu',
  '.edu.np',
  '.edu.au',
  '.edu.in',
  '.edu.pk',
  '.edu.bd',
  '.edu.lk',
  '.edu.cn',
  '.edu.uk',
  '.edu.br',
  '.ac.uk',
  '.ac.in',
  '.ac.jp',
  '.ac.kr',
  '.ac.nz',
];

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const ACCOUNTS_KEY = 'pdfquill_accounts';

function getAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredAccount[];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: StoredAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validateEmailDomain(email: string): { valid: boolean; error?: string } {
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[1]) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  const domain = parts[1].toLowerCase();

  // Check exact match
  if (ALLOWED_DOMAINS.includes(domain)) {
    return { valid: true };
  }

  // Check educational suffixes
  for (const suffix of ALLOWED_EDU_SUFFIXES) {
    if (domain.endsWith(suffix)) {
      return { valid: true };
    }
  }

  return {
    valid: false,
    error: `Email domain "@${domain}" is not supported. Please use a recognized provider like Gmail, Yahoo, Outlook, ProtonMail, or an educational (.edu) email.`,
  };
}

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('At least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('At least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('At least one number');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    errors.push('At least one special character');
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Auth actions
// ---------------------------------------------------------------------------

export async function registerAccount(email: string, password: string): Promise<AuthResult> {
  // Validate email domain
  const domainCheck = validateEmailDomain(email);
  if (!domainCheck.valid) {
    return { success: false, error: domainCheck.error };
  }

  // Validate password strength
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) {
    return { success: false, error: `Password requirements not met: ${pwCheck.errors.join(', ')}.` };
  }

  // Check if account already exists
  const accounts = getAccounts();
  const existing = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
  }

  // Hash password and store
  const passwordHash = await hashPassword(password);
  const newAccount: StoredAccount = {
    email: email.toLowerCase(),
    passwordHash,
    createdAt: Date.now(),
  };

  accounts.push(newAccount);
  saveAccounts(accounts);

  // Generate token
  const token = generateToken(email);

  return { success: true, token, email: email.toLowerCase() };
}

export async function loginAccount(email: string, password: string): Promise<AuthResult> {
  const accounts = getAccounts();
  const account = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());

  if (!account) {
    return { success: false, error: 'No account found with this email. Please sign up first.' };
  }

  const passwordHash = await hashPassword(password);
  if (passwordHash !== account.passwordHash) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  const token = generateToken(email);
  return { success: true, token, email: account.email };
}

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

function generateToken(email: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: email.toLowerCase(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    }),
  );
  // In a real app this signature would be produced by a server with a secret key.
  const signature = btoa(
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  );
  return `${header}.${payload}.${signature}`;
}
