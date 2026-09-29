import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import GlossaryPanel from '../shared/GlossaryPanel';

export default function AppLayout() {
  return (
    <div className="fsoc-app-bg flex h-screen w-screen overflow-hidden text-white">
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="relative flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <GlossaryPanel />
    </div>
  );
}
