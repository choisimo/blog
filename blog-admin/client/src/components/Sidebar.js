import { Link, useLocation } from 'react-router-dom';
import {
  DocumentTextIcon,
  PlusIcon,
  CodeBracketIcon,
  HomeIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';

function Sidebar() {
  const location = useLocation();

  const navigation = [
    { name: '대시보드', href: '/', icon: HomeIcon },
    { name: '게시글 목록', href: '/posts', icon: DocumentTextIcon },
    { name: '새 게시글', href: '/posts/new', icon: PlusIcon },
    { name: '배포 관리', href: '/deploy', icon: CloudArrowUpIcon },
    { name: 'Git 관리', href: '/git', icon: CodeBracketIcon },
  ];

  return (
    <div className="bg-gray-800 text-white w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform -translate-x-full md:relative md:translate-x-0 transition duration-200 ease-in-out">
      <div className="text-white text-2xl font-semibold text-center">
        Blog Admin
      </div>
      
      <nav className="space-y-2">
        {navigation.map((item) => {
          const isCurrent = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`
                group flex items-center px-2 py-2 text-sm font-medium rounded-md
                ${isCurrent 
                  ? 'bg-gray-900 text-white' 
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }
              `}
            >
              <item.icon
                className="mr-3 h-6 w-6"
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      <div className="px-2 mt-8">
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-200 mb-2">빠른 도움말</h3>
          <p className="text-xs text-gray-400">
            • 새 게시글 작성 후 저장<br/>
            • 배포 관리에서 원클릭 배포<br/>
            • GitHub Pages 자동 빌드
          </p>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;