import { Component, Suspense, type ReactNode } from 'react';
import { useTexture } from '@react-three/drei';

function EmptyImage({ failed = false }: { failed?: boolean }) {
  return (
    <mesh position={[0, 0, 0.071]}>
      <planeGeometry args={[1.62, 1.2]} />
      <meshBasicMaterial color={failed ? '#c4b4a3' : '#e7dfd1'} />
    </mesh>
  );
}
class ImageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <EmptyImage failed /> : this.props.children;
  }
}
function ImagePlane({ url }: { url: string }) {
  const texture = useTexture(url);
  const image = texture.image as { width: number; height: number };
  const scale = Math.min(1.62 / image.width, 1.2 / image.height);
  return (
    <mesh position={[0, 0, 0.071]}>
      <planeGeometry args={[image.width * scale, image.height * scale]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
export default function ArtworkImage({ url }: { url: string }) {
  return (
    <ImageBoundary key={url}>
      <Suspense fallback={<EmptyImage />}>
        <ImagePlane url={url} />
      </Suspense>
    </ImageBoundary>
  );
}
