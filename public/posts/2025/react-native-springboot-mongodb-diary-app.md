---
title: "React Native + Spring Boot + MongoDB로 일기 앱 만들기"
date: "2025-01-24"
category: "개발"
tags: ['React Native', 'Spring Boot', 'MongoDB', 'Python', 'AI', '일기앱']
excerpt: "React Native 클라이언트와 Spring Boot 백엔드, Python AI 서버를 연동해서 일기 앱을 만든 경험"
readTime: "6분"
---

최근에 CBT 일기 앱을 만들면서 여러 기술을 조합해봤다. React Native로 앱을 만들고, Spring Boot로 API 서버를 구축하고, Python으로 AI 분석 서버까지 연동했다. 생각보다 복잡했지만 재미있는 경험이었다.

## 전체 아키텍처

### 기술 스택
- **클라이언트**: React Native
- **인증/API 서버**: Spring Boot + MariaDB
- **AI 분석 서버**: Python (FastAPI) + OpenAI API
- **캐시**: Redis (토큰 관리)

### 왜 이런 구조로?

처음엔 단순하게 Node.js로 다 만들려고 했는데, AI 분석 부분은 Python이 훨씬 편했다. Spring Boot는 회사에서 쓰던 거라 익숙해서 선택했다.

MongoDB 대신 MariaDB를 쓴 이유는 일기 데이터가 정형化된 구조를 가지고 있어서 관계형 DB가 더 적합하다고 판단했기 때문이다.

## 주요 기능별 구현

### 1. 사용자 인증

가장 기본적인 회원가입/로그인 부터 시작했다.

**회원가입 플로우:**
```javascript
// React Native 클라이언트
const signUp = async (email, password, name) => {
  try {
    const response = await fetch(`${API_BASE}/api/users/join`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, password, name})
    });
    
    if (response.status === 409) {
      alert('이미 사용 중인 이메일입니다');
      return;
    }
    
    // 성공 처리
  } catch (error) {
    console.error('회원가입 실패:', error);
  }
};
```

**Spring Boot 컨트롤러:**
```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    
    @PostMapping("/join")
    public ResponseEntity<?> join(@RequestBody SignUpRequest request) {
        // 이메일 중복 체크
        if (userService.existsByEmail(request.getEmail())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("이미 사용 중인 이메일");
        }
        
        // 비밀번호 암호화
        String encodedPassword = passwordEncoder.encode(request.getPassword());
        
        // 사용자 저장
        User user = User.builder()
            .email(request.getEmail())
            .password(encodedPassword)
            .name(request.getName())
            .build();
            
        userService.save(user);
        
        return ResponseEntity.status(HttpStatus.CREATED).body("회원가입 완료");
    }
}
```

### 2. JWT 토큰 관리

토큰은 Redis에 저장해서 관리했다. Access Token은 짧게, Refresh Token은 길게 설정했다.

```java
@Service
public class AuthService {
    
    public AuthResponse login(String email, String password) {
        // 사용자 인증
        User user = authenticateUser(email, password);
        
        // 토큰 생성
        String accessToken = jwtUtil.generateAccessToken(user.getEmail());
        String refreshToken = jwtUtil.generateRefreshToken(user.getEmail());
        
        // Redis에 Refresh Token 저장
        redisTemplate.opsForValue().set(
            "refresh:" + user.getEmail(), 
            refreshToken, 
            Duration.ofDays(7)
        );
        
        return AuthResponse.builder()
            .accessToken(accessToken)
            .refreshToken(refreshToken)
            .user(user)
            .build();
    }
}
```

### 3. 일기 작성과 AI 분석

가장 핵심 기능이다. 사용자가 일기를 쓰면 비동기로 AI 분석을 요청한다.

