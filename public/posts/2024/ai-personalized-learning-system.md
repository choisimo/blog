---
title: "AI 기반 맞춤형 학습 시스템 프로젝트"
date: "2024-02-15"
category: "AI"
tags: ['AI 교육', '맞춤형 학습', '간격 반복', '인출 연습', '이중부호화', '학습 시스템']
excerpt: "인간의 기억 메커니즘과 과학적 학습법을 AI 기술과 결합하여 개인화된 학습 경험을 제공하는 혁신적인 교육 시스템 설계."
readTime: "6분"
---

## 왜 이 프로젝트를 시작했나?

솔직히 말하면, 시험 기간마다 밤새워 벼락치기하면서도 금세 까먹는 내 자신을 보며 '이게 맞나?' 싶었다. 특히 전공 수업에서 배운 내용들이 다음 학기가 되면 기억이 가물가물해지는 게 너무 답답했다.

그러다가 인지과학 수업에서 배운 '간격 반복 학습'이나 '인출 연습' 같은 걸 듣고 '아, 이런 방법들을 AI로 자동화할 수 있지 않을까?' 생각하게 됐다. 사실 처음엔 그냥 내가 쓸 공부 도구를 만들어보자는 심정이었는데, 생각해보니 이런 고민을 하는 사람이 나만은 아닐 거라는 생각이 들었다.

## 내가 구상한 시스템 핵심 아이디어

### 1. 진짜로 '기억에 남는' 학습을 위한 AI 엔진

사실 이런 학습법들은 예전부터 있었던 건데, 문제는 이걸 혼자서 꾸준히 실천하기가 정말 어렵다는 거였다.

#### 간격 반복 학습 - 이제 알아서 해줘!

가장 먼저 구현해보고 싶었던 게 간격 반복 학습이었다. 에빙하우스 망각 곡선 같은 걸 배우면서 '아, 진짜로 이걸 활용해서 공부하면 좋겠다'고 생각했는데, 막상 손으로 하려니까 너무 번거로웠다.

```python
class SpacedRepetitionEngine:
    def __init__(self):
        self.user_memory_patterns = {}
        self.review_scheduler = ReviewScheduler()
    
    def calculate_next_review(self, concept_id, user_performance):
        # 사용자별로 기억 패턴이 다르니까 개인화해서 계산
        if user_performance > 0.8:
            interval = self.increase_interval(concept_id)
        else:
            interval = self.decrease_interval(concept_id)
        return interval
```

처음엔 단순하게 '정답률 높으면 간격 늘리고, 낮으면 줄이자' 정도로 생각했는데, 실제로 구현해보니 개인차가 생각보다 크더라. 어떤 사람은 수학은 잘 기억하는데 영단어는 자꾸 까먹고, 또 어떤 사람은 그 반대이고...

#### 인출 연습 - 그냥 읽기만 하면 안 된다는 걸 깨달았다

대학교 와서 가장 크게 깨달은 게, 교과서 여러 번 읽는다고 해서 시험을 잘 보는 게 아니라는 거였다. 실제로 문제를 풀어봐야 하고, 내가 정말 이해했는지 스스로 확인해봐야 한다는 걸 늦게나마 알게 됐다.

그래서 시스템이 알아서 내가 공부한 내용을 바탕으로 문제를 만들어주면 어떨까 생각했다.

**내가 생각한 구현 방식:**
- 내가 공부한 내용을 분석해서 자동으로 문제 만들어주기
- 틀린 문제는 다시 나중에 다른 방식으로 출제하기
- 내가 자주 틀리는 패턴을 찾아서 그 부분 집중 공략하기

처음에는 '그냥 GPT API 쓰면 되겠지' 생각했는데, 막상 해보니 단순히 "이 내용으로 문제 만들어줘" 하면 퀄리티가 들쭉날쭉하더라. 그래서 문제 유형별로 다른 프롬프트를 써야겠다고 생각했다.

#### 이중부호화 - 글자만 보면 졸린다

솔직히 나는 글자만 빽빽한 교재를 보면 집중이 잘 안 된다. 그림이나 도표가 있으면 훨씬 이해가 잘 되는 편이다. 이중부호화이론이라는 게 있다는 걸 알고 나서 '아, 이래서 내가 시각 자료를 선호하는구나' 싶었다.

