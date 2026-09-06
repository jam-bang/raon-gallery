# 라온 갤러리 · Raon Gallery

**라온의 순간 — 응암2동 함께마당**

제8회 응암2동 주민총회 & 응암2동 함께마당에 참여한 라온태권도 시범단의 사진·영상 갤러리입니다.

## 기능

- 제공된 라온태권도장 로고를 사용한 헤더
- 무작위 하이라이트: 사진 2장(각 6초)과 무음 영상 1개(최대 9초)를 부드럽게 전환
- 하이라이트 일시정지·재개 및 이전·다음 이동. 화면 밖, 다른 탭, 모달이 열려 있을 때 자동 중지
- 동작 줄이기 설정에서는 하이라이트 자동 재생과 사진 확대 효과를 기본 중지
- 반응형 사진·영상 그리드와 전체 / 사진 / 영상 필터
- 사진 확대, 이전·다음 이동, 키보드 방향키, Esc 닫기, 사진 좌우 스와이프
- H.264/AAC 웹용 영상 미리보기와 재생 컨트롤
- 갤러리 접속 비밀번호 화면과 검색 엔진 수집 차단 설정
- AES-256 암호로 보호한 사진·영상 전체 ZIP, 사진 ZIP, 영상 ZIP 다운로드
- 공개 페이지에서는 개별 원본 다운로드를 숨겨 보호 ZIP을 거치도록 구성
- 프레임워크 및 프런트엔드 패키지 설치 없이 실행되는 HTML/CSS/JavaScript

## 실행

Node.js 20 이상에서 저장소 루트에서 실행합니다.

```sh
npm start
```

`http://127.0.0.1:4173`에서 확인합니다. HTML 파일을 직접 더블클릭하면 JSON 로딩이 브라우저에서 제한될 수 있으므로 HTTP 서버를 사용합니다.

저장소에는 웹용 사진·영상 미리보기가 포함됩니다. 다른 PC에서 복제해 실행하면 미리보기를 바로 볼 수 있습니다. 공개 페이지의 ZIP은 GitHub Release에서 내려받습니다.

## 사진·영상 가져오기

Python 3.10 이상과 Pillow, FFmpeg가 필요합니다.

```sh
python -m pip install -r requirements.txt
python scripts/prepare_media.py --source "../셀렉"
npm start
```

시스템 FFmpeg가 없다면 `imageio-ffmpeg`에 포함된 실행 파일을 사용합니다. 실행 파일을 직접 지정할 수도 있습니다.

```sh
python scripts/prepare_media.py --source "../셀렉" --ffmpeg "/path/to/ffmpeg"
```

사진을 편집하는 중이라면 `--snapshot` 옵션을 사용하세요. `.local/snapshots/`에 현재 선택의 작업용 복사본을 만든 뒤 처리하므로, 원본을 계속 저장해도 미리보기와 ZIP이 서로 일치합니다. 이 경우 원본 용량만큼의 추가 디스크 공간이 필요하며, 이전 작업용 복사본은 자동 삭제하지 않습니다.

```sh
python scripts/prepare_media.py --source "../셀렉" --snapshot
```

가져오기 스크립트는 다음 작업을 합니다.

1. 지정 폴더 바로 아래의 JPG/JPEG/PNG, MP4/MOV/M4V를 읽습니다. RAW 및 하위 폴더는 포함하지 않습니다.
2. 사진 방향을 보정한 뒤 최대 640px 썸네일과 1800px 미리보기를 생성합니다. 원본은 수정하지 않습니다.
3. 영상 썸네일과 최대 960px, 30fps H.264/AAC 미리보기를 만듭니다.
4. 사진·영상 전체 / 사진 / 영상 ZIP을 생성합니다. 원본과 영상은 이미 압축되어 있으므로 ZIP에 추가 압축 없이 저장합니다.
5. `public/gallery.json`과 Git에서 제외되는 `.local/source.json`을 생성합니다.

로컬 서버는 `.local/source.json`에 명시된 선택 파일만 원본 다운로드 경로로 제공합니다. 기본 모드는 원본을 프로젝트에 복제하지 않습니다. 영상 탐색과 다운로드 재개를 위한 HTTP Range를 지원합니다. 서버는 기본적으로 이 PC의 `127.0.0.1`에만 열립니다.

