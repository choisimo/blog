---
title: "텍스트·이미지·영상을 함께 쓰는 추천 시스템 설계"
date: "2024-09-20"
category: "AI"
tags: ['추천 시스템', '다중 모달', 'Word2Vec', 'CNN', 'LSTM', '협업 필터링', '딥러닝']
excerpt: "콘텐츠별 특징 추출, 추천 후보 생성, 사용자 피드백을 연결하는 설계와 검증할 항목을 정리했다."
readTime: "4분"
---

## 어떤 데이터를 추천에 사용할 것인가

웹 페이지에는 본문뿐 아니라 이미지와 영상도 섞여 있다. 텍스트가 짧거나 없는 콘텐츠까지 추천하려면, 각 형식에서 어떤 특징을 추출하고 사용자 이력과 어떻게 연결할지 정해야 한다.

이 글은 그 처리 흐름을 정리한 설계 노트다. 모델별 선택지와 연결 방식을 다루며, 구현·성능 검증이 끝난 시스템을 보고하는 글은 아니다.

## 콘텐츠 형식별 특징 추출

### 텍스트 기반 콘텐츠 분석

```diagram
{
  "title": "텍스트에서 추천 후보까지",
  "kind": "flow",
  "nodes": [
    {
      "id": "text",
      "label": "웹 페이지 텍스트",
      "detail": "본문과 사용자 검색 이력을 입력으로 사용한다."
    },
    {
      "id": "tokens",
      "label": "토큰화",
      "detail": "본문을 분석에 사용할 토큰으로 나눈다."
    },
    {
      "id": "embedding",
      "label": "텍스트 벡터 표현",
      "items": [
        "TF-IDF",
        "Word2Vec"
      ]
    },
    {
      "id": "lsa",
      "label": "잠재 의미 분석",
      "detail": "TF-IDF 행렬에 LSA를 적용해 표현 차원을 줄이는 경로다."
    },
    {
      "id": "similarity",
      "label": "검색 이력과 비교",
      "detail": "같은 표현 공간에서 코사인 유사도를 계산한다."
    }
  ],
  "edges": [
    {
      "to": "tokens",
      "from": "text"
    },
    {
      "to": "embedding",
      "from": "tokens"
    },
    {
      "to": "lsa",
      "from": "embedding",
      "label": "TF-IDF 경로"
    },
    {
      "to": "similarity",
      "from": "lsa"
    },
    {
      "to": "similarity",
      "from": "embedding",
      "label": "Word2Vec 경로"
    }
  ],
  "caption": "텍스트 표현 방식에 따라 분석 경로를 선택한다."
}
```

텍스트 경로에서는 문서의 표현 방식부터 선택한다. TF-IDF와 LSA를 쓸지, Word2Vec으로 단어를 임베딩한 뒤 문서 단위로 모을지 비교할 수 있다. 주제 분류가 필요하면 N-그램 특징과 LDA도 검토한다. 세션 이력을 반영하는 가중치는 고정값을 기준선으로 둔 뒤 조정 효과를 확인한다.

### 이미지 기반 콘텐츠 분석

```diagram
{
  "title": "이미지 특징과 행동 로그 결합",
  "kind": "flow",
  "nodes": [
    {
      "id": "image",
      "label": "이미지 입력",
      "items": [
        "이미지 파일",
        "EXIF 메타데이터"
      ]
    },
    {
      "id": "cnn",
      "label": "CNN 특징 추출",
      "items": [
        "VGG16 또는 ResNet"
      ]
    },
    {
      "id": "index",
      "label": "특징 벡터 저장",
      "detail": "검색할 이미지 벡터를 같은 표현 공간에 저장한다."
    },
    {
      "id": "search",
      "label": "유사 이미지 검색",
      "detail": "유클리드 거리로 가까운 후보를 찾는다."
    },
    {
      "id": "behavior",
      "label": "사용자 반응 반영",
      "items": [
        "클릭 스트림",
        "확대·축소 시간"
      ]
    }
  ],
  "edges": [
    {
      "to": "cnn",
      "from": "image"
    },
    {
      "to": "index",
      "from": "cnn"
    },
    {
      "to": "search",
      "from": "index"
    },
    {
      "to": "behavior",
      "from": "search"
    }
  ]
}
```

