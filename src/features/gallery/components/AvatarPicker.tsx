import { useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import { avatarChoice, DEFAULT_AVATAR, HAIRSTYLES, type AvatarChoice, type AvatarGender } from '../avatar';
import Character from './Character';
import './avatarPicker.css';

function PreviewCamera({ santaHat }: { santaHat: boolean }) {
  const { camera, invalidate } = useThree();

  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    camera.fov = santaHat ? 32 : 29;
    camera.position.set(0, santaHat ? 1.27 : 1.19, -4.9);
    camera.lookAt(0, santaHat ? 1.13 : 1.05, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, santaHat]);

  return null;
}

export default function AvatarPicker({
  initial,
  onConfirm,
  onCancel,
}: {
  initial: AvatarChoice | null;
  onConfirm: (choice: AvatarChoice) => void;
  onCancel?: () => void;
}) {
  const [choice, setChoice] = useState(initial ?? DEFAULT_AVATAR);
  const [angle, setAngle] = useState(18);
  const drag = useRef<{ startX: number; startAngle: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="avatar-picker"
      aria-labelledby="avatar-picker-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel?.();
      }}
    >
      <div className="avatar-picker-layout">
        <header className="avatar-picker-header">
          <h1 id="avatar-picker-title">캐릭터 선택</h1>
          <p>전시장을 함께 둘러볼 캐릭터를 골라주세요.</p>
        </header>
        <div
          className="avatar-stage"
          role="slider"
          tabIndex={0}
          aria-label="캐릭터 미리보기 회전"
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={angle}
          aria-valuetext={`${angle}도`}
          onKeyDown={(event) => {
            switch (event.key) {
              case 'ArrowLeft':
              case 'ArrowDown':
                event.preventDefault();
                setAngle((current) => (current + 345) % 360);
                break;
              case 'ArrowRight':
              case 'ArrowUp':
                event.preventDefault();
                setAngle((current) => (current + 15) % 360);
                break;
              case 'Home':
              case 'End':
                event.preventDefault();
                setAngle(event.key === 'Home' ? 0 : 359);
                break;
            }
          }}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            drag.current = { startX: event.clientX, startAngle: angle };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId) || !drag.current) return;
            const next = Math.round(drag.current.startAngle + (event.clientX - drag.current.startX) * 1.2);
            setAngle(((next % 360) + 360) % 360);
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
        >
          <div className="avatar-stage-shadow" aria-hidden="true" />
          <Canvas
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0 }}
            frameloop="demand"
            dpr={[1, 1.5]}
          >
            <PreviewCamera santaHat={choice.santaHat} />
            <ambientLight intensity={.45} />
            <hemisphereLight args={['#fff8f6', '#e1b9ac', 1.4]} />
            <directionalLight position={[2.4, 4.1, -4.5]} intensity={2.1} color="#fff8f6" />
            <directionalLight position={[-4, 1.9, -3]} intensity={.7} color="#ffe9de" />
            <directionalLight position={[-2, 3, 2]} intensity={1.65} color="#ffe4ce" />
            <group rotation={[0, angle * Math.PI / 180, 0]}>
              <Character avatar={choice} />
            </group>
          </Canvas>
        </div>
        <button
          type="button"
          className="avatar-hat-toggle"
          aria-label="산타모자"
          aria-pressed={choice.santaHat}
          title="산타모자"
          onClick={() => setChoice((current) => ({ ...current, santaHat: !current.santaHat }))}
        >
          <span className="avatar-hat-icon" aria-hidden="true"><span /></span>
        </button>
        <form
          className="avatar-options"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(choice);
          }}
        >
          <fieldset>
            <legend>성별</legend>
            <div className="avatar-choices avatar-genders">
              {(['male', 'female'] satisfies AvatarGender[]).map((gender) => (
                <label key={gender}>
                  <input
                    type="radio"
                    name="avatar-gender"
                    checked={choice.gender === gender}
                    onChange={() => setChoice((current) => avatarChoice(gender, initial?.hair, current.santaHat))}
                  />
                  <span>{gender === 'male' ? '남' : '여'}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>헤어스타일</legend>
            <div className="avatar-choices avatar-hairstyles">
              {HAIRSTYLES[choice.gender].map(({ id, label }) => (
                <label key={id}>
                  <input
                    type="radio"
                    name="avatar-hair"
                    checked={choice.hair === id}
                    onChange={() => setChoice((current) => avatarChoice(current.gender, id, current.santaHat))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="avatar-picker-actions">
            {initial && <button type="button" onClick={onCancel}>취소</button>}
            <button type="submit">{initial ? '캐릭터 적용' : '전시장 입장'}</button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
