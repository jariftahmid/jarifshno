"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface GameRedirectProps {
  roomId: string;
}

export default function GameRedirect({ roomId }: GameRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    if (roomId) {
      router.replace(`/game?roomId=${roomId}`);
    } else {
      router.replace('/');
    }
  }, [roomId, router]);

  return (
    <div className="h-screen w-screen flex items-center justify-center mesh-gradient text-white font-headline tracking-widest text-xl animate-pulse">
      SYNCING ARENA...
    </div>
  );
}
