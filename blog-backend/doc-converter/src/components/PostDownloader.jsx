import React from 'react';
import { Download, Package, FileText, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useDocumentStore } from '../stores/documentStore';

const PostDownloader = () => {
  const { generatedPosts, settings } = useDocumentStore();

  const generateReadme = () => {
    const readmeContent = `# 생성된 블로그 포스트

## 📝 시리즈 정보
- **시리즈명**: ${settings.seriesTitle || '문서 변환 시리즈'}
- **총 포스트 수**: ${generatedPosts.length}개
- **언어**: ${settings.language === 'ko' ? '한국어' : 'English'}
- **스타일**: ${
      settings.narrativeStyle === 'experience'
        ? '개인 경험담'
        : settings.narrativeStyle === 'journey'
          ? '학습 여정'
          : settings.narrativeStyle === 'troubleshooting'
            ? '문제 해결기'
            : '기술 회고'
    }
- **생성 일시**: ${new Date().toLocaleString('ko-KR')}

## 📂 파일 목록
${generatedPosts
  .map(
    (post, index) =>
      `${index + 1}. **${post.filename}**
   - 제목: ${post.frontmatter.title}
   - 단어 수: ${post.metadata.wordCount}개
   - 예상 읽기 시간: ${post.metadata.readingTime}분
   - 태그: ${post.frontmatter.tags.join(', ')}
`
  )
  .join('\n')}

## 🚀 사용 방법

### 1. GitHub Pages 블로그에 업로드
\`\`\`bash
# 1. 블로그 저장소로 파일들을 복사
cp *.md /path/to/your/blog/_posts/  # Jekyll 기반
# 또는
cp *.md /path/to/your/blog/public/posts/2025/  # 다른 정적 사이트 생성기

# 2. Git으로 커밋 및 푸시
git add .
git commit -m "Add new blog post series: ${settings.seriesTitle || '문서 변환 시리즈'}"
git push origin main
\`\`\`

### 2. 파일 구조 확인
- 모든 파일은 올바른 Markdown 형식으로 생성되었습니다
- Frontmatter에 필요한 메타데이터가 포함되어 있습니다
- 각 파일은 독립적으로 작동하지만 시리즈로 연결됩니다

### 3. 추가 편집
필요에 따라 각 Markdown 파일을 텍스트 에디터로 열어서 수정할 수 있습니다.

## 📋 체크리스트
- [ ] 모든 파일을 블로그 저장소에 복사
- [ ] 파일명과 날짜가 올바른지 확인
- [ ] 각 포스트의 태그와 카테고리 확인
- [ ] Git commit & push 실행
- [ ] 배포 확인

## 🛠 생성 도구
이 포스트들은 [문서→블로그 변환기](/)를 사용하여 생성되었습니다.

---
*이 파일은 자동으로 생성되었습니다.*`;

    return readmeContent;
  };

  const handleDownloadAll = async () => {
    if (generatedPosts.length === 0) return;

    try {
      const zip = new JSZip();
      const postsFolder = zip.folder('posts');

      // 각 포스트 파일 추가
      generatedPosts.forEach(post => {
        postsFolder.file(post.filename, post.content);
      });

      // README 파일 추가
      zip.file('README.md', generateReadme());

      // 배포 가이드 추가
      const deployGuide = `# 배포 가이드

## GitHub Pages 배포 방법

### 방법 1: GitHub 웹 인터페이스 사용
1. GitHub에서 블로그 저장소로 이동
2. \`_posts\` 또는 \`public/posts/2025/\` 폴더로 이동
3. "Add file" > "Upload files" 클릭
4. 모든 .md 파일을 드래그 앤 드롭으로 업로드
5. 커밋 메시지 작성 후 "Commit changes" 클릭

### 방법 2: Git 명령어 사용
\`\`\`bash
# 저장소 클론 (처음만)
git clone https://github.com/YOUR_USERNAME/YOUR_BLOG_REPO.git
cd YOUR_BLOG_REPO

# 포스트 파일들 복사
cp /path/to/downloaded/posts/*.md _posts/
# 또는 다른 경로: cp /path/to/downloaded/posts/*.md public/posts/2025/

# 커밋 및 푸시
git add .
git commit -m "Add new blog post series"
git push origin main
\`\`\`

### 방법 3: GitHub Desktop 사용
1. GitHub Desktop에서 저장소 열기
2. 포스트 파일들을 적절한 폴더에 복사
3. 변경사항 확인 후 커밋
4. Push origin 클릭

## 주의사항
- 파일명의 날짜 형식이 올바른지 확인하세요 (YYYY-MM-DD)
- Frontmatter 형식이 블로그 설정과 일치하는지 확인하세요
- 이미지나 링크가 있다면 경로를 확인하세요

## 문제 해결
- 빌드 오류가 발생하면 Frontmatter 형식을 확인하세요
- 한글 인코딩 문제가 있다면 파일을 UTF-8로 다시 저장하세요
- Jekyll 사용시 \`bundle exec jekyll serve\`로 로컬에서 먼저 테스트하세요
`;

      zip.file('DEPLOY.md', deployGuide);

      // ZIP 파일 생성 및 다운로드
      const blob = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `blog-posts-${timestamp}.zip`;

      saveAs(blob, filename);
    } catch (error) {
      console.error('Download error:', error);
      alert('다운로드 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const calculateTotalStats = () => {
    return generatedPosts.reduce(
      (stats, post) => ({
        totalWords: stats.totalWords + post.metadata.wordCount,
        totalReadingTime: stats.totalReadingTime + post.metadata.readingTime,
        totalTags: stats.totalTags + post.frontmatter.tags.length,
      }),
      { totalWords: 0, totalReadingTime: 0, totalTags: 0 }
    );
  };

  if (generatedPosts.length === 0) {
    return (
      <div className='w-full max-w-2xl mx-auto bg-gray-50 rounded-lg p-8 text-center'>
        <Package className='mx-auto h-12 w-12 text-gray-400 mb-4' />
        <p className='text-gray-600'>
          포스트가 생성되면 다운로드할 수 있습니다
        </p>
      </div>
    );
  }

  const stats = calculateTotalStats();

  return (
    <div className='w-full max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6'>
      <h2 className='text-xl font-bold text-gray-900 mb-4 flex items-center'>
        <Download className='mr-2 h-5 w-5' />
        다운로드
      </h2>

      {/* 통계 정보 */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
        <div className='bg-blue-50 rounded-lg p-4 text-center'>
          <FileText className='mx-auto h-8 w-8 text-blue-600 mb-2' />
          <p className='text-2xl font-bold text-blue-700'>
            {generatedPosts.length}
          </p>
          <p className='text-sm text-blue-600'>포스트</p>
        </div>

        <div className='bg-green-50 rounded-lg p-4 text-center'>
          <FileText className='mx-auto h-8 w-8 text-green-600 mb-2' />
          <p className='text-2xl font-bold text-green-700'>
            {stats.totalWords.toLocaleString()}
          </p>
          <p className='text-sm text-green-600'>총 단어</p>
        </div>

        <div className='bg-purple-50 rounded-lg p-4 text-center'>
          <FileText className='mx-auto h-8 w-8 text-purple-600 mb-2' />
          <p className='text-2xl font-bold text-purple-700'>
            {stats.totalReadingTime}
          </p>
          <p className='text-sm text-purple-600'>분 읽기</p>
        </div>
      </div>

      {/* 다운로드 버튼 */}
      <button
        onClick={handleDownloadAll}
        className='w-full flex items-center justify-center px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-medium'
      >
        <Package className='mr-3 h-6 w-6' />
        모든 포스트 다운로드 (.zip)
      </button>

      {/* 포함 내용 안내 */}
      <div className='mt-6 bg-blue-50 rounded-lg p-4'>
        <h3 className='font-semibold text-blue-900 mb-2 flex items-center'>
          <FileText className='mr-2 h-4 w-4' />
          다운로드 포함 내용
        </h3>
        <ul className='text-sm text-blue-800 space-y-1 ml-4'>
          <li>• {generatedPosts.length}개의 Markdown 포스트 파일</li>
          <li>• README.md (시리즈 정보 및 사용 방법)</li>
          <li>• DEPLOY.md (GitHub Pages 배포 가이드)</li>
          <li>• 올바른 Frontmatter와 태그 포함</li>
          <li>• 날짜별 정렬된 파일명</li>
        </ul>
      </div>

      {/* 사용 방법 */}
      <div className='mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
        <div className='flex items-start'>
          <AlertCircle className='h-5 w-5 text-yellow-600 mr-2 mt-0.5' />
          <div>
            <h4 className='font-semibold text-yellow-800'>사용 방법</h4>
            <ol className='text-sm text-yellow-700 mt-1 space-y-1 ml-4'>
              <li>1. 위 버튼을 클릭해 ZIP 파일 다운로드</li>
              <li>2. 압축 해제 후 .md 파일들을 블로그 저장소에 복사</li>
              <li>3. Git commit & push 실행</li>
              <li>4. GitHub Actions가 자동으로 사이트 빌드 및 배포</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDownloader;