파일이 추가되거나 변경되면 가져오기를 다시 실행하세요. 완료된 미리보기는 크기·수정 시각 기준으로 재사용됩니다. ZIP은 현재 선택으로 다시 만듭니다. 제거한 항목의 예전 미리보기 파일은 자동 삭제하지 않으며 `gallery.json`에서 빠져 화면에 표시되지 않습니다. 공개 저장소에서 해당 파일 자체까지 제거하려면 별도로 정리해야 합니다.

## 공개 배포와 다운로드 보호

정적 웹 루트는 **`public/`** 입니다. 내부 주소는 상대 경로이므로 `/raon-gallery/` 같은 하위 경로에서도 동작합니다.

GitHub Pages는 `.github/workflows/pages.yml`로 배포합니다. 저장소의 Pages 소스를 **GitHub Actions**로 설정하면 `main`에 올릴 때 검사 후 `public/`만 자동 게시됩니다. 원본·ZIP·로컬 설정·도구 폴더는 Git에서 제외되어 Pages 배포에 포함되지 않습니다.

`public/auth.js`는 비밀번호 원문 대신 SHA-256 해시를 비교하고, 인증된 브라우저 탭에서만 갤러리 스크립트를 불러옵니다. 정적 페이지의 잠금 화면은 접근을 막는 1차 장치이며, 실제 원본은 AES-256 ZIP으로 한 번 더 보호합니다. ZIP 비밀번호는 갤러리 비밀번호와 같습니다.

`public/config.js`는 개별 원본 경로를 비워 두고 암호화 ZIP이 있는 GitHub Release만 연결합니다.

```js
window.RAON_CONFIG = {
  originalsBaseUrl: null,
  videosBaseUrl: 'media/videos',
  archivesBaseUrl: 'https://github.com/jeon-byeong-ik/raon-gallery/releases/download/eungam2-together-2026'
};
```

- `originalsBaseUrl`: 공개 페이지에서는 `null`로 유지해 개별 원본 링크를 만들지 않습니다.
- `videosBaseUrl`: 저장소에 포함된 웹용 영상 미리보기 경로입니다.
- `archivesBaseUrl`: 암호화 ZIP 세 개를 올린 GitHub Release 주소입니다.

ZIP은 WinZip AES-256 방식입니다. 운영체제 기본 압축 도구가 열지 못하면 7-Zip, 반디집, WinRAR처럼 AES ZIP을 지원하는 앱을 사용합니다.

원본, ZIP, 로컬 절대 경로, 도구 설치 폴더는 Git에서 제외합니다. 미리보기는 원본과 별개인 공개용 파생 파일이며 사진 EXIF와 영상 메타데이터를 복사하지 않습니다.

## 검증

```sh
npm run check
npm test
```

구문, 갤러리 목록과 사진 자산 존재 여부, HTTP Range, HEAD, 비공개 파일 차단을 확인합니다. 브라우저별 재생·모바일 실기기 확인은 별도로 수행합니다.

## 파일 구성

```text
public/
  index.html           페이지
  auth.js              접속 비밀번호 확인과 앱 로딩
  styles.css           화면·반응형 스타일
  cover.css            로고·하이라이트 스타일
  cover.js             하이라이트 자동 전환
  assets/raon-logo.png  제공된 도장 로고 원본
  app.js               갤러리·미리보기·다운로드 동작
  config.js            공개 저장 주소
  gallery.json         미디어 목록
  media/thumbs/        썸네일
  media/photos/        사진 미리보기
  media/videos/        영상 미리보기
  media/archives/      원본 ZIP (Git 제외)
scripts/
  prepare_media.py     미디어 가져오기
  serve.mjs            로컬 서버
  validate.mjs         갤러리 자산 검증
tests/
  server.test.mjs      HTTP 동작 검증
```

행사 사진과 영상에 대한 이용 권한은 별도입니다. 저장소의 미디어를 다른 용도로 사용하려면 제공자에게 문의해 주세요.
