import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import PostList from './components/PostList';
import PostEditor from './components/PostEditor';
import GitPanel from './components/GitPanel';
import DeployPanel from './components/DeployPanel';
import Settings from './components/Settings';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
            <Routes>
              <Route path="/" element={<PostList />} />
              <Route path="/posts" element={<PostList />} />
              <Route path="/posts/new" element={<PostEditor />} />
              <Route path="/posts/edit/:year/:slug" element={<PostEditor />} />
              <Route path="/deploy" element={<DeployPanel />} />
              <Route path="/git" element={<GitPanel />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;