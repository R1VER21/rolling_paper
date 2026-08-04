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

- 메시지를 남길 때 **숫자 4자리 비밀번호**를 정합니다.
- 같은 브라우저에서는 비밀번호 없이 바로 수정·삭제할 수 있습니다 (localStorage 토큰).
- 다른 기기·브라우저에서는 비밀번호를 입력하면 수정·삭제됩니다.

## Railway 배포

1. 이 폴더를 깃 저장소로 올리고 Railway에서 연결.
2. `railway.toml`의 startCommand 그대로 사용.
3. **Volume을 반드시 붙이고** `DATA_DIR`를 그 마운트 경로(예: `/data`)로 설정.
   볼륨이 없으면 재배포할 때마다 메시지가 사라집니다.
