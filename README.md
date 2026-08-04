# 결혼 축하 롤링페이퍼

이름과 메시지를 칸별로 남기는 롤링페이퍼. 서버에 저장되므로 **누가 남기든 모두에게 보입니다.**

## 로컬 실행

```bash
pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

http://localhost:8000 접속.

## 문구 바꾸기 (환경변수)

| 변수 | 기본값 |
| --- | --- |
| `PAPER_TITLE` | 결혼을 축하합니다 |
| `PAPER_SUBTITLE` | 두 사람의 새로운 시작에 따뜻한 한마디를 남겨주세요 |
| `PAPER_COUPLE` | (비어 있음) 예: `민수 ♥ 지은` |
| `PAPER_DATE` | (비어 있음) 예: `2026.10.17` |
| `DATA_DIR` | `./data` — SQLite 파일 위치 |

## 수정 권한

**따로 없습니다.** 카드의 `수정` 버튼을 누르면 누구나 어떤 메시지든 고치거나 지울 수 있습니다.
삭제할 때만 확인창이 한 번 뜹니다.

내가 이 브라우저에서 남긴 메시지에는 `내 메시지` 표시가 붙지만, 표시일 뿐 권한과는 무관합니다.

## Railway 배포

1. Railway에서 **New Project → Deploy from GitHub repo**로 이 저장소를 연결.
   빌드·실행 설정은 `railway.toml`에 있으니 따로 만질 것 없음.
2. 서비스 → **Variables**에서 `DATA_DIR = /data` 추가.
   원하면 `PAPER_COUPLE`, `PAPER_DATE`도 여기서 설정.
3. 서비스 → **Volumes → Add Volume**, 마운트 경로를 `/data`로 지정.
   (2번의 `DATA_DIR`와 반드시 같은 경로여야 함)
4. 서비스 → **Settings → Networking → Generate Domain**으로 주소 발급.

`DATA_DIR`나 볼륨이 빠지면 재배포할 때마다 축하 메시지가 전부 사라집니다.
설정이 누락된 경우 서버 시작 로그에 경고가 찍힙니다.

## Vercel은 안 되나요

안 됩니다. 서버리스 함수는 파일 시스템이 읽기 전용이고 `/tmp`는 인스턴스마다 따로
존재해서, SQLite에 쌓은 메시지가 다른 방문자에게 보이지 않고 수시로 사라집니다.
Vercel에 올리려면 Neon Postgres나 Turso 같은 외부 DB로 저장소를 바꿔야 합니다.
