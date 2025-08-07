---
title: "Python으로 AI 챗봇 만들기"
date: "2025-01-15"
category: "AI/ML"
tags: ["Python", "AI", "Chatbot", "OpenAI"]
excerpt: "OpenAI API를 활용하여 실용적인 AI 챗봇을 구현하는 과정을 단계별로 설명합니다."
readTime: "8분"
---

# Python으로 AI 챗봇 만들기

## 왜 챗봇을 만들어보고 싶었나?

사실 처음에는 '요즘 ChatGPT가 인기니까 나도 비슷한 걸 만들어볼까?' 하는 호기심에서 시작했다. 그런데 막상 해보니 생각보다 재밌더라. 특히 내가 원하는 방식으로 대화하는 AI를 만들 수 있다는 게 신기했다.

학교 과제할 때도 그냥 ChatGPT 쓰는 것보다, 내가 만든 챗봇이 내 스타일에 맞춰서 답해주면 더 좋을 것 같았다.

## 준비 단계 - 라이브러리 설치하기

일단 필요한 것들부터 깔아야 한다. 

```bash
pip install openai
pip install python-dotenv
pip install flask
```

openai는 당연히 OpenAI API 쓰려고, python-dotenv는 API 키 같은 걸 안전하게 관리하려고, flask는 나중에 웹으로 만들어보려고 설치했다.

## 기본 챗봇 만들어보기

### 환경 설정부터

```python
import openai
import os
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv('OPENAI_API_KEY')
```

API 키를 코드에 직접 적으면 나중에 깃허브에 올릴 때 위험하니까, .env 파일에 따로 저장해서 불러오는 방식을 썼다. 처음에는 이것도 몰라서 코드에 그냥 적었다가 나중에 바꿨다.

### 챗봇 클래스 만들기

```python
class MyAIChatbot:
    def __init__(self):
        self.chat_history = []  # 대화 기록 저장해두기
    
    def add_to_history(self, who_said_it, what_they_said):
        self.chat_history.append({
            "role": who_said_it,
            "content": what_they_said
        })
    
    def get_ai_response(self, user_input):
        # 사용자가 말한 거 기록에 추가
        self.add_to_history("user", user_input)
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=self.chat_history,
                max_tokens=150,  # 너무 길면 비용이...
                temperature=0.7  # 적당히 창의적으로
            )
            
            ai_response = response.choices[0].message.content
            self.add_to_history("assistant", ai_response)
            
            return ai_response
        except Exception as e:
            return f"앗, 뭔가 잘못됐네요: {str(e)}"
```

처음에 만들 때는 대화 기록을 저장하는 걸 깜빡했다. 그래서 AI가 앞에서 뭔 얘기했는지 기억을 못해서 대화가 이상했다. 나중에 chat_history를 추가하니까 훨씬 자연스러워졌다.

temperature는 여러 번 실험해봤는데, 0.7 정도가 적당한 것 같다. 너무 낮으면 재미없고, 너무 높으면 이상한 소리를 한다.

## 웹으로 만들어보자 - Flask 사용하기

터미널에서만 대화하는 것보다는 웹에서 할 수 있으면 더 좋을 것 같아서 Flask를 써봤다.

```python
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
my_chatbot = MyAIChatbot()

@app.route('/')
def main_page():
    return render_template('chat.html')

@app.route('/chat', methods=['POST'])
def chat_with_bot():
    user_message = request.json['message']
    bot_response = my_chatbot.get_ai_response(user_message)
    return jsonify({'response': bot_response})

if __name__ == '__main__':
    app.run(debug=True)
```

HTML 파일은 간단하게 만들었다. 채팅 인터페이스 같은 느낌으로.

```html
<!DOCTYPE html>
<html>
<head>
    <title>내가 만든 챗봇</title>
</head>
<body>
    <div id="chat-container">
        <div id="messages"></div>
        <input type="text" id="user-input" placeholder="메시지를 입력하세요...">
        <button onclick="sendMessage()">전송</button>
    </div>

    <script>
        function sendMessage() {
            const userInput = document.getElementById('user-input');
            const message = userInput.value;
            
            if(message.trim() === '') return;
            
            // 사용자 메시지 화면에 표시
            addMessageToChat('나', message);
            
            // AI에게 보내기
            fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({message: message})
            })
            .then(response => response.json())
            .then(data => {
                addMessageToChat('AI', data.response);
            });
            
            userInput.value = '';
        }
        
        function addMessageToChat(sender, message) {
            const messagesDiv = document.getElementById('messages');
            messagesDiv.innerHTML += `<p><strong>${sender}:</strong> ${message}</p>`;
        }
    </script>
</body>
</html>
```

첫 번째로 만든 웹 인터페이스는 정말 투박했다. 그냥 기능만 되게 만든 느낌이었는데, 그래도 작동하니까 뿌듯했다.

## 조금 더 똑똑하게 만들어보기

### 대화 맥락 관리하기

처음에는 무제한으로 대화 기록을 저장했는데, 그러다 보니 토큰 수가 계속 늘어나서 비용이 부담됐다. 그래서 최근 10개 정도만 기억하도록 바꿨다.

