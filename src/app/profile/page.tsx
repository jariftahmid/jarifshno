"use client"

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Clock, Swords, Target, Hash, UserSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function ProfilePage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();

  const profileRef = useMemoFirebase(() => user ? doc(db, 'userProfiles', user.uid) : null, [db, user]);
  const statsRef = useMemoFirebase(() => user ? doc(db, `userProfiles/${user.uid}/playerStats/default`) : null, [db, user]);

  const { data: profile } = useDoc(profileRef);
  const { data: stats } = useDoc(statsRef);

  if (!user || !profile) return null;

  const statCards = [
    { label: 'Win Points', value: stats?.winPoints || 0, icon: Trophy, color: 'text-yellow-500' },
    { label: 'Total Matches', value: stats?.totalMatchesPlayed || 0, icon: Swords, color: 'text-primary' },
    { label: 'Total Points', value: stats?.totalPoints || 0, icon: Target, color: 'text-accent' },
    { label: 'Play Time', value: stats?.totalPlayTimeSeconds ? `${Math.floor(stats.totalPlayTimeSeconds / 60)}m` : '0m', icon: Clock, color: 'text-blue-500' },
  ];

  return (
    <main className="w-full h-screen mesh-gradient flex flex-col p-4">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="text-white">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-2xl font-headline font-black text-white uppercase tracking-widest">Player Profile</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-12 glass p-8 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center gap-8">
            <Avatar className="h-32 w-32 border-4 border-primary shadow-2xl">
              <AvatarImage src={profile.profileImageUrl} />
              <AvatarFallback>{profile.username?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center md:text-left space-y-2">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <h2 className="text-4xl font-headline font-black text-white">{profile.username}</h2>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${profile.status === 'online' ? 'bg-green-500/20 text-green-500' : profile.status === 'in-game' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/40'}`}>
                  {profile.status}
                </div>
              </div>
              <p className="text-white/40 font-mono text-sm flex items-center justify-center md:justify-start gap-2">
                <Hash className="w-3 h-3" /> {profile.id}
              </p>
              <p className="text-white/60 text-xs">Veteran combatant since {new Date(profile.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <Button variant="outline" className="border-white/10 text-white gap-2"><UserSearch className="w-4 h-4"/> Edit Profile</Button>
            </div>
          </div>

          <div className="md:col-span-8 grid grid-cols-2 gap-4">
            {statCards.map((s, i) => (
              <motion.div 
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass p-6 rounded-3xl border border-white/10 space-y-2"
              >
                <s.icon className={`w-6 h-6 ${s.color}`} />
                <span className="block text-2xl font-headline font-black text-white">{s.value}</span>
                <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">{s.label}</span>
              </motion.div>
            ))}
          </div>

          <div className="md:col-span-4 glass p-6 rounded-3xl border border-white/10 space-y-6">
            <h3 className="text-xs font-headline font-bold text-white/50 uppercase tracking-widest">Match Breakdown</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-white/60">RANDOM MATCHES</span>
                  <span className="text-primary">{stats?.randomMatchesPlayed || 0}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${stats?.totalMatchesPlayed ? ((stats.randomMatchesPlayed / stats.totalMatchesPlayed) * 100) : 0}%` }} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-white/60">FRIEND MATCHES</span>
                  <span className="text-accent">{stats?.friendMatchesPlayed || 0}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
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
