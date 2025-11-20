import mammoth from 'mammoth/mammoth.browser';
import * as pdfjsLib from 'pdfjs-dist';

// PDF.js worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export class BrowserDocumentParser {
  constructor() {
    this.supportedFormats = ['docx', 'pdf'];
  }

  async parseFile(file) {
    const fileType = this.getFileType(file);

    if (!this.supportedFormats.includes(fileType)) {
      throw new Error(`지원하지 않는 파일 형식입니다: ${fileType}`);
    }

    switch (fileType) {
      case 'docx':
        return await this.parseDocx(file);
      case 'pdf':
        return await this.parsePdf(file);
      default:
        throw new Error(`처리할 수 없는 파일 형식: ${fileType}`);
    }
  }

  getFileType(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    return extension;
  }

  async parseDocx(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });

      const sections = this.detectSections(result.value);

      return {
        type: 'docx',
        filename: file.name,
        text: result.value,
        html: htmlResult.value,
        sections,
        wordCount: this.countWords(result.value),
        metadata: {
          size: file.size,
          lastModified: new Date(file.lastModified),
          parsedAt: new Date(),
        },
      };
    } catch (error) {
      throw new Error(`DOCX 파일 파싱 실패: ${error.message}`);
    }
  }

  async parsePdf(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      const pages = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter(item => item.str && item.str.trim())
          .map(item => item.str)
          .join(' ');

        pages.push({
          pageNumber: i,
          text: pageText,
        });

        fullText += pageText + '\n\n';
      }

      const sections = this.detectSections(fullText);

      return {
        type: 'pdf',
        filename: file.name,
        text: fullText.trim(),
        pages,
        sections,
        wordCount: this.countWords(fullText),
        metadata: {
          size: file.size,
          pageCount: pdf.numPages,
          lastModified: new Date(file.lastModified),
          parsedAt: new Date(),
        },
      };
    } catch (error) {
      throw new Error(`PDF 파일 파싱 실패: ${error.message}`);
    }
  }

  detectSections(text) {
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    const sections = [];
    let currentSection = {
      title: '도입부',
      content: [],
      startIndex: 0,
      level: 0,
    };

    lines.forEach((line, index) => {
      const headerInfo = this.analyzeSectionHeader(line);

      if (headerInfo.isHeader) {
        // 이전 섹션 저장
        if (currentSection.content.length > 0) {
          currentSection.content = currentSection.content.join('\n');
          currentSection.wordCount = this.countWords(currentSection.content);
          sections.push(currentSection);
        }

        // 새 섹션 시작
        currentSection = {
          title: headerInfo.cleanTitle,
          content: [],
          startIndex: index,
          level: headerInfo.level,
          type: headerInfo.type,
        };
      } else if (line.length > 10) {
        // 너무 짧은 줄은 제외
        currentSection.content.push(line);
      }
    });

    // 마지막 섹션 처리
    if (currentSection.content.length > 0) {
      currentSection.content = currentSection.content.join('\n');
      currentSection.wordCount = this.countWords(currentSection.content);
      sections.push(currentSection);
    }

    return sections.filter(section => section.wordCount > 50); // 너무 짧은 섹션 제거
  }

  analyzeSectionHeader(line) {
    // 다양한 헤더 패턴 검사
    const patterns = [
      {
        regex: /^#{1,6}\s+(.+)/,
        type: 'markdown',
        level: match => match[0].match(/#/g).length,
      },
      { regex: /^(\d+)\.\s+(.+)/, type: 'numbered', level: 1 },
      { regex: /^(\d+\.\d+)\s+(.+)/, type: 'numbered', level: 2 },
      { regex: /^(\d+\.\d+\.\d+)\s+(.+)/, type: 'numbered', level: 3 },
      {
        regex: /^(Chapter|Section|Part)\s+(\d+):?\s*(.+)/i,
        type: 'chapter',
        level: 1,
      },
      { regex: /^([A-Z][^.]*):$/, type: 'title', level: 1 },
      { regex: /^([가-힣]+)\s*(\d+)\s*[:.]\s*(.+)/, type: 'korean', level: 1 },
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match) {
        let cleanTitle = '';
        let level = 1;

        if (pattern.type === 'markdown') {
          cleanTitle = match[1].trim();
          level = pattern.level(match);
        } else if (pattern.type === 'numbered') {
          cleanTitle = match[2].trim();
          level = pattern.level;
        } else if (pattern.type === 'chapter') {
          cleanTitle = match[3] ? match[3].trim() : `${match[1]} ${match[2]}`;
          level = pattern.level;
        } else if (pattern.type === 'title') {
          cleanTitle = match[1].trim();
          level = pattern.level;
        } else if (pattern.type === 'korean') {
          cleanTitle = match[3] ? match[3].trim() : `${match[1]} ${match[2]}`;
          level = pattern.level;
        }

        return {
          isHeader: true,
          cleanTitle,
          level,
          type: pattern.type,
          originalText: line,
        };
      }
    }

    // 헤더가 아닌 경우도 체크 (대문자로만 이루어진 짧은 줄)
    if (line.length < 100 && line === line.toUpperCase() && line.length > 3) {
      return {
        isHeader: true,
        cleanTitle: line,
        level: 1,
        type: 'uppercase',
        originalText: line,
      };
    }

    return { isHeader: false };
  }

  countWords(text) {
    if (!text) return 0;

    // 한글과 영어를 모두 고려한 단어 수 계산
    const koreanChars = (text.match(/[가-힣]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const numbers = (text.match(/\d+/g) || []).length;

    // 한글은 글자 수 / 2, 영어는 단어 수로 계산
    return Math.floor(koreanChars / 2) + englishWords + numbers;
  }

  validateFile(file) {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
    ];

    if (file.size > maxSize) {
      throw new Error('파일 크기는 50MB를 초과할 수 없습니다.');
    }

    if (
      !allowedTypes.includes(file.type) &&
      !this.supportedFormats.includes(this.getFileType(file))
    ) {
      throw new Error(
        '지원되지 않는 파일 형식입니다. DOCX 또는 PDF 파일만 업로드할 수 있습니다.'
      );
    }

    return true;
  }
}
