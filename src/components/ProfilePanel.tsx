import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { UserCircle, X, Shield, Key } from 'lucide-react';

interface ProfilePanelProps {
  onClose: () => void;
}

export default function ProfilePanel({ onClose }: ProfilePanelProps) {
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentUser = auth.currentUser;
  const isGoogle = currentUser?.providerData.some(p => p.providerId === 'google.com');

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let updatedSomething = false;

      // Update PIN if provided
      if (newPin || confirmPin) {
        if (newPin.length !== 6 || isNaN(Number(newPin))) throw new Error("PIN must be exactly 6 digits.");
        if (newPin !== confirmPin) throw new Error("PINs do not match.");
        
        await setDoc(doc(db, 'users', currentUser.uid), {
          pin: newPin
        }, { merge: true });
        
        setNewPin('');
        setConfirmPin('');
        updatedSomething = true;
      }

      // Update Password if provided (only for non-Google)
      if (!isGoogle && (newPassword || confirmPassword)) {
        if (newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
        if (newPassword !== confirmPassword) throw new Error("Passwords do not match.");
        
        await updatePassword(currentUser, newPassword);
        
        setNewPassword('');
        setConfirmPassword('');
        updatedSomething = true;
      }

      if (updatedSomething) {
        setSuccess("Credentials updated successfully.");
      } else {
        setError("Please enter new credentials to update.");
      }
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('For security reasons, you need to log out and log back in before changing your password.');
      } else {
        setError(err.message || 'Update failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
              <UserCircle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">My Profile</h2>
              <p className="text-[10px] font-mono text-slate-400 truncate w-48">
                {currentUser?.email}
              </p>
            </div>
          </div>

          <form onSubmit={handleUpdate} className="space-y-4">
            {/* PIN UPDATE SECTION (AVAILABLE TO ALL) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-800">
                <Shield className="w-4 h-4 text-emerald-400" />
                Security PIN
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                  New 6-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="••••••"
                  className="w-full bg-[#03060c] border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-center tracking-[1em] font-mono text-xl text-amber-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="••••••"
                  className="w-full bg-[#03060c] border border-slate-800 focus:border-amber-500 rounded-lg p-2.5 text-center tracking-[1em] font-mono text-xl text-amber-500 outline-none transition-colors"
                />
              </div>
            </div>

            {/* PASSWORD UPDATE SECTION (EMAIL/PASSWORD ONLY) */}
            {!isGoogle && (
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-800">
                  <Key className="w-4 h-4 text-emerald-400" />
                  Email & Password Account
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-[#03060c] border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-sm text-slate-200 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#03060c] border border-slate-800 focus:border-amber-500 rounded-lg p-2 text-sm text-slate-200 outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-lg transition-colors mt-2"
            >
              {loading ? 'Updating...' : 'Update Credentials'}
            </button>

            {error && (
              <div className="mt-4 text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mt-4 text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                {success}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
