import { Link } from 'react-router-dom';
import { PostEditorWorkspace } from '@/components/features/admin/content/PostEditorWorkspace';

export default function NewPost() {
  return (
    <div className="ui-workspace ui-new-post-page" data-ui-page='admin-new-post'>
      <nav className="ui-editor-breadcrumb" aria-label='관리자 탐색'><Link to='/admin/config/content/editor'>콘텐츠로 돌아가기</Link><Link to='/'>블로그 보기</Link></nav>
      <h1 className="ui-new-post-title">게시글 작성</h1>
      <PostEditorWorkspace />
    </div>
  );
}
