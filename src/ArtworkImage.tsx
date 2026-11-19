import { Component, Suspense, type ReactNode } from 'react';
import { useTexture } from '@react-three/drei';

function EmptyImage({ failed = false, width=1.62, height=1.2 }: { failed?: boolean; width?:number; height?:number }) {
  return (
    <mesh position={[0, 0, 0.071]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={failed ? '#c4b4a3' : '#e7dfd1'} />
    </mesh>
  );
}
class ImageBoundary extends Component<
  { children: ReactNode; width:number; height:number },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <EmptyImage failed width={this.props.width} height={this.props.height} /> : this.props.children;
  }
}
function ImagePlane({ url, width, height }: { url: string; width:number; height:number }) {
  const texture = useTexture(url);
  const image = texture.image as { width: number; height: number };
  const scale = Math.min(width / image.width, height / image.height);
  return (
    <mesh position={[0, 0, 0.071]}>
      <planeGeometry args={[image.width * scale, image.height * scale]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
export default function ArtworkImage({ url, width=1.62, height=1.2 }: { url: string; width?:number; height?:number }) {
  return (
    <ImageBoundary key={url} width={width} height={height}>
      <Suspense fallback={<EmptyImage width={width} height={height} />}>
        <ImagePlane url={url} width={width} height={height} />
      </Suspense>
    </ImageBoundary>
  );
}
