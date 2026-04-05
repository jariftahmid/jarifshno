
"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, LogOut, Trophy, Settings, Search, UserPlus, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useAuth, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';
import { generateRoomCode, getInitialGameState } from '@/lib/uno-engine';

export default function Dashboard() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  
  const [roomCode, setRoomCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Global Active Players Counter
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
            username: user.displayName || `Player${user.uid.substring(0, 4)}`,
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
          updateDoc(userRef, { status: 'online', lastOnline: new Date().toISOString() });
        }
      });
    }
  }, [user, isUserLoading, db]);

  const handleSearch = async () => {
    if (!db || !searchQuery.startsWith('@')) return;
    setIsSearching(true);
    try {
      const username = searchQuery.substring(1).trim();
      const q = query(collection(db, 'userProfiles'), where('username', '==', username));
      const snap = await getDocs(q);
      const results = snap.docs.map(d => d.data()).filter(p => p.id !== user?.uid);
      setSearchResults(results);
    } catch (e) {
      toast({ variant: "destructive", title: "Search Failed", description: "Could not find player." });
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (targetUser: any) => {
    if (!db || !user) return;
    try {
      const batch = writeBatch(db);
      const requestId = `${user.uid}_${targetUser.id}`;
      
      // Request for current user
      const myFriendRef = doc(db, `userProfiles/${user.uid}/friendships`, targetUser.id);
      batch.set(myFriendRef, {
        id: targetUser.id,
        requesterId: user.uid,
        recipientId: targetUser.id,
        status: 'pending',
        requestedAt: new Date().toISOString()
      });

      // Request for target user
      const targetFriendRef = doc(db, `userProfiles/${targetUser.id}/friendships`, user.uid);
      batch.set(targetFriendRef, {
        id: user.uid,
        requesterId: user.uid,
        recipientId: targetUser.id,
        status: 'pending',
        requestedAt: new Date().toISOString()
      });

      await batch.commit();
      toast({ title: "Request Sent", description: `Friend request sent to @${targetUser.username}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not send friend request." });
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Login Failed", description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    try {
      await signInAnonymously(auth);
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
    const code = generateRoomCode();
    const roomRef = doc(db, 'gameRooms', code);
    const initialState = getInitialGameState(code, user.uid, 'private');
    await setDoc(roomRef, initialState);
    router.push(`/game?roomId=${code}`);
  };

  const handleJoinPrivateRoom = async () => {
    if (!db || roomCode.length !== 4) return;
    const roomRef = doc(db, 'gameRooms', roomCode.toUpperCase());
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
      router.push(`/game?roomId=${roomCode.toUpperCase()}`);
    } else {
      toast({ variant: "destructive", title: "Room Not Found", description: "Check code and try again." });
    }
  };

  if (isUserLoading) return null;

  if (!user) {
    return (
      <main className="w-full h-screen flex items-center justify-center mesh-gradient p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md glass p-8 rounded-3xl border border-white/20 shadow-2xl text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-5xl font-headline font-black text-white tracking-tighter uppercase">Web Uno<br/><span className="text-primary">Arena</span></h1>
            <p className="text-white/40 font-body text-xs uppercase tracking-[0.3em]">Elite Multiplayer Combat</p>
          </div>
          <div className="space-y-4">
            <Button onClick={handleGoogleLogin} disabled={isLoading} className="w-full h-14 bg-white text-black hover:bg-white/90 font-headline font-bold text-lg rounded-2xl transition-all">
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5 mr-3" alt="Google" />
              {isLoading ? "Connecting..." : "Google Login"}
            </Button>
            <Button onClick={handleGuestLogin} disabled={isLoading} variant="outline" className="w-full h-14 border-white/20 text-white font-headline font-bold text-lg rounded-2xl transition-all">
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
          <Avatar className="h-10 w-10 border-2 border-primary cursor-pointer" onClick={() => router.push('/profile')}>
            <AvatarImage src={user.photoURL || `https://picsum.photos/seed/${user.uid}/100/100`} />
            <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col">
            <span className="text-white font-headline font-bold text-sm truncate max-w-[120px]">{user.displayName || 'Combatant'}</span>
            <Badge variant="outline" className="text-[8px] h-4 border-primary/30 text-primary uppercase">{user.isAnonymous ? 'Guest' : 'Member'}</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[10px] text-white/40 uppercase font-black">Global Arena</span>
            <span className="text-sm font-headline font-black text-primary animate-pulse">{totalActivePlayers} ACTIVE PLAYERS</span>
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
              className="h-40 md:h-48 glass rounded-3xl border border-white/10 flex flex-col items-center justify-center space-y-4 group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Play className="w-10 h-10 md:w-12 md:h-12 text-primary fill-current" />
              <div className="text-center">
                <span className="block text-lg md:text-xl font-headline font-black text-white">RANDOM MATCH</span>
                <span className="text-[9px] text-white/50 uppercase tracking-widest">Find opponents instantly</span>
              </div>
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.98 }}
              onClick={handleCreatePrivateRoom}
              className="h-40 md:h-48 glass rounded-3xl border border-white/10 flex flex-col items-center justify-center space-y-4 group"
            >
              <Plus className="w-10 h-10 md:w-12 md:h-12 text-accent" />
              <div className="text-center">
                <span className="block text-lg md:text-xl font-headline font-black text-white">CREATE PRIVATE</span>
                <span className="text-[9px] text-white/50 uppercase tracking-widest">Challenge your friends</span>
              </div>
            </motion.button>
          </div>

          <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
            <h3 className="text-xs font-headline font-bold text-white/50 uppercase tracking-widest">Arena Social Search</h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input 
                  placeholder="SEARCH @USERNAME" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="bg-white/5 border-white/10 h-12 text-white font-headline font-bold tracking-widest pl-10" 
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              </div>
              <Button onClick={handleSearch} disabled={isSearching || !searchQuery.startsWith('@')} className="h-12 px-6 bg-primary font-black text-white rounded-xl">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "SEARCH"}
              </Button>
            </div>
            
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="space-y-2 mt-4"
                >
                  {searchResults.map(p => (
                    <div key={p.id} className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-primary/30">
                          <AvatarImage src={p.profileImageUrl} />
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-white text-xs font-bold">@{p.username}</span>
                          <span className="text-[8px] text-white/40 uppercase">{p.status}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => sendFriendRequest(p)} className="text-primary hover:bg-primary/10 h-8">
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="md:col-span-4 space-y-6">
          <div className="glass p-6 rounded-3xl border border-white/10 space-y-4">
            <h3 className="text-xs font-headline font-bold text-white/50 uppercase tracking-widest">Join Private</h3>
            <div className="flex gap-2">
              <Input 
                placeholder="CODE" 
                maxLength={4} 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="bg-white/5 border-white/10 h-12 text-center font-headline font-bold tracking-[0.3em] text-white" 
              />
              <Button onClick={handleJoinPrivateRoom} disabled={roomCode.length !== 4} className="h-12 px-6 bg-accent text-white font-black rounded-xl">JOIN</Button>
            </div>
          </div>

          <div className="glass p-6 rounded-3xl border border-white/10 space-y-6">
            <h3 className="text-xs font-headline font-bold text-white/50 uppercase tracking-widest">Arena Rankings</h3>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-white/20 font-black italic">#0{i}</span>
                    <div className="w-8 h-8 rounded-full bg-white/5" />
                    <span className="text-[10px] font-bold text-white/50">MATCHMAKING...</span>
                  </div>
                  <Trophy className="w-3 h-3 text-yellow-500/30" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
