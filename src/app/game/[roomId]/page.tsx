
"use client"

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export function generateStaticParams() {
  return [{ roomId: 'lobby' }];
}

export default function GameRoomRedirect() {
  const router = useRouter();
  const params = useParams();
  const roomId = params?.roomId as string;

  useEffect(() => {
    if (roomId) {
      router.replace(`/game?roomId=${roomId}`);
    } else {
      router.replace('/');
    }
  }, [roomId, router]);

  return (
    <div className="h-screen w-screen flex items-center justify-center mesh-gradient text-white font-headline tracking-widest text-xl animate-pulse">
      REROUTING TO ARENA...
    </div>
  );
}
