# 캐릭터 변경 방법

현재 캐릭터는 외부 모델 파일이 아니라 `src/Character.tsx`의 3D 도형으로 만들어집니다.

## 색과 체형 수정

`src/Character.tsx`에서 `meshStandardMaterial`의 `color`를 수정합니다.

| 부분 | 현재 색 |
| --- | --- |
| 상의·소매 | `#9c8a99` |
| 바지 | `#44434a` |
| 피부 | `#edc8af` |
| 머리카락 | `#483e3a` |
| 신발 | `#ede4d7` |

몸·팔다리 크기는 `capsuleGeometry`의 `args`, 머리 크기는 `sphereGeometry`의 `args`, 관절 위치는 각 `group`의 `position`으로 조절합니다. 개발 서버 실행 중 저장하면 화면에 반영됩니다.

## 외부 3D 캐릭터로 교체

1. GLB 모델을 준비해 `public/models/character.glb`에 넣습니다. 현재 이 모델 파일은 포함되어 있지 않습니다.
2. `src/Character.tsx`에서 도형 대신 해당 모델을 불러오도록 교체합니다. 브라우저에서 사용하는 파일 주소는 `/models/character.glb`입니다. 로딩 방법은 [Drei useGLTF 공식 문서](https://drei.docs.pmnd.rs/loaders/gltf-use-gltf)를 참고하세요.
3. `character-heading` 그룹과 `motion.current.facing`을 적용하는 코드를 유지하고 모델을 그 안에 배치합니다. 정면은 로컬 `-Z`, 바닥은 `y=0`, 전체 높이는 약 1.9에 맞춥니다. 모델이 `+Z`를 바라보면 안쪽 모델 그룹만 Y축으로 `Math.PI` 회전시킵니다.
4. 외부 모델의 보행에는 리깅과 대기·제자리 걷기 애니메이션이 필요합니다. 기존 도형의 관절 애니메이션은 자동 적용되지 않습니다. 모델의 실제 클립 이름을 확인하고 `motion.current.speed`에 따라 대기/걷기를 전환합니다. 연결 방법은 [Drei useAnimations 공식 문서](https://drei.docs.pmnd.rs/abstractions/use-animations)를 참고하세요.
5. 체격이 크게 달라지면 `src/layout.ts`의 `PLAYER_RADIUS`와 `src/Gallery.tsx`의 카메라 높이도 맞춥니다.

## 역할 구분

- `src/Character.tsx`: 외형, 회전 적용, 걷기·대기 애니메이션
- `src/locomotion.ts`: 실제 이동 방향에 따른 회전 계산
- `src/Gallery.tsx`: 키보드·마우스 입력, 이동, 카메라
- `src/layout.ts`: 공간과 충돌 범위

`npm test`에는 실제 React Three Fiber 장면의 캐릭터 월드 방향 검사가 포함되어 있습니다. 이 검사는 브라우저의 픽셀 출력을 검증하지는 않습니다.
