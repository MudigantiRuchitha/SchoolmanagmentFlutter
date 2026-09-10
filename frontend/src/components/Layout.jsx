import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout({ children, title, subtitle, headerRight }) {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <Header title={title} subtitle={subtitle} right={headerRight} />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
