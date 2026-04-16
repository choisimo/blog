import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { BrowserRouter } from 'react-router-dom';
import { BlogCard } from '../components/features/blog';

// Mock blog post data
const mockPost = {
  id: '1',
  title: 'Test Blog Post',
  description: 'This is a test blog post description',
  excerpt: 'This is a test blog post description',
  date: '2024-01-01',
  year: '2024',
  category: 'Tech',
  tags: ['React', 'TypeScript'],
  content: 'Test content',
  slug: 'test-blog-post',
  language: 'ko' as const,
  readTime: 5,
  readingTime: '5분 읽기',
  author: 'Test Author',
  published: true,
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>{ui}</ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
};

describe('BlogCard Component', () => {
  it('renders blog post information correctly', () => {
    renderWithProviders(<BlogCard post={mockPost} />);

    expect(screen.getByText('Test Blog Post')).toBeInTheDocument();
    expect(
      screen.getByText('This is a test blog post description')
    ).toBeInTheDocument();
    expect(screen.getByText('Tech')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('displays read time when provided', () => {
    renderWithProviders(<BlogCard post={mockPost} />);

    expect(screen.getByText(/5 (min read|분 읽기)/i)).toBeInTheDocument();
  });
});
