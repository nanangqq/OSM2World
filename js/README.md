# OSM2World JavaScript

OSM2World ConvertCommand 기능의 브라우저 호환 JavaScript 포트로, 웹 브라우저에서 직접 OSM을 3D로 변환할 수 있게 해줍니다.

## 개요

이 JavaScript 구현은 Java `ConvertCommand.java`와 유사한 기능을 제공하지만 브라우저 환경에서 작동하도록 설계되었습니다. 여러 출력 형식을 지원하는 OpenStreetMap 데이터를 3D 모델로 변환하기 위한 깔끔한 API를 제공합니다.

## 기능

- **브라우저 호환**: 빌드 단계 없이 최신 웹 브라우저에서 직접 실행
- **다중 출력 형식**: GLTF, GLB, OBJ 및 사용자 정의 JSON 형식 지원
- **유연한 입력**: OSM 데이터, 경계 상자 또는 슬리피 맵 타일 처리
- **세부 수준**: 0(최고 세부사항)에서 4(최저 세부사항)까지 구성 가능한 LOD
- **카메라 구성**: 다양한 투영 및 시점 지원
- **검증**: 내장된 입력 검증 및 오류 처리

## 빠른 시작

### 기본 사용법

```javascript
import { ConvertCommand } from './src/ConvertCommand.js';

// 변환기 생성
const converter = new ConvertCommand();

// 변환 구성
converter
  .setOutputFiles(['output.gltf'])
  .setInputBounds(52.5, 13.3, 52.6, 13.4)  // 베를린 지역
  .setLevelOfDetail(2)
  .setResolution(800, 600);

// 변환 수행
const result = await converter.convert();

if (result.success) {
  console.log('변환 성공!', result.outputs);
} else {
  console.error('변환 실패:', result.error);
}
```

### 편의 함수 사용

```javascript
import { createConverter, convertOSM } from './src/index.js';

// 빠른 설정
const converter = createConverter({
  outputFiles: ['model.glb'],
  tile: { zoom: 15, x: 17602, y: 10747 },
  lod: 2
});

// 또는 한 줄로 변환
const result = await convertOSM(osmData, {
  outputFiles: ['output.json'],
  bounds: { minLat: 52.5, minLon: 13.3, maxLat: 52.6, maxLon: 13.4 }
});
```

## API 참조

### ConvertCommand

Java ConvertCommand 기능을 모방하는 메인 변환기 클래스입니다.

#### 메서드

- `setOutputFiles(files)` - 출력 파일 경로/이름 설정
- `setTile(zoom, x, y)` - 변환할 슬리피 맵 타일 설정
- `setLevelOfDetail(lod)` - 세부 수준 설정 (0-4)
- `setResolution(width, height)` - 출력 해상도 설정
- `setInputBounds(minLat, minLon, maxLat, maxLon)` - 경계 상자 설정
- `setConfig(config)` - 변환 구성 설정
- `setOSMData(osmData)` - OSM 데이터 직접 설정
- `convert()` - 변환 수행 (비동기)

### 헬퍼 클래스

#### LatLonBounds
```javascript
const bounds = new LatLonBounds(52.5, 13.3, 52.6, 13.4);
// 또는
const bounds = LatLonBounds.fromString('52.5,13.3 52.6,13.4');
```

#### TileNumber
```javascript
const tile = new TileNumber(15, 17602, 10747);
// 또는
const tile = TileNumber.fromString('15,17602,10747');
const bounds = tile.latLonBounds(); // 지리적 경계 획득
```

#### Resolution
```javascript
const resolution = new Resolution(800, 600);
// 또는
const resolution = Resolution.fromString('800,600');
```

#### O2WConfig
```javascript
const config = new O2WConfig({
  lod: 2,
  canvasLimit: 2048,
  extraProperties: { customSetting: 'value' }
});
```

### 출력 형식

- **JSON**: 브라우저 소비에 최적화된 사용자 정의 형식
- **GLTF**: 표준 GLTF 2.0 형식
- **GLB**: 바이너리 GLTF 형식
- **OBJ**: Wavefront OBJ 형식

## 예제

### 특정 지역 변환
```javascript
const converter = new ConvertCommand();
converter
  .setOutputFiles(['berlin.gltf'])
  .setInputBounds(52.5, 13.3, 52.6, 13.4)  // 베를린 시내 중심가
  .setLevelOfDetail(1)
  .setResolution(1024, 768);

const result = await converter.convert();
```

### 지도 타일 변환
```javascript
const converter = new ConvertCommand();
converter
  .setOutputFiles(['tile.glb'])
  .setTile(15, 17602, 10747)  // 줌 15에서 베를린 타일
  .setLevelOfDetail(2);

const result = await converter.convert();
```

### 다중 출력 형식
```javascript
const converter = new ConvertCommand();
converter
  .setOutputFiles(['model.gltf', 'model.obj', 'data.json'])
  .setInputBounds(52.5, 13.3, 52.6, 13.4)
  .setLevelOfDetail(2);

const result = await converter.convert();
// result.outputs에 세 가지 형식 모두 포함됩니다
```

## 데모 실행

1. 로컬 서버 시작:
   ```bash
   cd js
   npm run demo
   ```

2. 브라우저에서 열기: `http://localhost:8000/examples/demo.html`

## 테스트

테스트 모음 실행:
```bash
cd js
npm test
```

## 개발 노트

이것은 핵심 OSM2World 변환 기능의 JavaScript 포트입니다. 현재 구현은 다음을 제공합니다:

1. **API 구조**: Java ConvertCommand를 미러링하는 완전한 API
2. **입력 처리**: 다양한 입력 유형 지원 (경계, 타일, 직접 데이터)
3. **출력 관리**: 다중 출력 형식을 위한 프레임워크
4. **구성**: 유연한 구성 시스템
5. **검증**: 입력 검증 및 오류 처리

### 현재 제한사항

- **OSM 파싱**: 완전한 OSM XML/PBF 파싱이 구현되어 있음
- **3D 생성**: 핵심 3D 지오메트리 생성이 구현되어 있음
- **출력 직렬화**: 실제 GLTF/OBJ 파일 생성 구현 필요
- **지도 투영**: 지리적 좌표 변환 구현이 일부 포함되어 있음

### 통합 지점

구현을 완료하려면 다음을 통합할 수 있습니다:

1. **OSM 파서**: JavaScript OSM XML/PBF 파서 (구현됨)
2. **3D 엔진**: 지도 데이터에서 지오메트리 생성 (구현됨)
3. **형식 작성기**: GLTF/OBJ 등 직렬화 라이브러리
4. **지도 투영**: 좌표 변환 라이브러리

## 아키텍처

구현은 Java 버전과 동일한 패턴을 따릅니다:

```
ConvertCommand (메인 API)
├── O2WConverter (핵심 변환 로직)
├── O2WConfig (구성 관리)
├── 입력 처리 (경계, 타일, 데이터)
├── 출력 생성 (GLTF, OBJ, JSON)
└── 검증 및 오류 처리
```

## 라이센스

이 JavaScript 포트는 원래 OSM2World 프로젝트와 동일한 LGPL-2.1 라이센스를 유지합니다.