그래서 텍스트로 된 내용을 자동으로 다이어그램이나 플로우차트로 만들어주는 기능을 넣고 싶었다. 물론 완벽하게는 안 되겠지만, 적어도 핵심 개념들을 정리해서 보여주는 정도는 할 수 있을 것 같았다.

### 2. 과목별로 다른 AI 에이전트들

처음에는 '하나의 AI로 모든 과목을 다 커버하면 되지 않을까' 생각했는데, 막상 생각해보니 수학이랑 국어랑 영어는 공부하는 방식이 완전히 다르다는 걸 깨달았다.

#### 수학 전용 AI

수학은 단계별로 풀이 과정을 보여주는 게 정말 중요하다. 특히 내가 어디서 틀렸는지 정확히 짚어줘야 한다.

```python
class MathAI:
    def __init__(self):
        self.step_analyzer = StepAnalyzer()
        self.problem_generator = MathProblemMaker()
        # 내가 자주 틀리는 유형들을 기억해두기
        self.mistake_tracker = MistakeTracker()
    
    def analyze_solution(self, problem, my_answer):
        # 어디서 틀렸는지 단계별로 찾아보기
        steps = self.step_analyzer.break_down(problem)
        for i, step in enumerate(steps):
            if not self.check_step_correct(step, my_answer):
                return f"{i+1}번째 단계에서 실수: {step.explanation}"
```

수학은 정말 '과정'이 중요한 것 같다. 답만 맞추는 게 아니라 왜 그렇게 되는지 이해해야 하니까. 그래서 AI가 내 풀이 과정을 단계별로 체크해주고, 어디서 놓쳤는지 알려주면 좋겠다고 생각했다.

#### 언어 학습 AI

영어 공부할 때 가장 어려운 게 '내가 정말 이 표현을 자연스럽게 쓸 수 있나?' 하는 부분이었다. 문법은 맞는데 뭔가 어색한 문장을 만들어낼 때가 많았다.

그래서 소크라테스식 질문법이라는 걸 써서, AI가 내가 왜 그렇게 답했는지 되물어보면서 스스로 생각하게 만드는 방식을 넣어보고 싶었다.

#### 과학 AI

과학은 암기보다는 '왜 그럴까?'하는 궁금증이 중요한 것 같다. 교과서에 나온 법칙들을 그냥 외우는 게 아니라, 실생활 예시와 연결해서 이해할 수 있게 도와주는 AI를 만들고 싶었다.

### 3. 문제 만들어주는 시스템

#### PDF 같은 파일들 분석하기

사실 이 부분이 기술적으로 가장 어려웠다. 교수님이 올려주신 PPT나 PDF를 보고 거기서 핵심 내용을 뽑아내는 게 쉽지 않더라.

```python
class DocumentAnalyzer:
    def __init__(self):
        self.ocr_reader = OCREngine()  # 이미지에서 글자 뽑아내기
        self.text_processor = TextProcessor()  # 글 내용 분석하기
        self.keyword_finder = KeywordExtractor()  # 중요한 단어들 찾기
    
    def analyze_my_study_materials(self, file_path):
        # 일단 파일에서 텍스트 추출
        raw_text = self.extract_text_from_file(file_path)
        
        # 중요해 보이는 부분들 찾기 (제목, 굵은 글씨, 하이라이트 등)
        important_parts = self.find_key_concepts(raw_text)
        
        # 이걸로 문제 만들 수 있을지 판단
        return self.create_practice_questions(important_parts)
```

처음에는 OCR만 쓰면 될 줄 알았는데, 실제로 해보니 PDF 레이아웃이 복잡하면 글자 순서가 엉망으로 나오더라. 특히 2단 레이아웃이나 표가 있으면 더 심했다. 그래서 단순히 텍스트만 뽑는 게 아니라 문서 구조도 함께 파악해야겠다고 생각했다.

#### 자동 태깅 - 문제 분류하기

YOLO 같은 객체 인식 기술을 참고해서, 문제를 보고 자동으로 "이건 미분 문제야", "이건 독해 문제야" 하고 분류해주는 시스템을 만들고 싶었다. 사실 처음에는 간단할 줄 알았는데, 문제 유형이 생각보다 다양하고 애매한 경우도 많더라.

