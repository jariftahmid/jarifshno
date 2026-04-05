
"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Clock, Swords, Target, Hash, Edit2, Check, X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();

  const profileRef = useMemoFirebase(() => user ? doc(db, 'userProfiles', user.uid) : null, [db, user]);
  const statsRef = useMemoFirebase(() => user ? doc(db, `userProfiles/${user.uid}/playerStats/default`) : null, [db, user]);

  const { data: profile } = useDoc(profileRef);
  const { data: stats } = useDoc(statsRef);

  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [editedAvatar, setEditedAvatar] = useState('');

  const handleStartEdit = () => {
    if (!profile) return;
    setEditedUsername(profile.username);
    setEditedAvatar(profile.profileImageUrl);
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!db || !user || !editedUsername.trim()) return;
    try {
      await updateDoc(doc(db, 'userProfiles', user.uid), {
        username: editedUsername.trim().replace(/\s+/g, ''),
        profileImageUrl: editedAvatar || `https://picsum.photos/seed/${user.uid}/100/100`
      });
      setIsEditing(false);
      toast({ title: "Identity Updated", description: "Your combat persona has been recalibrated." });
    } catch (e) {
      toast({ variant: "destructive", title: "Update Failed", description: "Error syncing identity changes." });
    }
  };

  if (!user || !profile) return null;

  const statCards = [
    { label: 'Rank Points', value: stats?.winPoints || 0, icon: Trophy, color: 'text-yellow-500' },
    { label: 'Arena Matches', value: stats?.totalMatchesPlayed || 0, icon: Swords, color: 'text-primary' },
    { label: 'Total XP', value: stats?.totalPoints || 0, icon: Target, color: 'text-accent' },
    { label: 'Active Time', value: stats?.totalPlayTimeSeconds ? `${Math.floor(stats.totalPlayTimeSeconds / 60)}m` : '0m', icon: Clock, color: 'text-blue-500' },
  ];

  return (
    <main className="w-full h-screen mesh-gradient flex flex-col p-4 overflow-y-auto no-scrollbar">
      <div className="max-w-4xl mx-auto w-full space-y-6 pb-12">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="text-white h-10 w-10">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-headline font-black text-white uppercase tracking-widest">Profile Identity</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-12 glass p-6 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
            <div className="relative group shrink-0">
               <Avatar className="h-24 w-24 border-4 border-primary shadow-2xl">
                <AvatarImage src={isEditing ? editedAvatar : profile.profileImageUrl} />
                <AvatarFallback>{profile.username?.charAt(0)}</AvatarFallback>
              </Avatar>
              {isEditing && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center pointer-events-none">
                  <Camera className="text-white w-5 h-5 opacity-70" />
                </div>
              )}
            </div>
            
            <div className="flex-1 text-center md:text-left space-y-2 overflow-hidden w-full">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 w-full">
                    <div className="space-y-1">
                      <label className="text-[9px] text-white/40 uppercase font-black">Username</label>
                      <Input value={editedUsername} onChange={(e) => setEditedUsername(e.target.value)} className="bg-white/5 border-white/10 text-white font-headline font-bold" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-white/40 uppercase font-black">Avatar URL</label>
                      <Input value={editedAvatar} onChange={(e) => setEditedAvatar(e.target.value)} className="bg-white/5 border-white/10 text-white text-xs" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="flex flex-col md:flex-row items-center gap-2">
                      <h2 className="text-2xl font-headline font-black text-white truncate max-w-full">@{profile.username}</h2>
                      <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${profile.status === 'online' ? 'bg-green-500/20 text-green-500' : 'bg-primary/20 text-primary'}`}>
                        {profile.status}
                      </div>
                    </div>
                    <p className="text-white/40 font-mono text-[9px] flex items-center justify-center md:justify-start gap-2 mt-1">
                      <Hash className="w-3 h-3" /> {profile.id.substring(0, 16)}...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              {isEditing ? (
                <>
                  <Button onClick={handleSaveProfile} className="bg-primary text-white flex-1 md:flex-none h-10 px-6 rounded-xl text-xs font-black">SAVE</Button>
                  <Button variant="ghost" onClick={() => setIsEditing(false)} className="text-white/50 h-10">CANCEL</Button>
                </>
              ) : (
                <Button variant="outline" onClick={handleStartEdit} className="border-white/10 text-white gap-2 w-full h-10 px-6 rounded-xl text-xs font-black">
                  <Edit2 className="w-3 h-3" /> EDIT DETAILS
                </Button>
              )}
            </div>
          </div>

          <div className="md:col-span-8 grid grid-cols-2 gap-4">
            {statCards.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass p-4 rounded-2xl border border-white/10 space-y-1">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <span className="block text-xl font-headline font-black text-white">{s.value}</span>
                <span className="text-[9px] text-white/40 uppercase font-bold tracking-tighter">{s.label}</span>
              </motion.div>
            ))}
          </div>

          <div className="md:col-span-4 glass p-6 rounded-3xl border border-white/10 space-y-6">
            <h3 className="text-[10px] font-headline font-bold text-white/50 uppercase tracking-widest">Season Breakdown</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-white/60">RANDOM MATCHES</span>
                  <span className="text-primary">{stats?.randomMatchesPlayed || 0}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${stats?.totalMatchesPlayed ? ((stats.randomMatchesPlayed / stats.totalMatchesPlayed) * 100) : 0}%` }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-white/60">FRIEND DUELS</span>
                  <span className="text-accent">{stats?.friendMatchesPlayed || 0}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${stats?.totalMatchesPlayed ? ((stats.friendMatchesPlayed / stats.totalMatchesPlayed) * 100) : 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
