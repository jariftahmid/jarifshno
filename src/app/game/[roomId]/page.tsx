import GameRedirect from '@/components/uno/GameRedirect';

/**
 * Static params are required for dynamic routes when using output: export.
 * This allows the build to succeed while we use client-side redirection
 * to handle dynamic room IDs in the Capacitor app.
 */
export function generateStaticParams() {
  return [{ roomId: 'arena' }];
}

export default async function GameRoomRedirect(props: { params: Promise<{ roomId: string }> }) {
  const params = await props.params;
  return <GameRedirect roomId={params.roomId} />;
}
