
"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Play, Plus, LogOut, Trophy, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc, updateDoc, collection, query, where } from 'firebase/firestore';
import { signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';
import { generateRoomCode, getInitialGameState } from '@/lib/uno-engine';

export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Global Active Players Counter - Only query if user is authenticated to respect security rules
  const activeRoomsQuery = useMemoFirebase(() => 
    (db && user) ? query(collection(db, 'gameRooms'), where('status', '==', 'playing')) : null, 
    [db, user]
  );
  const { data: activeRooms } = useCollection(activeRoomsQuery);
  const totalActivePlayers = activeRooms?.reduce((acc, room) => acc + (room.playerIds?.length || 0), 0) || 0;

  useEffect(() => {
    if (user && !isUserLoading && db) {
      const userRef = doc(db, 'userProfiles', user.uid);
      getDoc(userRef).then(snap => {
        if (!snap.exists()) {
          setDoc(userRef, {
            id: user.uid,
            username: user.displayName || `ArenaPlayer-${user.uid.substring(0, 4)}`,
            googleId: user.providerData.find(p => p.providerId === 'google.com')?.uid || null,
            isGuest: user.isAnonymous,
            createdAt: new Date().toISOString(),
            lastOnline: new Date().toISOString(),
            status: 'online',
            profileImageUrl: user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`
          });
          setDoc(doc(db, `userProfiles/${user.uid}/playerStats/default`), {
            id: 'default',
            userId: user.uid,
            totalMatchesPlayed: 0,
            randomMatchesPlayed: 0,
            friendMatchesPlayed: 0,
            winPoints: 0,
            totalPoints: 0,
            totalPlayTimeSeconds: 0
          });
        } else {
          updateDoc(userRef, { 
            status: 'online', 
            lastOnline: new Date().toISOString() 
          });
        }
      });
    }
  }, [user, isUserLoading, db]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast({ title: "Welcome back!", description: "Synchronized with Google account." });
    } catch (e) {
      toast({ variant: "destructive", title: "Login Failed", description: "Could not authenticate with Google." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    try {
      await signInAnonymously(auth);
      toast({ title: "Guest Access", description: "Welcome to the Arena." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Guest login failed." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (user && db) {
      await updateDoc(doc(db, 'userProfiles', user.uid), { status: 'offline' });
      await signOut(auth);
    }
  };

  const handleCreatePrivateRoom = async () => {
    if (!db || !user) return;
    setIsLoading(true);
    const code = generateRoomCode();
    const roomRef = doc(db, 'gameRooms', code);
    const initialState = getInitialGameState(code, user.uid, 'private');
    await setDoc(roomRef, initialState);
    router.push(`/game?roomId=${code}`);
  };

  const handleJoinPrivateRoom = async () => {
    if (!db || roomCode.length !== 4) return;
    setIsLoading(true);
    const roomRef = doc(db, 'gameRooms', roomCode.toUpperCase());
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
      router.push(`/game?roomId=${roomCode.toUpperCase()}`);
    } else {
      toast({ variant: "destructive", title: "Room Not Found", description: "Check your code and try again." });
      setIsLoading(false);
    }
  };

  if (isUserLoading) return null;

  if (!user) {
    return (
      <main className="w-full h-screen flex items-center justify-center mesh-gradient p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md glass p-8 rounded-3xl border border-white/20 shadow-2xl text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-5xl font-headline font-black text-white tracking-tighter">WEB UNO<br/><span className="text-primary">ARENA</span></h1>
            <p className="text-white/40 font-body text-sm uppercase tracking-widest">Elite Multiplayer Combat</p>
          </div>
          <div className="space-y-4">
            <Button onClick={handleGoogleLogin} disabled={isLoading} className="w-full h-14 bg-white text-black hover:bg-white/90 font-headline font-bold text-lg rounded-2xl">
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5 mr-3" alt="Google" />
              Sign in with Google
            </Button>
            <Button onClick={handleGuestLogin} disabled={isLoading} variant="outline" className="w-full h-14 border-white/20 text-white font-headline font-bold text-lg rounded-2xl">
              Play as Guest
            </Button>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="w-full h-screen flex flex-col mesh-gradient overflow-hidden">
      <div className="p-4 flex justify-between items-center glass border-b border-white/10 z-20">
        <div className="flex items-center gap-4">
          <Avatar className="h-10 w-10 border-2 border-primary">
            <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`} />
            <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-white font-headline font-bold text-sm">{user.displayName || 'Guest Combatant'}</span>
            <Badge variant="outline" className="text-[8px] h-4 border-primary/30 text-primary uppercase">{user.isAnonymous ? 'Guest' : 'Persistent'}</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[10px] text-white/40 uppercase font-black">Active Globally</span>
            <span className="text-sm font-headline font-black text-primary animate-pulse">{totalActivePlayers} PLAYERS</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => router.push('/profile')} className="text-white hover:bg-white/10"><Settings className="w-5 h-5"/></Button>
          <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-white hover:bg-red-500/20"><LogOut className="w-5 h-5"/></Button>
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-12 gap-6 max-w-7xl mx-auto w-full overflow-y-auto no-scrollbar">
        <div className="md:col-span-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.button 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/lobby')}
              className="h-48 glass rounded-3xl border border-white/10 flex flex-col items-center justify-center space-y-4 group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Play className="w-12 h-12 text-primary fill-current" />
              <div className="text-center">
                <span className="block text-xl font-headline font-black text-white">RANDOM MATCH</span>
                <span className="text-[10px] text-white/50 uppercase tracking-widest">Find opponents instantly</span>
              </div>
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }}
              onClick={handleCreatePrivateRoom}
              className="h-48 glass rounded-3xl border border-white/10 flex flex-col items-center justify-center space-y-4 group"
            >
              <Plus className="w-12 h-12 text-accent" />
              <div className="text-center">
                <span className="block text-xl font-headline font-black text-white">CREATE PRIVATE</span>
                <span className="text-[10px] text-white/50 uppercase tracking-widest">Challenge your friends</span>
              </div>
            </motion.button>
          </div>

          <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
            <h3 className="text-xs font-headline font-bold text-white/50 uppercase tracking-widest">Join with Arena Code</h3>
            <div className="flex gap-4">
              <Input 
                placeholder="4-LETTER CODE" 
                maxLength={4} 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="bg-white/5 border-white/10 h-14 text-center font-headline font-bold text-2xl tracking-[0.5em] text-white" 
              />
              <Button onClick={handleJoinPrivateRoom} disabled={roomCode.length !== 4} className="h-14 px-8 bg-primary font-headline font-black text-white rounded-xl">JOIN</Button>
            </div>
          </div>
        </div>

        <div className="md:col-span-4 space-y-6">
          <div className="glass p-6 rounded-3xl border border-white/10 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-headline font-bold text-white/50 uppercase tracking-widest">Arena Social</h3>
            </div>
            <div className="space-y-4 text-center">
              <p className="text-[10px] text-white/30 italic">Connect with friends to see their status.</p>
            </div>
          </div>

          <div className="glass p-6 rounded-3xl border border-white/10 space-y-6">
            <h3 className="text-xs font-headline font-bold text-white/50 uppercase tracking-widest">Season Rankings</h3>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-white/20 font-black italic">#0{i}</span>
                    <div className="w-8 h-8 rounded-full bg-white/5" />
                    <span className="text-xs font-bold text-white/80">Loading...</span>
                  </div>
                  <Trophy className="w-4 h-4 text-yellow-500/50" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