그래서 사용자 피드백을 받아서 점점 정확해지도록 하는 방식으로 접근했다. "이 문제가 난이도 3이 맞나요?" 하고 물어봐서, 그 답변을 바탕으로 시스템이 학습하게 하는 거다.

#### 맞춤형 시험 시스템

```python
class PersonalizedTestEngine:
    def __init__(self):
        self.weakness_analyzer = WeaknessAnalyzer()
        self.question_selector = SmartQuestionPicker()
        # 내 실력 레벨 추적하기
        self.skill_tracker = SkillLevelTracker()
    
    def make_test_for_me(self, subject, time_limit):
        # 내가 약한 부분 위주로 문제 선별
        weak_areas = self.weakness_analyzer.find_my_weak_spots()
        
        # 시간 안에 풀 수 있을 만큼 적당한 난이도로
        questions = self.question_selector.pick_optimal_questions(
            weak_areas, my_current_level, time_limit
        )
        return questions
```

## 실제로 써봤을 때의 경험

### 맞춤형 학습 자료 만들기

#### PDF 자동 생성 - 내 약점만 모은 문제집

가장 뿌듯했던 기능 중 하나가 이거였다. 시스템이 내가 자주 틀리는 유형들을 분석해서, 그것만 모은 맞춤형 문제집을 PDF로 만들어주는 거였다.

```python
from reportlab.pdfgen import canvas

class MyPersonalPDFMaker:
    def make_custom_workbook(self, my_weak_areas):
        # 내 이름으로 된 문제집 만들기
        pdf_name = f"nodove_맞춤_문제집_{today}.pdf"
        
        # 내가 자주 틀리는 문제들만 골라서 담기
        targeted_problems = self.pick_problems_for_my_weakness(my_weak_areas)
        
        # 예쁘게 레이아웃해서 PDF로 저장
        self.make_nice_looking_pdf(targeted_problems, pdf_name)
        return pdf_name
```

처음에 이걸 써봤을 때 정말 신기했다. '어? 이 문제들이 진짜 내가 약한 부분들이네?' 하는 생각이 들었다. 물론 완벽하지는 않았지만, 적어도 내가 직접 문제를 골라서 정리하는 것보다는 훨씬 효율적이었다.

#### 실수 패턴 분석 - 내가 왜 자꾸 틀리는지 알게 됐다

사실 이 기능이 가장 도움이 됐다. 단순히 "틀렸다" 하고 끝나는 게 아니라, 왜 틀렸는지 패턴을 찾아주니까.

예를 들어, 수학에서 내가 항상 부호 실수를 한다든지, 영어에서 관사를 빼먹는다든지... 이런 걸 데이터로 보여주니까 '아, 나는 이런 실수를 자주 하는구나' 하고 자각하게 되더라.

#### 개념 연결 맵 - 뭔가 다 연결되어 있다는 걸 깨달았다

마인드맵 형태로 개념들 사이의 관계를 보여주는 기능도 넣었다. 처음에는 '그냥 예쁘게 보이라고 만든 건가?' 싶었는데, 막상 써보니 진짜 도움이 됐다.

특히 물리 공부할 때, 운동량-에너지-힘 이런 개념들이 어떻게 연결되는지 시각적으로 보니까 훨씬 이해가 잘 됐다.

### 대화형 AI와 공부하기

#### AI 튜터와 대화하면서 공부하기

```python
class MyAITutor:
    def chat_with_me(self, my_question):
        # 바로 답 알려주지 말고 힌트부터 주기
        hints = self.generate_socratic_hints(my_question)
        
        # 내가 답을 찾아갈 수 있도록 도와주기
        if self.am_i_on_right_track(my_response):
            return "좋아! 그럼 다음 단계는 뭘까?"
        else:
            return "음, 다시 생각해볼까? 이런 건 어때?"
```

이 기능 만들 때 가장 어려웠던 게, AI가 너무 친절해서 답을 바로 알려주려고 하는 거였다. 소크라테스식 질문법이라는 게 '질문으로 답하기'인데, 이걸 자연스럽게 구현하는 게 생각보다 어려웠다.

