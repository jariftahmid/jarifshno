
"use client"

import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, PhoneCall, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { socket } from '@/lib/socket';
import { toast } from '@/hooks/use-toast';

interface VoiceChatProps {
  roomId: string;
  playerId: string;
}

export default function VoiceChat({ roomId, playerId }: VoiceChatProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<{ [key: string]: RTCPeerConnection }>({});
  const audioElements = useRef<{ [key: string]: HTMLAudioElement }>({});

  useEffect(() => {
    if (!isJoined) return;

    socket.connect();
    socket.emit('join-voice', { roomId, playerId });

    socket.on('user-joined-voice', async (userId: string) => {
      if (userId === playerId) return;
      const pc = createPeerConnection(userId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice-offer', { to: userId, offer, from: playerId });
    });

    socket.on('voice-offer', async ({ from, offer }) => {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice-answer', { to: from, answer, from: playerId });
    });

    socket.on('voice-answer', async ({ from, answer }) => {
      const pc = peers.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', ({ from, candidate }) => {
      const pc = peers.current[from];
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('user-left-voice', (userId: string) => {
      if (peers.current[userId]) {
        peers.current[userId].close();
        delete peers.current[userId];
      }
      if (audioElements.current[userId]) {
        audioElements.current[userId].remove();
        delete audioElements.current[userId];
      }
    });

    return () => {
      socket.off('user-joined-voice');
      socket.off('voice-offer');
      socket.off('voice-answer');
      socket.off('ice-candidate');
      socket.off('user-left-voice');
      leaveVoice();
    };
  }, [isJoined, roomId, playerId]);

  const createPeerConnection = (userId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { to: userId, candidate: event.candidate, from: playerId });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!audioElements.current[userId]) {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audioElements.current[userId] = audio;
      }
    };

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current!);
      });
    }

    peers.current[userId] = pc;
    return pc;
  };

  const joinVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;
      setIsJoined(true);
      toast({ title: "Comms Active", description: "Strategic voice channel established." });
    } catch (err) {
      toast({ variant: "destructive", title: "Mic Access Denied", description: "Enable microphone permissions to speak." });
    }
  };

  const leaveVoice = () => {
    setIsJoined(false);
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
      localStream.current = null;
    }
    Object.values(peers.current).forEach(pc => pc.close());
    peers.current = {};
    Object.values(audioElements.current).forEach(el => el.remove());
    audioElements.current = {};
    socket.disconnect();
  };

  const toggleMute = () => {
    if (localStream.current) {
      const track = localStream.current.getAudioTracks()[0];
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isJoined ? (
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
          <Button size="icon" variant="ghost" onClick={toggleMute} className={isMuted ? "text-red-500 hover:bg-red-500/10" : "text-green-500 hover:bg-green-500/10"}>
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          <div className="flex items-center gap-1 px-2">
            <Volume2 className="w-3 h-3 text-primary animate-pulse" />
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-tighter">Live</span>
          </div>
          <Button size="icon" variant="ghost" onClick={leaveVoice} className="text-white/30 hover:text-red-500">
            <PhoneOff className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={joinVoice} className="bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 h-8 flex gap-2 px-3 rounded-full">
          <PhoneCall className="w-3 h-3" /> Voice
        </Button>
      )}
    </div>
  );
}