이미지에서는 CNN 특징을 검색에 쓰고, EXIF 같은 메타데이터를 보조 정보로 검토한다. 클릭이나 확대·축소 시간은 이미지 자체의 특징과 구분해 저장한다. 시간 순서가 추천에 도움이 되는지 확인한 뒤 LSTM 같은 시퀀스 모델의 도입 여부를 판단한다.

### 영상 기반 콘텐츠 분석

```diagram
{
  "title": "영상의 시각·음성 정보 처리",
  "kind": "structure",
  "nodes": [
    {
      "id": "video",
      "label": "영상 입력"
    },
    {
      "id": "frames",
      "label": "프레임 샘플링",
      "items": [
        "키프레임 특징 추출",
        "3D CNN 동작 패턴 분석"
      ]
    },
    {
      "id": "audio",
      "label": "음성 전사",
      "items": [
        "오디오 트랜스크립트",
        "텍스트 임베딩"
      ]
    },
    {
      "id": "merge",
      "label": "특징 결합",
      "detail": "시각 특징과 텍스트 표현을 추천 모델에 전달한다."
    },
    {
      "id": "feedback",
      "label": "시청 반응 반영",
      "items": [
        "시청 완료율",
        "피드백에 따른 가중치 조정"
      ]
    }
  ],
  "edges": [
    {
      "to": "frames",
      "from": "video"
    },
    {
      "to": "audio",
      "from": "video"
    },
    {
      "to": "merge",
      "from": "frames"
    },
    {
      "to": "merge",
      "from": "audio"
    },
    {
      "to": "feedback",
      "from": "merge"
    }
  ],
  "caption": "프레임 분석과 음성 처리는 별도 경로로 진행한 뒤 결합한다."
}
```

영상은 프레임과 음성을 따로 처리한 뒤 결과를 결합한다. 동작 정보를 다루는 후보로는 3D CNN과 TSM(Temporal Shift Module)을 검토한다. 시청 완료율을 피드백에 쓰더라도 영상 길이와 노출 위치를 함께 기록해야 결과를 비교하기 쉽다.

## 구현 도구와 예제

### Surprise: 평점 예측 기준선

사용자·아이템·평점 데이터가 있다면 SVD 모델을 기준선으로 둘 수 있다. 아래 예제는 헤더가 없는 `ratings.csv`를 읽고 학습용과 평가용으로 나눈다. 파일의 각 행은 `user,item,rating` 순서이며 평점 범위는 1~5다.

```python
from surprise import Dataset, Reader, SVD, accuracy
from surprise.model_selection import train_test_split

reader = Reader(line_format="user item rating", sep=",", rating_scale=(1, 5))
data = Dataset.load_from_file("ratings.csv", reader=reader)
trainset, testset = train_test_split(data, test_size=0.2, random_state=42)
model = SVD(n_factors=100, n_epochs=20, random_state=42)
model.fit(trainset)
predictions = model.test(testset)
accuracy.rmse(predictions)
```

