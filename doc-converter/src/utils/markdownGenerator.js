export class MarkdownGenerator {
  constructor() {
    this.personalIntros = [
      '이번 포스트에서는',
      '오늘 다룰 내용은',
      '이제 본격적으로',
      '계속해서 진행할 내용은',
      '다음 단계로 넘어가서',
    ];

    this.personalOutros = [
      '다음 포스트에서 계속 이어가겠습니다.',
      '다음 편에서 더 자세히 알아보겠습니다.',
      '계속해서 다음 내용을 살펴보도록 하겠습니다.',
      '다음 글에서 더 깊이 있는 내용을 다뤄보겠습니다.',
      '이어지는 포스트에서 실제 구현을 살펴보겠습니다.',
    ];

    this.experienceTransitions = [
      '실제로 해보니',
      '직접 경험해보면서',
      '과정에서 느낀 점은',
      '개인적으로는',
      '여기서 주의할 점은',
    ];
  }

  generatePostSeries(document, options = {}) {
    const {
      targetPosts = 5,
      language = 'ko',
      narrativeStyle = 'experience',
      seriesTitle,
      authorName = '작성자',
    } = options;

    const sections = document.sections || [];
    if (sections.length === 0) {
      throw new Error('문서에서 섹션을 찾을 수 없습니다.');
    }

    const chunks = this.intelligentSplit(sections, targetPosts);
    const posts = [];

    chunks.forEach((chunk, index) => {
      const post = this.generatePost({
        sections: chunk.sections,
        postNumber: index + 1,
        totalPosts: chunks.length,
        seriesTitle: seriesTitle || this.extractSeriesTitle(document),
        language,
        narrativeStyle,
        authorName,
        originalDocument: document,
      });

      posts.push(post);
    });

    return posts;
  }

  intelligentSplit(sections, targetPosts) {
    if (sections.length <= targetPosts) {
      return sections.map(section => ({ sections: [section] }));
    }

    const totalWords = sections.reduce(
      (sum, section) => sum + (section.wordCount || 0),
      0
    );
    const avgWordsPerPost = Math.ceil(totalWords / targetPosts);
    const minWordsPerPost = avgWordsPerPost * 0.5;
    const maxWordsPerPost = avgWordsPerPost * 1.5;

    const chunks = [];
    let currentChunk = { sections: [], wordCount: 0 };

    sections.forEach(section => {
      const sectionWords = section.wordCount || 0;

      // 현재 청크에 추가했을 때의 단어 수
      const potentialWordCount = currentChunk.wordCount + sectionWords;

      // 새로운 청크를 시작해야 하는 조건
      const shouldStartNewChunk =
        currentChunk.sections.length > 0 &&
        (potentialWordCount > maxWordsPerPost ||
          (potentialWordCount > avgWordsPerPost &&
            currentChunk.sections.length >= 2));

      if (shouldStartNewChunk) {
        chunks.push(currentChunk);
        currentChunk = { sections: [], wordCount: 0 };
      }

      currentChunk.sections.push(section);
      currentChunk.wordCount += sectionWords;
    });

    // 마지막 청크 추가
    if (currentChunk.sections.length > 0) {
      chunks.push(currentChunk);
    }

    // 너무 짧은 마지막 청크는 이전 청크와 합치기
    if (
      chunks.length > 1 &&
      chunks[chunks.length - 1].wordCount < minWordsPerPost
    ) {
      const lastChunk = chunks.pop();
      chunks[chunks.length - 1].sections.push(...lastChunk.sections);
      chunks[chunks.length - 1].wordCount += lastChunk.wordCount;
    }

    return chunks;
  }

  generatePost({
    sections,
    postNumber,
    totalPosts,
    seriesTitle,
    language,
    narrativeStyle,
    authorName,
    originalDocument,
  }) {
    const date = new Date();
    date.setDate(date.getDate() + (postNumber - 1));

    const frontmatter = this.generateFrontmatter({
      postNumber,
      totalPosts,
      seriesTitle,
      language,
      date,
      sections,
      originalDocument,
    });

    const content = this.generateContent({
      sections,
      postNumber,
      totalPosts,
      narrativeStyle,
      language,
    });

    const filename = this.generateFilename({
      date,
      seriesTitle,
      postNumber,
      language,
    });

    const markdown = this.assembleMarkdown(frontmatter, content);

    return {
      filename,
      content: markdown,
      frontmatter,
      metadata: {
        wordCount: this.countWords(content),
        readingTime: this.calculateReadingTime(content),
        sectionsIncluded: sections.map(s => s.title),
      },
    };
  }

  generateFrontmatter({
    postNumber,
    totalPosts,
    seriesTitle,
    language,
    date,
    sections,
    originalDocument,
  }) {
    const tags = this.extractTags(sections);
    const title = this.generateTitle(
      sections,
      postNumber,
      seriesTitle,
      language
    );

    const frontmatter = {
      title,
      date: date.toISOString().split('T')[0],
      tags,
      series: seriesTitle,
      part: postNumber,
      totalParts: totalPosts,
      language,
      author: 'nodove',
    };

    // 카테고리 자동 감지
    const category = this.detectCategory(sections);
    if (category) {
      frontmatter.category = category;
    }

    // 설명 생성
    frontmatter.description = this.generateDescription(sections, language);

    return frontmatter;
  }

  generateTitle(sections, postNumber, seriesTitle, language) {
    const mainTopic = this.extractMainTopic(sections);

    const templates = {
      ko: [
        `${seriesTitle} ${postNumber}부: ${mainTopic}`,
        `${seriesTitle} 가이드 #${postNumber} - ${mainTopic}`,
        `${seriesTitle} 실전 경험기 (${postNumber}/${postNumber === 1 ? '총 몇 부작' : ''})`,
        `${mainTopic} 구축하기 - ${seriesTitle} Part ${postNumber}`,
      ],
      en: [
        `${seriesTitle} Part ${postNumber}: ${mainTopic}`,
        `${seriesTitle} Guide #${postNumber} - ${mainTopic}`,
        `Building ${mainTopic}: ${seriesTitle} Chapter ${postNumber}`,
        `${mainTopic} Implementation - ${seriesTitle} Episode ${postNumber}`,
      ],
    };

    const templateList = templates[language] || templates.ko;
    return templateList[0]; // 첫 번째 템플릿 사용
  }

  generateContent({
    sections,
    postNumber,
    totalPosts,
    narrativeStyle,
    language,
  }) {
    let content = this.addPersonalIntro(postNumber, totalPosts, language);

    sections.forEach((section, index) => {
      content += `\\n\\n## ${section.title}\\n\\n`;

      // 섹션 내용을 경험담 스타일로 변환
      const transformedContent = this.transformToNarrative(
        section.content,
        narrativeStyle,
        language,
        index === 0 // 첫 번째 섹션 여부
      );

      content += transformedContent;
    });

    content += this.addPersonalOutro(postNumber, totalPosts, language);

    return content;
  }

  addPersonalIntro(postNumber, totalPosts, language) {
    if (language === 'ko') {
      if (postNumber === 1) {
        return `이번에 새로운 시리즈를 시작하게 되었습니다. 총 ${totalPosts}부작으로 구성될 예정이며, 첫 번째 포스트에서는 기본적인 내용부터 차근차근 다뤄보겠습니다.`;
      } else if (postNumber === totalPosts) {
        return `드디어 시리즈의 마지막 편입니다. 지금까지의 내용을 바탕으로 마무리 단계를 진행해보겠습니다.`;
      } else {
        return `${this.personalIntros[postNumber % this.personalIntros.length]} ${postNumber}번째 파트를 다뤄보겠습니다. 이전 포스트에서 이어지는 내용이니 참고해서 읽어주세요.`;
      }
    } else {
      if (postNumber === 1) {
        return `I'm starting a new series that will consist of ${totalPosts} parts. In this first post, I'll cover the fundamentals step by step.`;
      } else if (postNumber === totalPosts) {
        return `This is the final part of our series. Based on everything we've covered, let's complete the final steps.`;
      } else {
        return `Continuing with part ${postNumber} of our series. This builds on the previous posts, so please refer to them as needed.`;
      }
    }
  }

  addPersonalOutro(postNumber, totalPosts, language) {
    if (language === 'ko') {
      if (postNumber === totalPosts) {
        return `\\n\\n이로써 ${totalPosts}부작으로 구성된 시리즈가 완료되었습니다. 긴 여정이었지만 많은 것을 배울 수 있었던 좋은 경험이었습니다. 궁금한 점이 있으시면 언제든 댓글로 남겨주세요!`;
      } else {
        return `\\n\\n${this.personalOutros[postNumber % this.personalOutros.length]} 다음 편에서는 더 흥미로운 내용들을 준비해두었으니 기대해 주세요!`;
      }
    } else {
      if (postNumber === totalPosts) {
        return `\\n\\nThis completes our ${totalParts}-part series. It's been quite a journey, and I've learned a lot along the way. Feel free to leave any questions in the comments!`;
      } else {
        return `\\n\\nI'll continue with more interesting content in the next post. Stay tuned!`;
      }
    }
  }

  transformToNarrative(content, style, language, isFirst = false) {
    // 기술적 내용을 개인적 경험담으로 변환
    let narrative = content;

    // 명령형을 경험담으로 변환
    if (language === 'ko') {
      // "설치하세요" -> "설치했습니다"
      narrative = narrative.replace(/([가-힣]+)하세요/g, '$1했습니다');
      narrative = narrative.replace(
        /([가-힣]+)해야 합니다/g,
        '$1해야 했습니다'
      );
      narrative = narrative.replace(/다음과 같이/g, '저는 다음과 같이');

      if (isFirst && style === 'experience') {
        narrative =
          `실제로 진행하면서 경험한 내용을 바탕으로 설명드리겠습니다.\\n\\n` +
          narrative;
      }

      // 경험적 표현 추가
      const experienceMarkers = [
        '여기서 중요한 점은',
        '실제로 해보니',
        '개인적으로는',
        '경험상',
      ];
      if (Math.random() > 0.7) {
        // 30% 확률로 경험적 표현 추가
        const marker =
          experienceMarkers[
            Math.floor(Math.random() * experienceMarkers.length)
          ];
        narrative = narrative.replace(/\\n\\n([가-힣])/g, `\\n\\n${marker} $1`);
      }
    } else {
      // 영어 변환
      narrative = narrative.replace(/You should/g, 'I');
      narrative = narrative.replace(/You can/g, 'I was able to');
      narrative = narrative.replace(/You need to/g, 'I needed to');

      if (isFirst && style === 'experience') {
        narrative =
          `Based on my actual experience, here's what I learned:\\n\\n` +
          narrative;
      }
    }

    return narrative;
  }

  extractMainTopic(sections) {
    // 첫 번째 섹션 제목에서 주요 토픽 추출
    if (sections.length === 0) return '설정 가이드';

    const firstTitle = sections[0].title;
    const keywords = firstTitle.match(/[A-Za-z가-힣]+/g);

    if (keywords && keywords.length > 0) {
      return keywords[0];
    }

    return '구성 요소';
  }

  extractTags(sections) {
    const allText = sections.map(s => `${s.title} ${s.content}`).join(' ');
    const tags = new Set();

    // 기술 키워드 추출
    const techTerms = [
      'Docker',
      'Kubernetes',
      'Proxmox',
      'Linux',
      'Ubuntu',
      'CentOS',
      'VM',
      'Container',
      'Network',
      'Storage',
      'Server',
      'Cloud',
      'Installation',
      'Configuration',
      'Setup',
      'Guide',
      'Tutorial',
      '도커',
      '쿠버네티스',
      '프록스목스',
      '리눅스',
      '우분투',
      '가상머신',
      '컨테이너',
      '네트워크',
      '스토리지',
      '서버',
      '클라우드',
      '설치',
      '구성',
      '설정',
      '가이드',
      '튜토리얼',
    ];

    techTerms.forEach(term => {
      if (allText.toLowerCase().includes(term.toLowerCase())) {
        tags.add(term.toLowerCase());
      }
    });

    return Array.from(tags).slice(0, 8);
  }

  detectCategory(sections) {
    const allText = sections
      .map(s => s.title + ' ' + s.content)
      .join(' ')
      .toLowerCase();

    const categories = {
      infrastructure: ['server', 'network', 'proxmox', 'vm', 'infrastructure'],
      containerization: ['docker', 'kubernetes', 'container', 'k8s'],
      linux: ['linux', 'ubuntu', 'centos', 'terminal', 'shell'],
      development: ['development', 'programming', 'code', 'api'],
      tutorial: ['guide', 'tutorial', 'how-to', '가이드', '튜토리얼'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  generateDescription(sections, language) {
    const mainTopic = this.extractMainTopic(sections);
    const firstContent = sections[0]?.content || '';

    if (language === 'ko') {
      return `${mainTopic}에 대한 실제 경험을 바탕으로 한 가이드입니다. ${firstContent.substring(0, 100)}...`;
    } else {
      return `A practical guide to ${mainTopic} based on real experience. ${firstContent.substring(0, 100)}...`;
    }
  }

  generateFilename({ date, seriesTitle, postNumber, language }) {
    const dateStr = date.toISOString().split('T')[0];
    const titleSlug = this.createSlug(seriesTitle);
    const langSuffix = language === 'en' ? '-en' : '';

    return `${dateStr}-${titleSlug}-part-${postNumber}${langSuffix}.md`;
  }

  createSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\\s-]/g, '')
      .replace(/\\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50)
      .replace(/-$/, '');
  }

  extractSeriesTitle(document) {
    // 파일명에서 시리즈 제목 추출
    const filename = document.filename || 'Document';
    return filename
      .replace(/\\.[^/.]+$/, '') // 확장자 제거
      .replace(/[_-]/g, ' ') // 언더스코어, 대시를 공백으로
      .replace(/\\b\\w/g, l => l.toUpperCase()); // 각 단어 첫글자 대문자
  }

  assembleMarkdown(frontmatter, content) {
    const frontmatterStr = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`;
        }
        return `${key}: "${value}"`;
      })
      .join('\\n');

    return `---\\n${frontmatterStr}\\n---\\n\\n${content}`;
  }

  countWords(text) {
    if (!text) return 0;
    const koreanChars = (text.match(/[가-힣]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return Math.floor(koreanChars / 2) + englishWords;
  }

  calculateReadingTime(text) {
    const wordCount = this.countWords(text);
    return Math.ceil(wordCount / 200); // 분당 200단어 기준
  }
}