그래도 제대로 작동할 때는 정말 좋았다. 마치 옆에서 선배가 "이건 어떻게 생각해?" 하고 물어보는 느낌이었다.

#### 피드백 시스템 - 단순히 맞다/틀렸다가 아니라

기존 문제집들은 그냥 "정답: ③" 이런 식으로 끝나는데, 내 시스템은 왜 그게 답인지, 내가 왜 틀렸는지까지 설명해주려고 했다.

특히 내가 선택한 오답이 왜 틀렸는지 구체적으로 알려주는 부분이 유용했다. "너는 A를 선택했는데, 이건 B를 고려하지 않았기 때문이야" 이런 식으로.

#### 내 학습 패턴 분석 - 데이터로 보는 나의 공부

```python
import matplotlib.pyplot as plt

class MyStudyAnalytics:
    def show_my_study_pattern(self):
        # 내가 언제 집중이 잘 되는지
        best_time = self.find_my_peak_hours()
        
        # 어떤 과목이 강한지/약한지  
        subject_scores = self.analyze_my_performance()
        
        # 앞으로 어떻게 발전할 것 같은지 예측
        predicted_growth = self.predict_my_improvement()
        
        self.make_pretty_charts(best_time, subject_scores, predicted_growth)
```

이 기능이 생각보다 재밌었다. 내가 보통 밤에 공부를 잘한다고 생각했는데, 데이터를 보니까 실제로는 오후 2-4시가 가장 집중이 잘 되더라. 이런 걸 알고 나니까 공부 시간을 조정하게 됐다.

## 기술적으로 어려웠던 부분들

### AI 모델 선택하고 연결하기

#### 여러 AI 모델 조합해서 쓰기

```python
import openai
from transformers import pipeline

class MultipleAIManager:
    def __init__(self):
        self.gpt_client = openai.Client()  # 일반적인 대화용
        self.math_model = pipeline('text-generation', model='microsoft/DialoGPT-medium')  # 수학 특화
        self.science_model = pipeline('text-generation', model='allenai/scibert_scivocab_uncased')  # 과학 특화
    
    def pick_right_ai_for_task(self, subject, task_type):
        if subject == 'math':
            return self.math_model
        elif subject == 'science':  
            return self.science_model
        else:
            return self.gpt_client  # 기본값
```

처음에는 GPT 하나로 모든 걸 해결하려고 했는데, 막상 해보니 과목별로 특화된 모델을 쓰는 게 훨씬 좋더라. 특히 수학 문제 해설할 때는 수학 전용 모델이 단계별 설명을 훨씬 잘했다.

하지만 여러 모델을 동시에 관리하는 게 생각보다 복잡했다. 각각 API 형식도 다르고, 응답 속도도 달라서 사용자가 기다리는 시간을 맞추는 게 어려웠다.

#### 이미지 분석 - OCR이 생각보다 까다로웠다

문서에서 텍스트 뽑아내는 게 간단할 줄 알았는데, 실제로는 정말 까다로웠다. 특히 수학 수식이나 그래프가 섞여 있으면 OCR이 제대로 인식을 못하더라.

```python
import cv2
import pytesseract

class DocumentReader:
    def read_complex_document(self, image_path):
        # 이미지 전처리 (노이즈 제거, 대비 조정 등)
        img = cv2.imread(image_path)
        processed_img = self.preprocess_image(img)
        
        # 텍스트 영역과 그래프/수식 영역 구분하기
        text_regions = self.find_text_areas(processed_img)
        formula_regions = self.find_formula_areas(processed_img)
        
        # 각각 다른 방식으로 처리
        text_content = pytesseract.image_to_string(text_regions)
        formula_content = self.analyze_formulas(formula_regions)
        
        return self.combine_results(text_content, formula_content)
```

결국 수식은 별도로 처리하는 방식으로 가야겠다고 생각했다. 그런데 이것도 완벽하지는 않아서, 사용자가 직접 수정할 수 있는 기능을 넣었다.

### 사용자 인터페이스 만들기

#### React로 파일 업로드 만들기

사용자가 쉽게 자료를 올릴 수 있게 드래그 앤 드롭 기능을 넣고 싶었다.