```python
class ImprovedChatbot:
    def __init__(self):
        self.chat_history = []
        self.max_history = 10  # 최근 10개 대화만 기억
    
    def manage_history(self):
        if len(self.chat_history) > self.max_history:
            # 가장 오래된 대화부터 삭제 (시스템 메시지는 유지)
            system_msgs = [msg for msg in self.chat_history if msg['role'] == 'system']
            recent_msgs = self.chat_history[-(self.max_history-len(system_msgs)):]
            self.chat_history = system_msgs + recent_msgs
```

### 감정 분석 넣어보기

사용자가 화나거나 슬플 때 그에 맞게 반응하면 더 좋을 것 같아서, 간단한 감정 분석을 넣어봤다.

```python
def analyze_emotion(self, text):
    # 간단한 키워드 기반 감정 분석
    positive_words = ['좋다', '행복', '기쁘다', '감사', '최고']
    negative_words = ['나쁘다', '슬프다', '화나다', '짜증', '최악']
    
    positive_count = sum(1 for word in positive_words if word in text)
    negative_count = sum(1 for word in negative_words if word in text)
    
    if positive_count > negative_count:
        return 'positive'
    elif negative_count > positive_count:
        return 'negative'
    else:
        return 'neutral'

def respond_with_emotion(self, user_input):
    emotion = self.analyze_emotion(user_input)
    
    if emotion == 'negative':
        # 조금 더 위로해주는 톤으로
        system_prompt = "사용자가 기분이 안 좋아 보이니 따뜻하고 위로가 되는 말투로 답변해줘."
    elif emotion == 'positive':
        # 함께 기뻐해주는 톤으로
        system_prompt = "사용자가 기분이 좋아 보이니 함께 기뻐하는 밝은 말투로 답변해줘."
    else:
        system_prompt = "평상시처럼 자연스럽게 답변해줘."
    
    # 시스템 프롬프트 추가해서 API 호출
    messages_with_emotion = [{"role": "system", "content": system_prompt}] + self.chat_history
    # ... API 호출 코드
```

### 개인화 기능

사용자가 자주 하는 질문이나 관심사를 기억해서, 그에 맞는 답변을 해주면 좋겠다고 생각했다.

```python
class PersonalizedBot:
    def __init__(self):
        self.user_preferences = {}
        self.frequent_topics = []
    
    def learn_about_user(self, user_input):
        # 사용자가 자주 언급하는 주제들 찾기
        keywords = self.extract_keywords(user_input)
        for keyword in keywords:
            if keyword in self.user_preferences:
                self.user_preferences[keyword] += 1
            else:
                self.user_preferences[keyword] = 1
    
    def get_personalized_response(self, user_input):
        self.learn_about_user(user_input)
        
        # 사용자 관심사 기반으로 시스템 프롬프트 조정
        top_interests = sorted(self.user_preferences.items(), 
                              key=lambda x: x[1], reverse=True)[:3]
        
        if top_interests:
            interests_text = ", ".join([interest[0] for interest in top_interests])
            system_prompt = f"사용자는 {interests_text}에 관심이 많습니다. 이를 고려해서 답변해주세요."
        else:
            system_prompt = "자연스럽게 답변해주세요."
        
        # ... 나머지 로직
```

## 해보면서 어려웠던 점들

### API 비용 관리

처음에는 신경 안 쓰고 막 써봤는데, 며칠 지나니까 비용이 꽤 나오더라. 그래서 토큰 수를 제한하고, 불필요한 API 호출을 줄이는 방법을 고민하게 됐다.

### 응답 속도

사용자가 메시지를 보내고 나서 AI가 답할 때까지 시간이 걸리는데, 이게 너무 오래 걸리면 답답하다. 특히 긴 대화 기록이 있을 때는 더 오래 걸렸다.

그래서 로딩 애니메이션을 넣거나, "생각 중..." 같은 메시지를 보여주는 걸로 사용자 경험을 개선했다.

### 이상한 답변 처리

가끔 AI가 정말 이상한 답변을 할 때가 있다. 특히 한국어로 대화할 때 어색한 표현을 쓰거나, 맥락을 이해하지 못할 때가 있었다.

완전히 해결하지는 못했지만, 시스템 프롬프트에 "자연스러운 한국어로 답변해줘"라고 명시하니까 좀 나아졌다.

## 지금까지 해보고 느낀 점

생각보다 간단하게 시작할 수 있어서 좋았다. OpenAI API 덕분에 복잡한 AI 모델을 직접 훈련할 필요 없이, 바로 결과를 볼 수 있어서 재밌었다.

하지만 정말 유용한 챗봇을 만들려면 단순히 API 연결하는 것 이상이 필요하다는 걸 깨달았다. 사용자 경험, 개인화, 비용 최적화 등 고려할 게 많다.

무엇보다 '왜 이 챗봇을 쓸까?'에 대한 명확한 목적이 있어야 한다는 걸 느꼈다. 그냥 ChatGPT랑 똑같은 걸 만들면 의미가 없으니까.

앞으로는 특정 용도(예: 공부 도우미, 일정 관리 등)에 특화된 챗봇을 만들어보고 싶다. 그리고 음성 인식이나 이미지 분석 같은 기능도 추가해보면 재밌을 것 같다.