**일기 저장 API:**
```java
@PostMapping("/api/diary")
public ResponseEntity<?> createDiary(@RequestBody DiaryRequest request) {
    // 1. 일기 저장
    Diary diary = Diary.builder()
        .title(request.getTitle())
        .content(request.getContent())
        .weather(request.getWeather())
        .userId(getCurrentUserId())
        .build();
        
    diary = diaryService.save(diary);
    
    // 2. AI 분석 비동기 요청
    CompletableFuture.runAsync(() -> {
        requestAIAnalysis(diary);
    });
    
    return ResponseEntity.ok(diary);
}

private void requestAIAnalysis(Diary diary) {
    try {
        // Python AI 서버로 요청
        RestTemplate restTemplate = new RestTemplate();
        
        Map<String, String> request = Map.of("text", diary.getContent());
        
        ResponseEntity<AnalysisResponse> response = restTemplate.postForEntity(
            aiServerUrl + "/analyze", 
            request, 
            AnalysisResponse.class
        );
        
        // 분석 결과 저장
        if (response.getStatusCode().is2xxSuccessful()) {
            Report report = Report.builder()
                .emotion(response.getBody().getEmotion())
                .keywords(response.getBody().getKeywords())
                .advice(response.getBody().getAdvice())
                .build();
                
            report = reportService.save(report);
            
            // 일기와 연결
            diary.setReportId(report.getId());
            diaryService.save(diary);
        }
        
    } catch (Exception e) {
        log.error("AI 분석 실패: {}", e.getMessage());
    }
}
```

**Python AI 서버:**
```python
from fastapi import FastAPI
import openai

app = FastAPI()

@app.post("/analyze")
async def analyze_diary(request: AnalysisRequest):
    try:
        # OpenAI API 호출
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system", 
                    "content": "당신은 심리 상담사입니다. 일기 내용을 분석해서 감정, 키워드, 조언을 JSON 형태로 제공해주세요."
                },
                {
                    "role": "user", 
                    "content": request.text
                }
            ]
        )
        
        # 결과 파싱
        result = json.loads(response.choices[0].message.content)
        
        return AnalysisResponse(
            emotion=result.get('emotion', '중립'),
            keywords=result.get('keywords', []),
            advice=result.get('advice', '오늘도 고생하셨습니다.')
        )
        
    except Exception as e:
        return {"error": str(e)}
```

### 4. 일기 조회

날짜별로 일기를 조회할 수 있게 했다.

```java
@GetMapping("/api/diary/calendar")
public ResponseEntity<?> getDiariesByDate(@RequestParam String date) {
    List<Diary> diaries = diaryService.findByUserIdAndDate(
        getCurrentUserId(), 
        LocalDate.parse(date)
    );
    
    return ResponseEntity.ok(diaries);
}

@GetMapping("/api/diary/{diaryId}")
public ResponseEntity<?> getDiaryDetail(@PathVariable Long diaryId) {
    // 일기와 AI 분석 결과를 함께 조회
    DiaryDetailResponse response = diaryService.getDiaryWithReport(diaryId);
    
    return ResponseEntity.ok(response);
}
```

**JPA Repository:**
```java
@Repository
public interface DiaryRepository extends JpaRepository<Diary, Long> {
    
    @Query("SELECT d FROM Diary d WHERE d.userId = :userId AND DATE(d.createdAt) = :date ORDER BY d.createdAt DESC")
    List<Diary> findByUserIdAndDate(@Param("userId") Long userId, @Param("date") LocalDate date);
    
    @Query("SELECT d FROM Diary d LEFT JOIN FETCH Report r ON d.reportId = r.id WHERE d.id = :diaryId")
    Optional<DiaryWithReport> findDiaryWithReport(@Param("diaryId") Long diaryId);
}
```

## React Native 클라이언트 구현

### 상태 관리

Context API로 전역 상태를 관리했다.