```javascript
const FileUploader = () => {
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [analysisResult, setAnalysisResult] = useState(null);
    
    const handleDrop = async (files) => {
        // 파일들을 서버로 보내서 분석하기
        const formData = new FormData();
        files.forEach(file => formData.append('study_materials', file));
        
        try {
            const response = await fetch('/api/analyze-my-documents', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            setAnalysisResult(result);
            
            // 사용자에게 "분석 완료!" 알려주기
            alert('자료 분석이 완료됐어요!');
        } catch (error) {
            alert('어? 뭔가 잘못됐네요. 다시 해볼까요?');
        }
    };
    
    return (
        <div 
            onDrop={handleDrop}
            className="upload-area"
        >
            여기에 PDF나 이미지를 끌어다 놓으세요!
            {analysisResult && <ResultDisplay data={analysisResult} />}
        </div>
    );
};
```

UI 만들 때 가장 신경 쓴 부분이 "사용하기 쉬워야 한다"는 거였다. 복잡한 설정 없이 그냥 파일만 끌어다 놓으면 알아서 분석해주도록 했다.

#### 학습 현황 대시보드

내 공부 상황을 한눈에 볼 수 있는 대시보드를 만들고 싶었다. 하지만 너무 복잡하면 오히려 헷갈릴 것 같아서, 정말 필요한 정보만 보여주려고 했다.

## 추가로 넣고 싶었던 기능들

### 친구들과 함께 공부하기

혼자 공부하는 것도 좋지만, 가끔은 친구들과 함께 하면 더 재밌을 것 같았다. 서로 문제집을 공유하거나, 같이 문제를 풀어보는 기능을 넣으면 어떨까 생각했다.

### 음성으로 공부하기

```python
import speech_recognition as sr
from gtts import gTTS

class VoiceStudyHelper:
    def listen_to_my_question(self):
        # 내가 말하는 걸 텍스트로 변환
        r = sr.Recognizer()
        with sr.Microphone() as source:
            audio = r.listen(source)
            
        try:
            question = r.recognize_google(audio, language='ko-KR')
            return self.process_voice_question(question)
        except:
            return "잘 안 들렸어요. 다시 말해주세요!"
    
    def speak_answer(self, answer_text):
        # AI 답변을 음성으로 들려주기
        tts = gTTS(text=answer_text, lang='ko')
        tts.save("answer.mp3")
        # mp3 파일 재생하기
```

특히 영어 공부할 때 발음 연습도 같이 할 수 있으면 좋겠다고 생각했다. 하지만 음성 인식 정확도가 아직 완벽하지 않아서, 나중에 기술이 더 발전하면 제대로 구현해보고 싶다.

### AI 공부 코치

단순히 문제만 내주는 게 아니라, 내 공부 습관까지 분석해서 조언해주는 AI 코치가 있으면 어떨까 생각했다.

"너는 보통 밤에 집중이 잘 안 되니까, 오후에 어려운 과목을 먼저 하는 게 어때?" 이런 식으로 말이다.

## 지금까지 해보고 느낀 점

사실 이 프로젝트를 시작할 때는 '그냥 내가 쓸 공부 도구 하나 만들어보자' 정도였는데, 막상 해보니 생각보다 복잡한 문제들이 많았다.

기술적인 부분도 어려웠지만, 가장 어려웠던 건 '정말로 도움이 되는 기능'과 '그냥 있으면 좋을 것 같은 기능'을 구분하는 거였다. 처음에는 이것저것 다 넣고 싶었는데, 실제로 써보니 정말 필요한 기능은 생각보다 많지 않더라.

간격 반복 학습이나 인출 연습 같은 과학적으로 검증된 방법들을 AI로 자동화하는 게 핵심이고, 나머지는 부가적인 기능이라는 걸 깨달았다.

그리고 무엇보다, 아무리 좋은 시스템이라도 결국 '꾸준히 쓰는 게' 가장 중요하다는 걸 느꼈다. 기술이 공부를 대신해주는 건 아니니까.

앞으로도 계속 개선해나가면서, 실제로 학습에 도움이 되는 도구로 발전시켜보고 싶다. 특히 다른 학생들도 함께 쓸 수 있게 해서, 서로의 피드백을 받으며 더 나은 시스템을 만들어가고 싶다.