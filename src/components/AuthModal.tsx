import React, { useState } from 'react';
import { auth, db, googleProvider } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { X, Mail, Globe } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role?: string) => void;
  title: string;
  initialMode?: 'initial' | 'email-signup';
}

type AuthMode = 'initial' | 'email-login' | 'email-signup' | 'pin-setup' | 'pin-verify';

export default function AuthModal({ isOpen, onClose, onSuccess, title, initialMode = 'initial' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tempUser, setTempUser] = useState<User | null>(null);

  const fetchDocWithRetry = async (docRef: any, maxRetries = 5) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await getDocFromServer(docRef);
      } catch (err: any) {
        if (err.message && err.message.toLowerCase().includes('offline')) {
          if (i === maxRetries - 1) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw err;
        }
      }
    }
    throw new Error('Failed to get document because the client is offline.');
  };

  const handleSuccess = (role?: string) => {
    setMode('initial');
    setEmail('');
    setPassword('');
    setPin('');
    setConfirmPin('');
    setError('');
    setTempUser(null);
    onSuccess(role);
  };

  React.useEffect(() => {
    if (isOpen) {
      if (auth.currentUser) {
        const isGoogle = auth.currentUser.providerData.some(p => p.providerId === 'google.com');
        if (isGoogle) {
          setTempUser(auth.currentUser);
          setMode('pin-verify');
        } else {
          handleSuccess();
        }
      } else {
        setMode(initialMode);
      }
    }
  }, [isOpen, auth.currentUser, initialMode]);

  if (!isOpen) return null;

  const handleClose = async () => {
    // If they abort halfway through google auth, sign them out.
    if (tempUser || mode === 'pin-setup' || mode === 'pin-verify') {
      await signOut(auth).catch(() => {});
    }
    // Reset states
    setMode('initial');
    setEmail('');
    setPassword('');
    setPin('');
    setConfirmPin('');
    setError('');
    setTempUser(null);
    onClose();
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Admin Auto-seeding logic
      if (user.email === 'sudhir0135@gmail.com') {
        const adminDocRef = doc(db, 'users', user.uid);
        const adminDoc = await fetchDocWithRetry(adminDocRef);
        if (!adminDoc.exists()) {
          await setDoc(adminDocRef, {
            email: user.email,
            role: 'admin',
            pin: '100173',
            createdAt: new Date().toISOString()
          });
        }
      }

      // Check user doc
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await fetchDocWithRetry(docRef);

      if (docSnap.exists() && docSnap.data().status === 'inactive') {
        await auth.signOut();
        throw new Error('Your account is inactive. Please contact the administrator.');
      }

      if (docSnap.exists() && docSnap.data().pin) {
        setTempUser(user);
        setMode('pin-verify');
      } else {
        setTempUser(user);
        setMode('pin-setup');
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let userRole = 'FalseAttempter';
      if (mode === 'email-signup') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        // Handle pre-registered admin doc merging
        const { collection, query, where, getDocs, deleteDoc } = await import('firebase/firestore');
        const q = query(collection(db, 'users'), where('email', '==', result.user.email));
        const qs = await getDocs(q);
        
        let assignedBookId = null;
        if (!qs.empty) {
          assignedBookId = qs.docs[0].data().assignedBookId || null;
          userRole = qs.docs[0].data().role || 'editor';
          // Delete placeholder pre-registered doc
          await deleteDoc(qs.docs[0].ref);
        }

        const newDocData: any = {
          email: result.user.email,
          role: userRole,
          createdAt: new Date().toISOString()
        };
        if (assignedBookId) newDocData.assignedBookId = assignedBookId;
        
        await setDoc(doc(db, 'users', result.user.uid), newDocData);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const { getDoc, doc } = await import('firebase/firestore');
        const docSnap = await getDoc(doc(db, 'users', result.user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === 'inactive') {
            await auth.signOut();
            throw new Error('Your account is inactive. Please contact the administrator.');
          }
          userRole = data.role || 'editor';
        }
      }
      handleSuccess(userRole);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser) return;
    setError('');
    setLoading(true);

    try {
      if (mode === 'pin-setup') {
        if (pin.length !== 6 || isNaN(Number(pin))) {
          throw new Error('PIN must be exactly 6 digits.');
        }
        if (pin !== confirmPin) {
          throw new Error('PINs do not match.');
        }
        
        // Handle pre-registered admin doc merging
        const { collection, query, where, getDocs, deleteDoc } = await import('firebase/firestore');
        const q = query(collection(db, 'users'), where('email', '==', tempUser.email));
        const qs = await getDocs(q);
        
        let assignedBookId = null;
        let userRole = 'FalseAttempter';
        if (!qs.empty) {
          assignedBookId = qs.docs[0].data().assignedBookId || null;
          userRole = qs.docs[0].data().role || 'editor';
          if (qs.docs[0].id !== tempUser.uid) {
            await deleteDoc(qs.docs[0].ref);
          }
        }

        const newDocData: any = {
          email: tempUser.email,
          role: userRole,
          pin: pin,
          createdAt: new Date().toISOString()
        };
        if (assignedBookId) newDocData.assignedBookId = assignedBookId;

        await setDoc(doc(db, 'users', tempUser.uid), newDocData, { merge: true });
        
        handleSuccess(userRole);
      } else if (mode === 'pin-verify') {
        const docRef = doc(db, 'users', tempUser.uid);
        const docSnap = await fetchDocWithRetry(docRef);
        
        if (docSnap.exists() && docSnap.data().pin === pin) {
          handleSuccess(docSnap.data().role);
        } else {
          throw new Error('Incorrect PIN. Access denied.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'PIN verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full relative overflow-hidden">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-6">
          <h2 className="text-xl font-bold text-slate-100 mb-1">
            {mode === 'pin-verify' ? 'Welcome Back' : mode === 'pin-setup' ? 'Secure Your Account' : title}
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            {mode === 'initial' && "Select your secure authentication method."}
            {mode === 'email-login' && "Enter your credentials to continue."}
            {mode === 'email-signup' && "Create a new editorial account."}
            {mode === 'pin-setup' && "Secure your Google account with a 6-digit PIN."}
            {mode === 'pin-verify' && "Enter your 6-digit PIN to verify your identity."}
          </p>

          {/* INITIAL MODE SELECTION */}
          {mode === 'initial' && (
            <div className="space-y-3">
              <button
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full py-3 bg-white hover:bg-gray-100 text-gray-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Globe className="w-4 h-4" /> Continue with Google
              </button>
              
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink-0 mx-4 text-slate-500 text-[10px] font-mono">OR</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <button
                onClick={() => setMode('email-login')}
                disabled={loading}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" /> Continue with Email
              </button>
            </div>
          )}

          {/* EMAIL LOGIN / SIGNUP */}
          {(mode === 'email-login' || mode === 'email-signup') && (
            <div className="space-y-4">
              {mode === 'email-signup' && (
                <>
                  <button
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full py-3 bg-white hover:bg-gray-100 text-gray-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Globe className="w-4 h-4" /> Continue with Google
                  </button>
                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink-0 mx-4 text-slate-500 text-[10px] font-mono">OR</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                  </div>
                </>
              )}
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#03060c] border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-sm text-slate-200 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#03060c] border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-sm text-slate-200 outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-lg transition-colors mt-2"
              >
                {loading ? 'Processing...' : mode === 'email-signup' ? 'Create Account' : 'Secure Login'}
              </button>

              <div className="mt-4 text-center space-y-2 flex flex-col">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'email-login' ? 'email-signup' : 'email-login')}
                  className="text-[10px] font-mono text-slate-500 hover:text-amber-400 transition-colors"
                >
                  {mode === 'email-signup' ? 'Already have an account? Log in' : 'Need an account? Sign up'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('initial')}
                  className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
                >
                  &larr; Back to options
                </button>
              </div>
            </form>
            </div>
          )}

          {/* PIN SETUP / VERIFY */}
          {(mode === 'pin-setup' || mode === 'pin-verify') && (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                  6-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  required
                  placeholder="••••••"
                  className="w-full bg-[#03060c] border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-center tracking-[1em] font-mono text-xl text-amber-500 outline-none transition-colors"
                />
              </div>
              
              {mode === 'pin-setup' && (
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                    required
                    placeholder="••••••"
                    className="w-full bg-[#03060c] border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-center tracking-[1em] font-mono text-xl text-amber-500 outline-none transition-colors"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading || pin.length !== 6 || (mode === 'pin-setup' && confirmPin.length !== 6)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-lg transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : mode === 'pin-setup' ? 'Save PIN' : 'Verify Identity'}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
              {error}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