```javascript
// AuthContext.js
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState(null);
  
  const login = async (email, password) => {
    try {
      const response = await authApi.login(email, password);
      
      setUser(response.user);
      setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      });
      
      // AsyncStorage에 저장
      await AsyncStorage.multiSet([
        ['user', JSON.stringify(response.user)],
        ['accessToken', response.accessToken],
        ['refreshToken', response.refreshToken]
      ]);
      
    } catch (error) {
      throw error;
    }
  };
  
  return (
    <AuthContext.Provider value={{user, tokens, login}}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 일기 작성 화면

```javascript
const DiaryWriteScreen = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [weather, setWeather] = useState('sunny');
  const [isLoading, setIsLoading] = useState(false);
  
  const saveDiary = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('알림', '제목과 내용을 입력해주세요');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await diaryApi.create({title, content, weather});
      Alert.alert('저장 완료', 'AI 분석 결과는 잠시 후 확인하실 수 있습니다');
      navigation.goBack();
    } catch (error) {
      Alert.alert('오류', '저장에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.titleInput}
        placeholder="제목을 입력하세요"
        value={title}
        onChangeText={setTitle}
      />
      
      <TextInput
        style={styles.contentInput}
        placeholder="오늘 있었던 일을 자유롭게 적어보세요"
        value={content}
        onChangeText={setContent}
        multiline
      />
      
      <TouchableOpacity 
        style={styles.saveButton} 
        onPress={saveDiary}
        disabled={isLoading}
      >
        <Text style={styles.saveButtonText}>
          {isLoading ? '저장 중...' : '저장하기'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
```

## 겪었던 문제들

### 1. AI 분석 속도
처음엔 동기로 처리했는데 응답이 너무 느렸다. 비동기로 바꾸고 "분석 중입니다" 상태를 보여주는 방식으로 개선했다.

### 2. 토큰 갱신
Access Token이 만료됐을 때 자동으로 갱신하는 로직을 구현했다.

```javascript
// api interceptor
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const response = await authApi.refresh(refreshToken);
        
        // 새 토큰 저장
        await AsyncStorage.setItem('accessToken', response.accessToken);
        
        // 원래 요청 재시도
        error.config.headers.Authorization = `Bearer ${response.accessToken}`;
        return axios.request(error.config);
        
      } catch (refreshError) {
        // 로그아웃 처리
        await logout();
      }
    }
    
    return Promise.reject(error);
  }
);
```

### 3. 데이터베이스 관계 설정
처음엔 MongoDB를 쓰려고 했는데, 일기-분석결과 간의 관계가 복잡해서 MariaDB로 바꿨다.

```sql
-- 테이블 구조
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE diary (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    weather VARCHAR(50),
    report_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (report_id) REFERENCES report(id)
);

CREATE TABLE report (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    emotion VARCHAR(100),
    keywords JSON,
    advice TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 배운 점들

### 1. 마이크로서비스의 복잡성
서버를 분리하니 통신 오류, 타임아웃 등 고려할 게 많아졌다. 간단한 프로젝트라면 모노리스가 나을 수도 있다.

### 2. 에러 처리의 중요성
특히 AI API 호출 실패시 사용자에게 어떻게 알릴지, 재시도는 어떻게 할지 미리 정해두는 게 중요하다.

### 3. 비동기 처리
AI 분석같이 시간이 오래 걸리는 작업은 반드시 비동기로 처리하고, 사용자에게 적절한 피드백을 줘야 한다.

## 개선할 점들

1. **WebSocket 도입**: AI 분석 완료를 실시간으로 알리기
2. **오프라인 지원**: 네트워크 없을 때도 일기 작성 가능하게
3. **이미지 업로드**: 일기에 사진도 첨부할 수 있게
4. **푸시 알림**: 일기 쓸 시간 알림 기능

이런 식으로 여러 기술을 조합해서 앱을 만드는 재미가 쏠쏠했다. 다음에는 좀 더 간단한 구조로 시작해서 점진적으로 확장하는 방식을 써볼 생각이다.