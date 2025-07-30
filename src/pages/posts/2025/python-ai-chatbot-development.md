---
title: "Python으로 AI 챗봇 만들기"
date: "2025-01-15"
category: "AI/ML"
tags: ["Python", "AI", "Chatbot", "OpenAI"]
excerpt: "OpenAI API를 활용하여 실용적인 AI 챗봇을 구현하는 과정을 단계별로 설명합니다."
readTime: "8분"
---

# Python으로 AI 챗봇 만들기

## 개요

이 튜토리얼에서는 Python과 OpenAI API를 사용하여 간단하지만 효과적인 AI 챗봇을 만드는 방법을 알아보겠습니다.

## 필요한 라이브러리 설치

```bash
pip install openai
pip install python-dotenv
pip install flask
```

## 기본 챗봇 구현

### 1. 환경 설정

```python
import openai
import os
from dotenv import load_dotenv

load_dotenv()
openai.api_key = os.getenv('OPENAI_API_KEY')
```

### 2. 챗봇 클래스 생성

```python
class AIChatbot:
    def __init__(self):
        self.conversation_history = []
    
    def add_message(self, role, content):
        self.conversation_history.append({
            "role": role,
            "content": content
        })
    
    def get_response(self, user_input):
        self.add_message("user", user_input)
        
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=self.conversation_history,
                max_tokens=150,
                temperature=0.7
            )
            
            bot_response = response.choices[0].message.content
            self.add_message("assistant", bot_response)
            
            return bot_response
        except Exception as e:
            return f"오류가 발생했습니다: {str(e)}"
```

## 웹 인터페이스 추가

Flask를 사용하여 웹 인터페이스를 만들어보겠습니다.

```python
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
chatbot = AIChatbot()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json['message']
    bot_response = chatbot.get_response(user_message)
    return jsonify({'response': bot_response})

if __name__ == '__main__':
    app.run(debug=True)
```

## 고급 기능 추가

### 1. 컨텍스트 관리
대화의 맥락을 유지하기 위해 히스토리를 관리합니다.

### 2. 감정 분석
사용자의 감정을 분석하여 적절한 응답을 생성합니다.

### 3. 개인화
사용자별 선호도를 학습하여 맞춤형 응답을 제공합니다.

## 결론

Python과 OpenAI API를 활용하면 강력한 AI 챗봇을 쉽게 구현할 수 있습니다. 기본 기능에서 시작하여 점진적으로 고급 기능을 추가해 나가는 것이 좋습니다.