입력은 사용자·아이템 쌍이고 출력은 예측 평점이다. 여기서 계산한 RMSE와 추천 목록의 품질은 구분해서 평가한다. 데이터 로딩과 분할 방식은 [Surprise 시작 문서](https://surprise.readthedocs.io/en/stable/getting_started.html)를 참고했다.

### RecBole: 같은 조건에서 모델 비교

RecBole은 데이터 형식과 학습 설정을 맞춰 여러 추천 모델을 비교할 때 사용할 수 있다. 먼저 BPR 모델과 MovieLens 100K 데이터셋으로 실행 경로를 확인하는 예다.

```python
from recbole.quick_start import run_recbole

run_recbole(model="BPR", dataset="ml-100k")
```

자체 데이터를 사용할 때는 `.inter`, `.user`, `.item` 파일의 필드와 설정을 맞춘다. 실행 환경과 설정 방법은 [RecBole 시작 문서](https://recbole.io/docs/get_started/started/general.html)에 정리되어 있다.

### TensorFlow Recommenders: 사용자·아이템 표현 학습

TensorFlow Recommenders의 검색 모델은 사용자와 아이템을 각각 임베딩하고 두 표현을 비교한다. 모델을 구현할 때는 인코더, 검색 손실, 평가용 후보 집합을 함께 정의한다. `tfrs.Model`을 상속하고 `compute_loss`를 구현하는 전체 예제는 [공식 영화 검색 튜토리얼](https://www.tensorflow.org/recommenders/examples/basic_retrieval)을 따른다.

세 도구를 한꺼번에 연결하기보다는 평점 예측이나 후보 검색 중 하나를 먼저 기준선으로 잡는다. 데이터 분할과 평가 지표를 고정해야 모델을 바꾼 효과를 비교할 수 있다.

## 수집부터 피드백까지 연결하기

```diagram
{
  "title": "추천 엔진 처리 흐름",
  "kind": "flow",
  "nodes": [
    {
      "id": "collect",
      "label": "데이터 수집",
      "detail": "무엇을 보았고 어떻게 반응했는지 기록한다.",
      "items": [
        "사용자 행동 로그",
        "콘텐츠 메타데이터",
        "실시간 상호작용 스트림"
      ]
    },
    {
      "id": "features",
      "label": "특징 공학",
      "detail": "종류가 다른 콘텐츠를 모델이 비교할 수 있는 특징으로 바꾼다.",
      "items": [
        "텍스트 · BERT 임베딩",
        "이미지 · CNN 특징 추출",
        "영상 · 키프레임 샘플링"
      ]
    },
    {
      "id": "models",
      "label": "모델 연계",
      "detail": "행동 이력과 콘텐츠 특징을 사용해 추천 후보를 만든다.",
      "items": [
        "협업 필터링 · SVD",
        "콘텐츠 기반 · Word2Vec",
        "하이브리드 · NeuMF"
      ]
    },
    {
      "id": "ranking",
      "label": "추천 생성",
      "detail": "후보의 순서를 정하고 추천 결과를 평가한다.",
      "items": [
        "다단계 순위 결정",
        "다양성 제어 · MMR",
        "A/B 테스트"
      ]
    },
    {
      "id": "feedback",
      "label": "피드백 루프",
      "detail": "추천 이후의 반응을 다음 추천에 반영한다.",
      "items": [
        "암시적 피드백 · 시청 시간",
        "명시적 피드백 · 좋아요",
        "사용자 설문 조사"
      ]
    }
  ],
  "edges": [
    {
      "to": "features",
      "from": "collect"
    },
    {
      "to": "models",
      "from": "features"
    },
    {
      "to": "ranking",
      "from": "models"
    },
    {
      "to": "feedback",
      "from": "ranking"
    },
    {
      "to": "collect",
      "from": "feedback",
      "label": "반응 재수집"
    }
  ],
  "caption": "수집부터 추천까지 다섯 단계. 마지막 단계에서 얻은 반응은 다시 입력 데이터로 돌아간다."
}
```

## 추천 정책을 나누는 기준

```diagram
{
  "title": "추천 정책을 나누는 세 가지 기준",
  "kind": "compare",
  "nodes": [
    {
      "id": "type",
      "label": "콘텐츠 유형",
      "items": [
        "텍스트 · TF-IDF + LSA",
        "이미지 · CNN 특징 매칭",
        "영상 · 프레임 분석 + 음성 처리"
      ]
    },
    {
      "id": "user",
      "label": "사용자 이력",
      "items": [
        "신규 사용자 · 인기 급상승 콘텐츠",
        "기존 사용자 · 행동 이력 기반"
      ]
    },
    {
      "id": "device",
      "label": "디바이스 환경",
      "items": [
        "모바일 · 짧은 형식 콘텐츠",
        "데스크톱 · 심층 분석 콘텐츠"
      ]
    }
  ],
  "edges": [],
  "caption": "이 글에서 검토하는 정책 예시다. 기기만으로 취향을 단정하지 않고 실제 반응과 함께 평가한다."
}
```

## Word2Vec과 벡터 검색의 병목 확인

### 프로세스와 큐의 경계

```diagram
{
  "title": "프로세스를 분리한 벡터 검색 파이프라인",
  "kind": "flow",
  "nodes": [
    {
      "id": "raw",
      "label": "원시 텍스트"
    },
    {
      "id": "token",
      "label": "토큰화"
    },
    {
      "id": "embed",
      "label": "Word2Vec 임베딩"
    },
    {
      "id": "index",
      "label": "벡터 인덱싱 DB"
    },
    {
      "id": "cosine",
      "label": "코사인 유사도 계산"
    }
  ],
  "edges": [
    {
      "to": "token",
      "from": "raw"
    },
    {
      "to": "embed",
      "from": "token",
      "label": "IPC Queue 1"
    },
    {
      "to": "index",
      "from": "embed"
    },
    {
      "to": "cosine",
      "from": "index",
      "label": "IPC Queue 2"
    }
  ],
  "caption": "단계 사이의 데이터 전달을 큐로 분리하는 설계 예시다. 큐 경계와 워커 수는 실제 병목 측정 후 정한다."
}
```

토큰화, 임베딩, 검색을 별도 프로세스로 나누면 워커 수를 각각 조절할 수 있다. 다만 큐에 데이터를 넣고 꺼내는 비용도 생긴다. 먼저 단계별 처리 시간과 큐 대기 시간을 측정하고, 느린 단계부터 분리한다.

### Word2Vec 학습 설정

`sentences`는 토큰 목록으로 구성된 문장들의 모음이다. 아래 값은 실험을 시작하기 위한 설정 예이며, 최적값을 뜻하지 않는다. 파라미터의 의미는 [Gensim Word2Vec 문서](https://radimrehurek.com/gensim/models/word2vec.html)를 참고한다.

```python
from gensim.models import Word2Vec

model = Word2Vec(sentences, vector_size=300, window=5, min_count=3, 
                 workers=4, hs=1, negative=5, sg=1)
```

- `hs=1`: 계층적 소프트맥스 활성화
- `negative=5`: 부정 샘플링 적용
- `sg=1`: Skip-Gram 모드 선택

### 여러 후보와 유사도 비교

```python
import numpy as np

def batch_cosine_sim(vec, matrix):
    norm_vec = np.linalg.norm(vec)
    norms_matrix = np.linalg.norm(matrix, axis=1)
    return np.dot(matrix, vec) / (norm_vec * norms_matrix)
```

이 예제는 쿼리 벡터와 후보 행렬의 차원이 같고, 모든 벡터의 크기가 0보다 큰 경우를 가정한다. 실제 데이터에서는 영벡터 처리 정책도 정해야 한다. 실행 시간은 벡터 수·차원·자료형·하드웨어에 따라 따로 측정한다.

## 성능을 비교하기 전에 정할 것

기존 초안에는 지연 시간, 처리량 증가율, 정확도 수치가 있었지만 데이터셋·실행 환경·평가 방법이 함께 남아 있지 않았다. 이 수치들을 검증된 결과로 인용하기는 어렵다. 대신 다음 조건을 기록한 뒤 기준선과 변경 모델을 비교한다.

| 비교 대상 | 기록할 지표 | 함께 고정할 조건 |
|:--|:--|:--|
| 토큰화 | 초당 문서 수, 문서별 처리 시간 | 문서 길이, 토크나이저, 워커 수 |
| 임베딩 | 초당 벡터 수, 메모리 사용량 | 모델, 차원, 배치 크기 |
| 후보 검색 | 쿼리 지연 시간의 중앙값·상위 백분위 | 후보 수, 인덱스, 하드웨어 |
| 추천 목록 | Recall@K, NDCG@K 등 선택한 지표 | 데이터 분할, K, 신규 사용자 비율 |
| IPC 분리 | 전체 처리량, 큐 대기 시간 | 동일 입력, 프로세스 수, 전달 형식 |

## 다음 실험 범위

먼저 텍스트와 행동 이력만으로 추천 기준선을 만든다. 그다음 이미지 또는 영상 특징을 하나씩 추가하고, 추천 품질의 변화와 처리 비용을 함께 비교한다. 신규 사용자와 이력이 충분한 사용자는 나누어 평가한다.

피드백을 학습에 반영하는 주기도 별도 실험 대상이다. 모든 이벤트를 즉시 반영해야 하는지, 일정 주기로 모아 처리해도 되는지부터 확인한다. 복잡한 모델을 추가하는 결정은 이 비교 결과 뒤에 둔다.
